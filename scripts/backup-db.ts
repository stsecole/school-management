/**
 * نسخ احتياطي تلقائي لقاعدة البيانات
 * - ينسخ ملف SQLite إلى مجلد download/backups/
 * - يحتفظ بآخر 10 نسخ فقط (يحذف الأقدم)
 * - يضغط النسخة بـ gzip لتوفير المساحة
 *
 * التشغيل اليدوي: bunx tsx scripts/backup-db.ts
 * التشغيل التلقائي: يُستدعى من API /api/backup/run
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

const db = new PrismaClient();
const DB_PATH = '/home/z/my-project/db/custom.db';
const BACKUP_DIR = '/home/z/my-project/download/backups';
const MAX_BACKUPS = 10;

async function backupDatabase() {
  console.log('🔄 بدء النسخ الاحتياطي...');

  // التأكد من وجود مجلد النسخ
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`  ✓ تم إنشاء مجلد النسخ: ${BACKUP_DIR}`);
  }

  // التحقق من وجود قاعدة البيانات
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`قاعدة البيانات غير موجودة: ${DB_PATH}`);
  }

  // إنشاء اسم الملف بالتاريخ
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T').join('_');
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const backupFileName = `backup_${dateStr}_${timeStr}.db.gz`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  // أخذ معلومات الإحصائيات قبل النسخ
  const stats = await db.$transaction([
    db.student.count(),
    db.teacher.count(),
    db.department.count(),
    db.studentPayment.count(),
    db.attendance.count(),
    db.task.count(),
    db.user.count(),
  ]);

  const summary = {
    students: stats[0],
    teachers: stats[1],
    departments: stats[2],
    studentPayments: stats[3],
    attendances: stats[4],
    tasks: stats[5],
    users: stats[6],
  };

  // نسخ الملف مع الضغط
  const sourceStream = fs.createReadStream(DB_PATH);
  const destStream = fs.createWriteStream(backupPath);
  const gzip = createGzip();

  await pipeline(sourceStream, gzip, destStream);

  const fileSize = fs.statSync(backupPath).size;
  console.log(`  ✓ تم إنشاء نسخة احتياطية: ${backupFileName}`);
  console.log(`    الحجم: ${(fileSize / 1024).toFixed(2)} KB`);

  // حفظ ملف معلومات النسخة
  const metaPath = backupPath.replace('.db.gz', '.meta.json');
  const meta = {
    filename: backupFileName,
    createdAt: now.toISOString(),
    size: fileSize,
    stats: summary,
    version: '1.0',
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  // تنظيف النسخ القديمة (الاحتفاظ بآخر MAX_BACKUPS فقط)
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.db.gz'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      fs.unlinkSync(f.path);
      // حذف ملف المعلومات أيضاً
      const metaFile = f.path.replace('.db.gz', '.meta.json');
      if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
      console.log(`  🗑️ تم حذف نسخة قديمة: ${f.name}`);
    }
  }

  console.log(`✅ اكتمل النسخ الاحتياطي بنجاح`);
  console.log(`   الإحصائيات: ${summary.students} طالب، ${summary.teachers} أستاذ، ${summary.studentPayments} دفعة`);

  await db.$disconnect();
  return { filename: backupFileName, path: backupPath, size: fileSize, stats: summary, createdAt: now.toISOString() };
}

// تشغيل مباشر إذا استُدعى من سطر الأوامر
if (require.main === module) {
  backupDatabase()
    .then((result) => {
      console.log('\n📦 ملخص النسخة:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error('❌ فشل النسخ الاحتياطي:', e);
      process.exit(1);
    });
}

export { backupDatabase };
