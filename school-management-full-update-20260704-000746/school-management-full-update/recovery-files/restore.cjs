/**
 * سكريبت استرجاع البيانات الكامل — مع كل الميزات (AI + CRM + Exams)
 * يُصلح .env + يسترجع البيانات + يتأكّد من وجود كل الجداول
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
const SOURCE_DB = path.join(SCRIPT_DIR, 'custom.db.complete');
const ENV_FILE = path.join(PROJECT_DIR, '.env');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

console.log('================================================');
console.log('  🔄 استرجاع البيانات الكامل (مع AI + CRM + Exams)');
console.log('================================================\n');

console.log('مجلد المشروع:', PROJECT_DIR);
console.log('');

// 1. تحقّق من ملف المصدر
if (!fs.existsSync(SOURCE_DB)) {
  console.log('❌ لم أجد custom.db.complete في:', SOURCE_DB);
  console.log('   حمّل الملف من الحزمة وضعه في recovery-files/');
  process.exit(1);
}
console.log('✅ ملف الاسترجاع موجود');

// 2. أصلح ملف .env
console.log('\n--- إصلاح ملف .env ---');
const correctEnv = 'DATABASE_URL="file:./db/custom.db"\n';
try {
  if (fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(ENV_FILE + '.old', fs.readFileSync(ENV_FILE, 'utf-8'));
  }
  fs.writeFileSync(ENV_FILE, correctEnv, 'utf-8');
  console.log('✅ تم إصلاح .env');
  console.log('   DATABASE_URL="file:./db/custom.db"');
} catch (e) {
  console.log('❌ تعذّر إصلاح .env:', e.message);
}

// 3. أنشئ مجلد db
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
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

// 5. احذف أي قاعدة بيانات خاطئة في مسار Linux
const wrongPaths = [
  'C:\\home\\z\\my-project\\db\\custom.db',
  '/home/z/my-project/db/custom.db',
];
for (const wp of wrongPaths) {
  if (fs.existsSync(wp)) {
    try {
      fs.unlinkSync(wp);
      console.log('✅ حذفت قاعدة بيانات خاطئة:', wp);
    } catch {}
  }
}
// احذف مجلد home إن وُجد (مما يسبب مشاكل)
const wrongHomeDir = path.join(PROJECT_DIR, 'home');
if (fs.existsSync(wrongHomeDir)) {
  try {
    fs.rmSync(wrongHomeDir, { recursive: true, force: true });
    console.log('✅ حذفت مجلد home الخاطئ');
  } catch {}
}

// 6. استبدل قاعدة البيانات
try { fs.unlinkSync(DB_FILE); } catch {}
fs.copyFileSync(SOURCE_DB, DB_FILE);
console.log('✅ تم استبدال قاعدة البيانات');

// 7. شغّل prisma db push (لإضافة أي جداول ناقصة)
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

// 8. تحقق من البيانات + admin
console.log('\n--- التحقق من البيانات ---');
const verifyScript = `
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  try {
    console.log('   الطلاب:', await db.student.count());
    console.log('   الأساتذة:', await db.teacher.count());
    console.log('   الأقسام:', await db.department.count());
    console.log('   الدفعات:', await db.studentPayment.count());
    console.log('   الحضور:', await db.attendance.count());
    console.log('   المهام:', await db.task.count());

    // تحقق من الجداول الجديدة
    console.log('   محادثات AI:', await db.aIConversation.count());
    console.log('   العملاء المحتملون (CRM):', await db.lead.count());
    console.log('   الامتحانات:', await db.exam.count());

    // تأكّد من admin
    const admin = await db.user.upsert({
      where: { username: 'admin' },
      update: { password: 'admin123', role: 'director', name: 'المدير العام', canManageTimetable: true },
      create: { username: 'admin', password: 'admin123', name: 'المدير العام', role: 'director', canManageTimetable: true }
    });
    console.log('   admin:', admin.username, '/', admin.password);

    console.log('\\n✅ كل البيانات والجداول موجودة!');
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
console.log('  4. ستجد كل البيانات + كل الميزات (AI + CRM + Exams)');
console.log('');
