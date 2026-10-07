/**
 * فحص محتوى كل النسخ الاحتياطية لتحديد أيها يحتوي على بيانات الطلاب
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const DB_DIR = '/home/z/my-project/db';
const BACKUP_DIRS = [
  '/home/z/my-project/db/backups',
  '/home/z/my-project/download/backups',
];

async function inspectDb(dbPath, label) {
  // انسخ الملف إلى ملف مؤقت
  const tempPath = '/tmp/inspect-' + Date.now() + '.db';
  fs.copyFileSync(dbPath, tempPath);

  // استخدم Prisma مع قاعدة البيانات المؤقتة
  process.env.DATABASE_URL = `file:${tempPath}`;
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({
    datasources: { db: { url: `file:${tempPath}` } },
  });

  try {
    const [students, teachers, departments, payments, attendance, tasks, users, leads] = await Promise.all([
      db.student.count().catch(() => -1),
      db.teacher.count().catch(() => -1),
      db.department.count().catch(() => -1),
      db.studentPayment.count().catch(() => -1),
      db.attendance.count().catch(() => -1),
      db.task.count().catch(() => -1),
      db.user.count().catch(() => -1),
      db.lead.count().catch(() => -1),
    ]);

    const size = fs.statSync(dbPath).size;
    const sizeKB = (size / 1024).toFixed(0);

    console.log(`\n📦 ${label}`);
    console.log(`   📁 المسار: ${dbPath}`);
    console.log(`   📏 الحجم: ${sizeKB} KB`);
    console.log(`   👥 الطلاب: ${students >= 0 ? students : 'جدول غير موجود'}`);
    console.log(`   👨‍🏫 الأساتذة: ${teachers >= 0 ? teachers : 'جدول غير موجود'}`);
    console.log(`   🏫 الأقسام: ${departments >= 0 ? departments : 'جدول غير موجود'}`);
    console.log(`   💰 الدفعات: ${payments >= 0 ? payments : 'جدول غير موجود'}`);
    console.log(`   📅 الحضور: ${attendance >= 0 ? attendance : 'جدول غير موجود'}`);
    console.log(`   📋 المهام: ${tasks >= 0 ? tasks : 'جدول غير موجود'}`);
    console.log(`   👤 المستخدمون: ${users >= 0 ? users : 'جدول غير موجود'}`);
    console.log(`   🎯 العملاء المحتملون: ${leads >= 0 ? leads : 'جدول غير موجود'}`);

    // أحدث تاريخ تسجيل طالب
    if (students > 0) {
      try {
        const latest = await db.student.findFirst({
          orderBy: { registrationDate: 'desc' },
          select: { name: true, registrationDate: true },
        });
        if (latest) {
          console.log(`   🕐 آخر تسجيل: ${latest.name} (${latest.registrationDate.toLocaleString('fr-FR')})`);
        }
      } catch {}
    }

    return { label, students, teachers, departments, payments, attendance, size: sizeKB };
  } catch (e) {
    console.log(`\n❌ ${label}: تعذّر الفحص - ${e.message}`);
    return { label, error: e.message };
  } finally {
    await db.$disconnect();
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

async function main() {
  console.log('🔍 فحص كل النسخ الاحتياطية المتاحة');
  console.log('========================================');

  const results = [];

  // 1. قاعدة البيانات الحالية
  if (fs.existsSync(`${DB_DIR}/custom.db`)) {
    results.push(await inspectDb(`${DB_DIR}/custom.db`, 'قاعدة البيانات الحالية'));
  }

  // 2. نسخ db/backups/
  if (fs.existsSync(`${DB_DIR}/backups`)) {
    const files = fs.readdirSync(`${DB_DIR}/backups`).sort().reverse();
    for (const f of files) {
      if (f.endsWith('.db') || f.includes('backup')) {
        results.push(await inspectDb(`${DB_DIR}/backups/${f}`, `نسخة: ${f}`));
      }
    }
  }

  // 3. نسخ download/backups/
  for (const dir of BACKUP_DIRS) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).sort().reverse();
      for (const f of files) {
        if (f.endsWith('.db') || f.includes('backup')) {
          results.push(await inspectDb(`${dir}/${f}`, `نسخة: ${dir.split('/').pop()}/${f}`));
        }
      }
    }
  }

  // 4. ابحث في كل مكان عن ملفات .db
  console.log('\n\n🔍 البحث عن ملفات .db إضافية...');
  const { execSync } = require('child_process');
  try {
    const output = execSync('find /home/z/my-project -name "*.db" -not -path "*/node_modules/*" 2>/dev/null', { encoding: 'utf-8' });
    const allDbs = output.trim().split('\n').filter(Boolean);
    console.log('ملفات .db الموجودة:');
    allDbs.forEach(f => console.log(`  - ${f}`));
  } catch {}

  // 5. التوصية
  console.log('\n\n🎯 التوصية:');
  const withData = results.filter(r => r.students > 0);
  if (withData.length === 0) {
    console.log('❌ لم يتم العثور على أي نسخة تحتوي على بيانات الطلاب!');
  } else {
    // اختر الأكبر من حيث عدد الطلاب
    withData.sort((a, b) => b.students - a.students);
    const best = withData[0];
    console.log(`✅ أفضل نسخة: ${best.label}`);
    console.log(`   تحتوي على ${best.students} طالب`);
    console.log(`   الحجم: ${best.size} KB`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
