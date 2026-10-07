/**
 * Seed default school branches (شعب الدعم المدرسي).
 * These are the high school branches/tracks used in Algerian schools.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const DEFAULT_BRANCHES = [
  'علوم تجريبية',
  'رياضيات',
  'تقني رياضي',
  'آداب وفلسفة',
  'لغات أجنبية',
  'تسيير واقتصاد',
  'علوم إنسانية',
];

async function main() {
  console.log('🌱 Seeding default school branches...');
  let added = 0;
  for (const name of DEFAULT_BRANCHES) {
    const existing = await db.schoolBranch.findFirst({ where: { name } });
    if (!existing) {
      await db.schoolBranch.create({ data: { name } });
      added++;
      console.log(`  ✓ Added branch: ${name}`);
    }
  }
  const count = await db.schoolBranch.count();
  console.log(`\n✅ Done! Added ${added} new branches. Total: ${count}`);
  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
