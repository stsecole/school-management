/**
 * Migrate levels to the new fixed list:
 *   بدون مستوى, ابتدائي, متوسط, ثانوي, معهد, جامعي
 *
 * Steps:
 * 1. Create the new levels if they don't exist.
 * 2. Re-assign students/courses currently linked to old levels to "بدون مستوى".
 * 3. Delete old levels not in the new list.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const NEW_LEVELS = [
  { name: 'بدون مستوى', order: 0 },
  { name: 'ابتدائي', order: 1 },
  { name: 'متوسط', order: 2 },
  { name: 'ثانوي', order: 3 },
  { name: 'معهد', order: 4 },
  { name: 'جامعي', order: 5 },
];

const NEW_LEVEL_NAMES = NEW_LEVELS.map(l => l.name);

async function main() {
  console.log('🌱 Migrating levels to new list...');

  // 1. Create the new "بدون مستوى" level first (needed for reassignment)
  const noLevel = await db.level.upsert({
    where: { name: 'بدون مستوى' },
    update: { order: 0 },
    create: { name: 'بدون مستوى', order: 0 },
  });
  console.log(`  ✓ Ensured level: بدون مستوى (id=${noLevel.id})`);

  // 2. Create the rest of the new levels
  for (const lvl of NEW_LEVELS.slice(1)) {
    await db.level.upsert({
      where: { name: lvl.name },
      update: { order: lvl.order },
      create: lvl,
    });
    console.log(`  ✓ Ensured level: ${lvl.name}`);
  }

  // 3. Find old levels that are NOT in the new list
  const allLevels = await db.level.findMany();
  const oldLevels = allLevels.filter(l => !NEW_LEVEL_NAMES.includes(l.name));

  if (oldLevels.length > 0) {
    console.log(`\n⚠️  Found ${oldLevels.length} old levels to remove:`);
    for (const old of oldLevels) {
      console.log(`     - ${old.name}`);

      // Re-assign students linked to this old level to "بدون مستوى"
      const studentsUpdated = await db.student.updateMany({
        where: { levelId: old.id },
        data: { levelId: noLevel.id },
      });
      if (studentsUpdated.count > 0) {
        console.log(`       → Re-assigned ${studentsUpdated.count} students to "بدون مستوى"`);
      }

      // Unlink courses linked to this old level (set levelId = null)
      const coursesUpdated = await db.course.updateMany({
        where: { levelId: old.id },
        data: { levelId: null },
      });
      if (coursesUpdated.count > 0) {
        console.log(`       → Unlinked ${coursesUpdated.count} courses`);
      }

      // Delete the old level
      await db.level.delete({ where: { id: old.id } });
    }
  } else {
    console.log('\n✓ No old levels to remove.');
  }

  // 4. Summary
  const finalLevels = await db.level.findMany({ orderBy: { order: 'asc' } });
  console.log(`\n✅ Done! Final levels (${finalLevels.length}):`);
  for (const l of finalLevels) {
    console.log(`   - ${l.order}. ${l.name}`);
  }

  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
