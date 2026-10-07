import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * POST /api/backup/run
 * (المدير فقط)
 * ينسخ قاعدة البيانات db/custom.db إلى download/backups/ باسم يحتوي على الطابع الزمني
 * يحتفظ بآخر 10 نسخ احتياطية فقط
 */
export async function POST() {
  try {
    await requireDirector();

    const sourcePath = path.join(process.cwd(), 'db', 'custom.db');
    const backupDir = path.join(process.cwd(), 'download', 'backups');

    // التأكد من وجود المجلد
    await fs.mkdir(backupDir, { recursive: true });

    // التحقق من وجود الملف المصدر
    try {
      await fs.access(sourcePath);
    } catch {
      return NextResponse.json({ error: 'قاعدة البيانات غير موجودة' }, { status: 404 });
    }

    // إنشاء اسم الملف بالطابع الزمني
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup-${timestamp}.db`;
    const destPath = path.join(backupDir, filename);

    // نسخ الملف
    const data = await fs.readFile(sourcePath);
    await fs.writeFile(destPath, data);

    const size = (await fs.stat(destPath)).size;

    // الاحتفاظ بآخر 10 نسخ فقط
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.db'));
    // ترتيب تنازلي حسب الاسم (الطابع الزمني)
    backupFiles.sort().reverse();
    const toDelete = backupFiles.slice(10);
    for (const f of toDelete) {
      try {
        await fs.unlink(path.join(backupDir, f));
      } catch {
        // تجاهل أخطاء الحذف
      }
    }

    return NextResponse.json({
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      filename,
      size,
      createdAt: now.toISOString(),
      deletedOld: toDelete.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('POST /api/backup/run error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء النسخ الاحتياطي' }, { status: 500 });
  }
}
