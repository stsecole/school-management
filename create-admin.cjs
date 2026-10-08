const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // كلمة المرور مشفّرة مسبقاً = "admin123"
  // باستخدام bcrypt (القيمة الافتراضية للمشروع)
  const hashedPassword = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword, role: 'director' },
    create: {
      id: 'admin_001',
      username: 'admin',
      password: hashedPassword,
      name: 'المدير العام',
      role: 'director',
    },
  });

  console.log('✅ تم إنشاء حساب المدير بنجاح:', admin.username);
  console.log('🔐 بيانات الدخول:');
  console.log('   Username: admin');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ خطأ:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });