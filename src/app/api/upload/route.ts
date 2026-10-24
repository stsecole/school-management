import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// POST /api/upload - upload a file (image, PDF, or document)
// Used by:
// - students-section: student photos
// - institution-settings: institution logo
// - student-cards-section: student card photos
// - job-applications-section: CV and diploma files

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

    // الأنواع المسموحة (صور + PDF + وثائق Word/Excel + نصوص)
    const allowedTypes = [
      // صور
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
      // PDF
      'application/pdf',
      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // نص
      'text/plain', 'text/csv',
      // أرشيف
      'application/zip', 'application/x-zip-compressed',
    ];

    // إذا كان نوع MIME غير معروف (شائع من الموبايل)، تحقق من الامتداد
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip'].includes(ext);

    if (!allowedTypes.includes(file.type) && !validExt) {
      return NextResponse.json(
        { error: `نوع الملف غير مدعوم: ${file.type || 'غير معروف'} (.${ext}). المدعوم: صور، PDF، Word، Excel` },
        { status: 400 }
      );
    }

    // قيود الحجم (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد الأقصى 20MB` },
        { status: 400 }
      );
    }

    // اسم فريد للملف
    const finalExt = ext || (file.type === 'application/pdf' ? 'pdf' : 'bin');
    const filename = `${randomUUID()}.${finalExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');

    // أنشئ المجلد إن لم يكن موجوداً
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    // اكتب الملف
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    // أعد الرابط العام
    const url = `/uploads/${filename}`;
    return NextResponse.json({ url, filename });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء رفع الملف: ' + (error.message || '') }, { status: 500 });
  }
}
