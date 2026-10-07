// ===== POST /api/backup/restore =====
// (المدير فقط)
// يستعيد قاعدة البيانات من نسخة احتياطية محددة
// Body: { filename: string }
// - يأخذ نسخة احتياطية من القاعدة الحالية أولاً (للأمان)
// - ثم ينسخ النسخة المحددة إلى db/custom.db
import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const { filename } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'اسم الملف مطلوب' }, { status: 400 });
    }

    // Validate filename (prevent path traversal) — accept all backup types
    // backup-YYYYMMDD-HHMMSS.db (legacy) OR backup-{PREFIX}-YYYYMMDD-HHMMSS.db (new with branch)
    // OR uploaded-*.db OR backup-cloud-*.db
    if (!/^backup-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^backup-[a-zA-Z0-9_]+-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^uploaded-.+\.db$/.test(filename) &&
        !/^backup-cloud-.+\.db$/.test(filename)) {
      return NextResponse.json({ error: 'اسم الملف غير صالح' }, { status: 400 });
    }

    const sourcePath = path.join(process.cwd(), 'download', 'backups', filename);
    const targetPath = path.join(process.cwd(), 'db', 'custom.db');

    // Verify source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return NextResponse.json({ error: 'النسخة الاحتياطية غير موجودة' }, { status: 404 });
    }

    // === Safety: create a backup of the current DB before restoring ===
    try {
      await fs.access(targetPath);
      const safetyDir = path.join(process.cwd(), 'download', 'backups');
      await fs.mkdir(safetyDir, { recursive: true });
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const safetyTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const safetyFilename = `backup-${safetyTimestamp}.db`;
      const currentData = await fs.readFile(targetPath);
      await fs.writeFile(path.join(safetyDir, safetyFilename), currentData);
      // Note: cleanup of old backups is handled by /api/backup/run
    } catch (e) {
      // target doesn't exist — proceed with restore
    }

    // === Stop the running app's Prisma connection (best effort) ===
    // Note: We can't actually close the connection from here, but Prisma will
    // reconnect when accessing the new file. On Windows, the file might be locked.
    // Users should stop the app, restore, then restart.
    try {
      // Just attempt to copy. If it fails because of lock, we'll inform the user.
      const backupData = await fs.readFile(sourcePath);
      await fs.writeFile(targetPath, backupData);
    } catch (writeErr: any) {
      return NextResponse.json({
        error: 'تعذر الكتابة فوق قاعدة البيانات الحالية. قد تكون قيد الاستخدام. أوقف التطبيق (npm run dev) ثم أعد المحاولة.',
        details: writeErr.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `تمت استعادة النسخة الاحتياطية: ${filename}`,
      filename,
      restoredAt: new Date().toISOString(),
      warning: 'يجب إعادة تشغيل التطبيق (Ctrl+C ثم npm run dev) ليتم تحميل البيانات الجديدة',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('POST /api/backup/restore error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستعادة: ' + (error.message || '') }, { status: 500 });
  }
}
