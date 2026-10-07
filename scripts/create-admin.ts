/**
 * سكريبت إنشاء حساب المدير الافتراضي
 * Run: npx tsx scripts/create-admin.ts
 *
 * ينشئ حساب admin/admin123 إن لم يكن موجوداً
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🔍 فحص المستخدمين الموجودين...');

  const existingUsers = await db.user.findMany();
  console.log(`   عدد المستخدمين الحاليين: ${existingUsers.length}`);

  if (existingUsers.length > 0) {
    console.log('   المستخدمون الموجودون:');
    for (const u of existingUsers) {
      console.log(`   - ${u.username} (${u.name}) — الدور: ${u.role}`);
    }
  }

  // تحقّق من admin
  const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });

  if (existingAdmin) {
    console.log('\n✅ مستخدم admin موجود بالفعل');
    console.log(`   الاسم: ${existingAdmin.name}`);
    console.log(`   الدور: ${existingAdmin.role}`);
    console.log(`   كلمة المرور المخزّنة: ${existingAdmin.password}`);

    // حدّث كلمة المرور للتأكّد
    await db.user.update({
      where: { username: 'admin' },
      data: {
        password: 'admin123',
        role: 'director',
        name: 'المدير العام',
        canManageTimetable: true,
      },
    });
    console.log('✅ تم تحديث كلمة المرور إلى: admin123');
  } else {
    console.log('\n➕ إنشاء مستخدم admin جديد...');
    const admin = await db.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        name: 'المدير العام',
        role: 'director',
        canManageTimetable: true,
      },
    });
    console.log('✅ تم إنشاء المستخدم:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Password: admin123 (نص عادي)`);
  }

  // اعرض كل المستخدمين النهائيين
  const finalUsers = await db.user.findMany();
  console.log('\n📋 المستخدمون النهائيون:');
  for (const u of finalUsers) {
    console.log(`   - ${u.username} / ${u.password} (${u.role})`);
  }

  console.log('\n🎉 يمكنك الآن تسجيل الدخول بـ:');
  console.log('   اسم المستخدم: admin');
  console.log('   كلمة المرور: admin123');
}

main()
  .catch((e) => {
    console.error('❌ خطأ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
