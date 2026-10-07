/**
 * سكريبت استرجاع البيانات الموثوق
 * يُصلح ملف .env تلقائياً + يسترجع البيانات + ينشئ admin
 *
 * الاستخدام: node recovery-files/restore.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const PROJECT_DIR = path.dirname(SCRIPT_DIR);
const DB_DIR = path.join(PROJECT_DIR, 'db');
const DB_FILE = path.join(DB_DIR, 'custom.db');
const SOURCE_DB = path.join(SCRIPT_DIR, 'custom.db.with-data');
const ENV_FILE = path.join(PROJECT_DIR, '.env');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

console.log('================================================');
console.log('  🔄 استرجاع البيانات (الإصدار الموثوق)');
console.log('================================================\n');

console.log('مجلد المشروع:', PROJECT_DIR);
console.log('مجلد قاعدة البيانات:', DB_DIR);
console.log('');

// 1. تحقّق من ملف المصدر
if (!fs.existsSync(SOURCE_DB)) {
  console.log('❌ لم أجد custom.db.with-data في:', SOURCE_DB);
  process.exit(1);
}
console.log('✅ ملف الاسترجاع موجود');

// 2. أصلح ملف .env أولاً (المشكلة الرئيسية!)
console.log('\n--- إصلاح ملف .env ---');
const correctEnv = 'DATABASE_URL="file:./db/custom.db"\n';
try {
  // احفظ النسخة القديمة
  if (fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(ENV_FILE + '.old', fs.readFileSync(ENV_FILE, 'utf-8'));
  }
  fs.writeFileSync(ENV_FILE, correctEnv, 'utf-8');
  console.log('✅ تم إصلاح .env');
  console.log('   DATABASE_URL="file:./db/custom.db"');
} catch (e) {
  console.log('❌ تعذّر إصلاح .env:', e.message);
  console.log('   أصلحه يدوياً: DATABASE_URL="file:./db/custom.db"');
}

// 3. أنشئ مجلد db إن لم يوجد
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log('✅ تم إنشاء مجلد db');
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 4. خذ نسخة احتياطية من القاعدة الحالية
if (fs.existsSync(DB_FILE)) {
  const ts = Date.now();
  const backup = path.join(BACKUP_DIR, `custom.db.backup-${ts}`);
  fs.copyFileSync(DB_FILE, backup);
  console.log('✅ نسخة احتياطية:', path.basename(backup));
}

// 5. احذف قاعدة البيانات الحالية وانقل الجديدة
try { fs.unlinkSync(DB_FILE); } catch {}
fs.copyFileSync(SOURCE_DB, DB_FILE);
console.log('✅ تم استبدال قاعدة البيانات');

// 6. احذف قاعدة البيانات الخاطئة في المسار القديم (إن وُجدت)
const wrongPaths = [
  path.join(PROJECT_DIR, 'home', 'z', 'my-project', 'db', 'custom.db'),
  'C:\\home\\z\\my-project\\db\\custom.db',
];
for (const wp of wrongPaths) {
  if (fs.existsSync(wp)) {
    try {
      fs.unlinkSync(wp);
      console.log('✅ حذفت قاعدة بيانات خاطئة:', wp);
    } catch {}
  }
}

// 7. شغّل prisma db push
console.log('\n--- تحديث قاعدة البيانات ---');
try {
  execSync('npx prisma db push --accept-data-loss', {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
  });
  console.log('✅ تم تحديث الـ schema');
} catch (e) {
  console.log('⚠️  تعذّر prisma db push. شغّل يدوياً: npx prisma db push');
}

try {
  execSync('npx prisma generate', {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
  });
  console.log('✅ تم توليد Prisma Client');
} catch (e) {
  console.log('⚠️  تعذّر prisma generate. شغّل يدوياً: npx prisma generate');
}

// 8. تأكّد من وجود admin + اعرض الإحصائيات
console.log('\n--- التحقق من البيانات ---');
const verifyScript = `
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  try {
    const students = await db.student.count();
    const teachers = await db.teacher.count();
    const payments = await db.studentPayment.count();
    const attendance = await db.attendance.count();
    const users = await db.user.count();
    console.log('   الطلاب:', students);
    console.log('   الأساتذة:', teachers);
    console.log('   الدفعات:', payments);
    console.log('   الحضور:', attendance);
    console.log('   المستخدمون:', users);

    // تأكّد من admin
    const admin = await db.user.upsert({
      where: { username: 'admin' },
      update: { password: 'admin123', role: 'director', name: 'المدير العام', canManageTimetable: true },
      create: { username: 'admin', password: 'admin123', name: 'المدير العام', role: 'director', canManageTimetable: true }
    });
    console.log('   admin:', admin.username, '/', admin.password);

    if (students === 0) {
      console.log('\\n⚠️  قاعدة البيانات فارغة! تحقق من ملف .env');
      console.log('   المحتوى الحالي:', process.env.DATABASE_URL || 'غير محدد');
    } else {
      console.log('\\n✅ البيانات موجودة!');
    }
  } catch (e) {
    console.error('خطأ:', e.message);
  }
  await db.$disconnect();
})();
`;
const tmpFile = path.join(PROJECT_DIR, '_verify.tmp.cjs');
fs.writeFileSync(tmpFile, verifyScript);
try {
  execSync(`node "${tmpFile}"`, { cwd: PROJECT_DIR, stdio: 'inherit' });
} catch {}
try { fs.unlinkSync(tmpFile); } catch {}

console.log('\n================================================');
console.log('  🎉 تم! الخطوات التالية:');
console.log('================================================');
console.log('  1. npm run dev');
console.log('  2. افتح: http://localhost:3000');
console.log('  3. الدخول: admin / admin123');
console.log('');
