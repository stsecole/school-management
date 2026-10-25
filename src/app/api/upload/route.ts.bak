import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';

// POST /api/upload - upload a file
// بدلاً من الكتابة على القرص (read-only على Vercel)، نخزّن الملف في قاعدة البيانات
// يُستخدم من:
// - students-section: صور الطلاب
// - institution-settings: شعار المؤسسة
// - student-cards-section: صور البطاقات
// - job-applications-section: السيرة الذاتية + الدبلوم

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

    // الأنواع المسموحة (صور + PDF + وثائق Word/Excel + نص + zip)
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

    // اقرأ محتوى الملف
    const buffer = Buffer.from(await file.arrayBuffer());

    // خزّن في قاعدة البيانات (يعمل على Vercel بدون إعداد إضافي)
    const uploaded = await db.uploadedFile.create({
      data: {
        content: buffer,
        fileName: file.name || `file-${Date.now()}.${ext}`,
        mimeType: file.type || null,
        size: file.size,
        branchId: await getBranchIdForNewRecord(),
      },
    });

    // الرابط العام: يقرأ من DB عبر /api/file/[id]
    const url = `/api/file/${uploaded.id}`;

    return NextResponse.json({
      url,
      filename: uploaded.fileName,
      fileId: uploaded.id,
      size: file.size,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء رفع الملف: ' + (error.message || ''),
    }, { status: 500 });
  }
}
