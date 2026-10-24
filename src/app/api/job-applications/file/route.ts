// ===== POST /api/job-applications/file =====
// رفع ملف (دبلوم أو سيرة ذاتية)
// نفس نمط /api/upload و /api/documents (fs.writeFile محلياً)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }

    // قيود الحجم (20 MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد الأقصى 20MB`,
      }, { status: 413 });
    }

    // الأنواع المسموحة
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed',
    ];
    // إذا كان نوع MIME غير معروف، اسمح به إذا كان امتداد صورة/PDF/Word
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'].includes(ext);
    if (!allowedTypes.includes(file.type) && !validExt) {
      return NextResponse.json({
        error: `نوع الملف غير مدعوم: ${file.type || 'غير معروف'} (.${ext})`,
      }, { status: 415 });
    }

    // اسم فريد للملف
    const finalExt = ext || (file.type === 'application/pdf' ? 'pdf' : 'bin');
    const filename = `${randomUUID()}.${finalExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jobs');

    // أنشئ المجلد إن لم يكن موجوداً
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    // اكتب الملف
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    // أعد الرابط العام
    const url = `/uploads/jobs/${filename}`;
    return NextResponse.json({ url, filename });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول' }, { status: 401 });
    }
    console.error('POST /api/job-applications/file error:', error);
    return NextResponse.json(
      { error: 'فشل رفع الملف', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
