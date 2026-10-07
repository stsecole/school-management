/**
 * سكريبت ترحيل كلمات المرور إلى bcrypt
 * - يشفر جميع كلمات المرور المخزّنة كنص عادي
 * - يتخطى كلمات المرور المشفّرة بالفعل
 * - يشفر أيضاً كلمة مرور القسم المالي
 *
 * التشغيل: bunx tsx scripts/migrate-passwords.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  console.log('🔐 بدء ترحيل كلمات المرور إلى bcrypt...');

  // 1. ترحيل كلمات مرور المستخدمين
  const users = await db.user.findMany();
  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.password.startsWith('$2')) {
      // كلمة المرور مشفّرة بالفعل
      skipped++;
      continue;
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
    console.log(`  ✓ تم تشفير كلمة مرور: ${user.username}`);
    migrated++;
  }

  console.log(`\n📊 ملخص المستخدمين:`);
  console.log(`  إجمالي: ${users.length}`);
  console.log(`  تم الترحيل: ${migrated}`);
  console.log(`  كان مشفّراً: ${skipped}`);

  // 2. ترحيل كلمة مرور القسم المالي
  const financeSetting = await db.setting.findUnique({
    where: { key: 'finance_password' },
  });

  if (financeSetting && !financeSetting.value.startsWith('$2')) {
    const hashedFinancePassword = await bcrypt.hash(financeSetting.value, SALT_ROUNDS);
    await db.setting.update({
      where: { key: 'finance_password' },
      data: { value: hashedFinancePassword },
    });
    console.log(`\n✓ تم تشفير كلمة مرور القسم المالي`);
  } else if (financeSetting) {
    console.log(`\n✓ كلمة مرور القسم المالي مشفّرة بالفعل`);
  }

  console.log('\n✅ اكتمل الترحيل بنجاح!');
  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ فشل الترحيل:', e);
  process.exit(1);
});
