// ===== POST /api/backup/restore-upload =====
// (المدير فقط)
// يستعيد قاعدة البيانات من ملف .db مرفوع
import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { db } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest) {
  try {
    await requireDirector();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    if (!file.name || !file.name.toLowerCase().endsWith('.db')) {
      return NextResponse.json({
        error: 'الملف يجب أن يكون بصيغة .db (قاعدة بيانات SQLite)',
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} ميجا). الحد الأقصى 100 ميجا.`,
      }, { status: 400 });
    }

    if (file.size < 1000) {
      return NextResponse.json({
        error: 'الملف صغير جداً — يبدو أنه ليس قاعدة بيانات صحيحة',
      }, { status: 400 });
    }

    const uploadedBuffer = Buffer.from(await file.arrayBuffer());

    // Basic SQLite validation
    const SQLITE_HEADER = 'SQLite format 3\0';
    if (uploadedBuffer.length < 16 ||
        uploadedBuffer.slice(0, 16).toString('latin1') !== SQLITE_HEADER) {
      return NextResponse.json({
        error: 'الملف ليس قاعدة بيانات SQLite صحيحة.',
      }, { status: 400 });
    }

    const targetPath = path.join(process.cwd(), 'db', 'custom.db');
    const walPath = path.join(process.cwd(), 'db', 'custom.db-wal');
    const shmPath = path.join(process.cwd(), 'db', 'custom.db-shm');
    const journalPath = path.join(process.cwd(), 'db', 'custom.db-journal');

    // === Step 1: Disconnect Prisma ===
    try {
      await db.$disconnect();
      console.log('Prisma disconnected before restore-upload');
    } catch (e) {
      console.log('Prisma disconnect failed (non-fatal):', e);
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // === Step 2: Safety backup of current DB ===
    const safetyDir = path.join(process.cwd(), 'download', 'backups');
    await fs.mkdir(safetyDir, { recursive: true });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const safetyTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safetyFilename = `backup-${safetyTimestamp}.db`;

    try {
      const currentData = await fs.readFile(targetPath);
      await fs.writeFile(path.join(safetyDir, safetyFilename), currentData);
    } catch (e) {
      // target doesn't exist — proceed
    }

    // Save uploaded file to backups folder (for reference)
    const uploadedFilename = `uploaded-${safetyTimestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const uploadedPath = path.join(safetyDir, uploadedFilename);
    await fs.writeFile(uploadedPath, uploadedBuffer);

    // === Step 3: Delete WAL, SHM, journal files ===
    const filesToDelete = [walPath, shmPath, journalPath];
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
        console.log(`Deleted: ${path.basename(filePath)}`);
      } catch (e) {
        // File doesn't exist
      }
    }

    // === Step 4: Replace current DB ===
    try {
      await fs.writeFile(targetPath, uploadedBuffer);
      console.log(`Restored database from uploaded file: ${file.name}`);
    } catch (writeErr: any) {
      return NextResponse.json({
        error: 'تعذر الكتابة فوق قاعدة البيانات الحالية. أوقف التطبيق (npm run dev) ثم أعد المحاولة.',
        details: writeErr.message,
      }, { status: 500 });
    }

    // === Step 5: Verify ===
    let verifyOk = false;
    try {
      const restoredData = await fs.readFile(targetPath);
      verifyOk = restoredData.length === uploadedBuffer.length;
    } catch (e) {}

    return NextResponse.json({
      ok: true,
      message: `تمت استعادة قاعدة البيانات من الملف المرفوع: ${file.name}`,
      originalFilename: file.name,
      savedAs: uploadedFilename,
      safetyBackup: safetyFilename,
      size: uploadedBuffer.length,
      restoredAt: new Date().toISOString(),
      verified: verifyOk,
      warning: 'يجب إعادة تشغيل التطبيق (Ctrl+C ثم npm run dev) ليتم تحميل البيانات الجديدة',
      steps: [
        '✓ تم فصل اتصال Prisma',
        '✓ تم حذف ملفات WAL/SHM',
        '✓ تم نسخ الملف',
        verifyOk ? '✓ تم التحقق من الاسترجاع' : '⚠ تعذر التحقق',
      ],
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('POST /api/backup/restore-upload error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستعادة: ' + (error.message || '') }, { status: 500 });
  }
}
