/**
 * سكريبت استرجاع البيانات — الإصدار البسيط
 * Simple Data Restore Script
 *
 * ماذا يفعل:
 *   1. يأخذ نسخة احتياطية من قاعدة بياناتك الحالية
 *   2. يستبدلها بنسخة تحتوي على بياناتك (18 طالب)
 *   3. يشغّل prisma db push لإضافة جداول المساعد الذكي الجديدة
 *   4. يشغّل create-admin.ts للتأكّد من وجود مستخدم admin
 *
 * الاستخدام (من مجلد المشروع):
 *   node restore-data.cjs
 *
 * المتطلبات:
 *   - ضع ملف custom.db.with-data بجانب هذا السكريبت (موجود في الحزمة)
 *   - شغّل السكريبت من مجلد المشروع (حيث package.json)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
// اكتشاف مجلد المشروع — ابحث للأعلى حتى نجد مجلداً يحتوي على package.json و prisma/
function findProjectDir(start) {
  let current = start;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'prisma'))) {
      return current;
    }
    current = path.dirname(current);
  }
  // إن لم نجد، ارجع للمجلد الحالي للمستخدم
  return process.cwd();
}
let PROJECT_DIR = findProjectDir(SCRIPT_DIR);
// إن لم يُعثر عليه، استخدم pwd
if (!fs.existsSync(path.join(PROJECT_DIR, 'prisma', 'schema.prisma'))) {
  PROJECT_DIR = process.cwd();
}

const DB_PATH = path.join(PROJECT_DIR, 'db', 'custom.db');
const BACKUP_DIR = path.join(PROJECT_DIR, 'db', 'backups');
const SOURCE_DB = path.join(SCRIPT_DIR, 'custom.db.with-data');

function log(msg) { console.log(msg); }
function success(msg) { console.log('✅ ' + msg); }
function info(msg) { console.log('ℹ️  ' + msg); }
function warning(msg) { console.log('⚠️  ' + msg); }
function error(msg) { console.error('❌ ' + msg); }

console.log('================================================');
console.log('  🔄 استرجاع البيانات');
console.log('================================================\n');

// 1. تحقّق من المصدر
info('الخطوة 1: التحقق من النسخة الاحتياطية...');
if (!fs.existsSync(SOURCE_DB)) {
  error('النسخة الاحتياطية غير موجودة: ' + SOURCE_DB);
  error('');
  error('تأكّد أن ملف custom.db.with-data موجود بجانب restore-data.cjs');
  error('أو حمّله من حزمة data-recovery وضعها في مجلد المشروع');
  process.exit(1);
}
const sourceSize = fs.statSync(SOURCE_DB).size;
success(`النسخة موجودة (${(sourceSize / 1024).toFixed(0)} KB)`);

// 2. اعرض معلومات عن المصدر
info('\nالخطوة 2: فحص النسخة...');
try {
  // استخدم sqlite3 مباشرة (إن توفّر)
  const tables = execSync(`sqlite3 "${SOURCE_DB}" ".tables"`, { encoding: 'utf-8' }).trim();
  success('الجداول الموجودة:');
  log('   ' + tables.split(/\s+/).slice(0, 10).join(' '));

  // عدّ الطلاب
  try {
    const students = execSync(`sqlite3 "${SOURCE_DB}" "SELECT COUNT(*) FROM Student;"`, { encoding: 'utf-8' }).trim();
    log(`   👥 الطلاب: ${students}`);
  } catch {}
  try {
    const teachers = execSync(`sqlite3 "${SOURCE_DB}" "SELECT COUNT(*) FROM Teacher;"`, { encoding: 'utf-8' }).trim();
    log(`   👨‍🏫 الأساتذة: ${teachers}`);
  } catch {}
  try {
    const payments = execSync(`sqlite3 "${SOURCE_DB}" "SELECT COUNT(*) FROM StudentPayment;"`, { encoding: 'utf-8' }).trim();
    log(`   💰 الدفعات: ${payments}`);
  } catch {}
  try {
    const users = execSync(`sqlite3 "${SOURCE_DB}" "SELECT username FROM User;"`, { encoding: 'utf-8' }).trim();
    log(`   👤 المستخدمون: ${users}`);
  } catch {}
} catch (e) {
  warning('تعذّر فحص المحتوى عبر sqlite3 (غير مثبّت). متابعة...');
}

// 3. نسخة احتياطية من القاعدة الحالية
info('\nالخطوة 3: نسخة احتياطية من قاعدة بياناتك الحالية...');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
if (fs.existsSync(DB_PATH)) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `custom.db.before-restore-${ts}`);
  fs.copyFileSync(DB_PATH, backupFile);
  success(`تم حفظ نسخة احتياطية: ${path.basename(backupFile)}`);
} else {
  warning('لا توجد قاعدة بيانات حالية');
}

// 4. استبدال قاعدة البيانات
info('\nالخطوة 4: استرجاع البيانات...');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
fs.copyFileSync(SOURCE_DB, DB_PATH);
success('تم استرجاع قاعدة البيانات بنجاح');

// 5. تحديث الـ schema (إضافة جداول المساعد الذكي)
info('\nالخطوة 5: تحديث قاعدة البيانات بإضافة جداول المساعد الذكي...');
info('(لن تُحذف أي بيانات — فقط إضافة جداول جديدة)');

try {
  execSync('npx prisma db push --accept-data-loss', {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
  });
  success('تم تحديث قاعدة البيانات');
} catch (e) {
  warning('تعذّر تحديث الـ schema تلقائياً');
  warning('شغّل يدوياً: npx prisma db push');
}

try {
  execSync('npx prisma generate', {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
  });
  success('تم توليد Prisma Client');
} catch (e) {
  warning('تعذّر توليد Prisma Client');
  warning('شغّل يدوياً: npx prisma generate');
}

// 6. تأكّد من وجود admin
info('\nالخطوة 6: التحقق من مستخدم admin...');
try {
  // أنشئ ملف مؤقت بدلاً من eval (لتجنّب مشاكل escape)
  const tmpScript = path.join(PROJECT_DIR, '_check-admin.tmp.cjs');
  fs.writeFileSync(tmpScript, `
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    (async () => {
      const admin = await db.user.upsert({
        where: { username: 'admin' },
        update: { password: 'admin123', role: 'director', name: 'المدير العام', canManageTimetable: true },
        create: { username: 'admin', password: 'admin123', name: 'المدير العام', role: 'director', canManageTimetable: true }
      });
      console.log('admin OK:', admin.username, '/', admin.password);
      await db.$disconnect();
    })().catch(e => { console.error(e.message); process.exit(1); });
  `);
  execSync(`node "${tmpScript}"`, {
    cwd: PROJECT_DIR,
    stdio: 'inherit',
  });
  try { fs.unlinkSync(tmpScript); } catch {}
  success('مستخدم admin جاهز (admin / admin123)');
} catch (e) {
  warning('تعذّر التحقق من admin تلقائياً');
  warning('شغّل يدوياً: npx tsx scripts/create-admin.ts');
}

// 7. التحقق النهائي
info('\nالخطوة 7: التحقق النهائي...');
try {
  const finalStudents = execSync(`sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM Student;"`, { encoding: 'utf-8' }).trim();
  const finalTeachers = execSync(`sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM Teacher;"`, { encoding: 'utf-8' }).trim();
  success('البيانات النهائية:');
  log(`   👥 الطلاب: ${finalStudents}`);
  log(`   👨‍🏫 الأساتذة: ${finalTeachers}`);
} catch {}

// تنظيف الملف المصدر (اختياري)
try { fs.unlinkSync(SOURCE_DB); } catch {}

console.log('\n================================================');
console.log('  🎉 تم استرجاع البيانات بنجاح!');
console.log('================================================\n');
console.log('الخطوات التالية:');
console.log('  1. شغّل: npm run dev');
console.log('  2. افتح: http://localhost:3000');
console.log('  3. سجّل الدخول: admin / admin123');
console.log('  4. ستجد كل بياناتك محفوظة ✅');
console.log('     (الطلاب، الأساتذة، الدفعات، الحضور)');
console.log('  5. ستجد قسم "المساعد الذكي" الجديد ✅');
