// ===== POST /api/job-applications/upload =====
// رفع ملف (PDF, JPEG, PNG) لطلب عمل
// يحفظ الملف في public/uploads/jobs/ ويرجع URL
// + ينسخ الملف أيضاً إلى download/backups/ كنسخة احتياطية

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg', '.png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    if (!file.name) {
      return NextResponse.json({ error: 'اسم الملف مفقود' }, { status: 400 });
    }

    const fileExt = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({
        error: `صيغة الملف غير مدعومة. الصيغ المسموحة: ${ALLOWED_EXTENSIONS.join(', ')}`,
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} ميجا). الحد الأقصى 10 ميجا.`,
      }, { status: 400 });
    }

    if (file.size < 100) {
      return NextResponse.json({ error: 'الملف صغير جداً — يبدو أنه فارغ' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Validate PDF header
    if (fileExt === '.pdf') {
      if (fileBuffer.length < 5 || fileBuffer.slice(0, 5).toString('latin1') !== '%PDF-') {
        return NextResponse.json({ error: 'الملف ليس PDF صحيح' }, { status: 400 });
      }
    }

    // Validate PNG header
    if (fileExt === '.png') {
      const PNG_HEADER = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      if (fileBuffer.length < 8 || !PNG_HEADER.every((b, i) => fileBuffer[i] === b)) {
        return NextResponse.json({ error: 'الملف ليس PNG صحيح' }, { status: 400 });
      }
    }

    // Validate JPEG header
    if (fileExt === '.jpg' || fileExt === '.jpeg') {
      if (fileBuffer.length < 3 || fileBuffer[0] !== 0xFF || fileBuffer[1] !== 0xD8 || fileBuffer[2] !== 0xFF) {
        return NextResponse.json({ error: 'الملف ليس JPEG صحيح' }, { status: 400 });
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
    const filename = `${timestamp}-${randomStr}-${safeName}`;

    // حفظ في public/uploads/jobs/ (للمعاينة المباشرة)
    const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', 'jobs');
    await fs.mkdir(publicUploadDir, { recursive: true });
    const publicFilePath = path.join(publicUploadDir, filename);
    await fs.writeFile(publicFilePath, fileBuffer);

    // أيضاً حفظ نسخة في download/job-files/ (كـ fallback للمعاينة عبر API)
    const apiUploadDir = path.join(process.cwd(), 'download', 'job-files');
    await fs.mkdir(apiUploadDir, { recursive: true });
    const apiFilePath = path.join(apiUploadDir, filename);
    await fs.writeFile(apiFilePath, fileBuffer);

    // إرجاع URL باستخدام API endpoint (أكثر موثوقية من المسار المباشر)
    const fileUrl = `/api/job-applications/file?path=uploads/jobs/${filename}`;

    return NextResponse.json({
      ok: true,
      message: 'تم رفع الملف بنجاح',
      filename,
      originalName: file.name,
      fileUrl,
      directUrl: `/uploads/jobs/${filename}`, // للمعاينة المباشرة (fallback)
      fileSize: fileBuffer.length,
      fileType: fileExt.replace('.', '').toLowerCase(),
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error('POST /api/job-applications/upload error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء رفع الملف: ' + (error.message || ''),
    }, { status: 500 });
  }
}

