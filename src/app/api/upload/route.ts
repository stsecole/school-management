import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/upload
 * رفع ملف (صورة أو مستند) وإرجاع رابط الوصول إليه
 *
 * - على Vercel: يستخدم @vercel/blob (يجب ربط Vercel Blob Store وضبط BLOB_READ_WRITE_TOKEN)
 * - في التطوير المحلي: يحفظ في public/uploads/
 *
 * Body: multipart/form-data مع حقل "file"
 * Returns: { url: string, filename: string, size: number }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'ملف مطلوب' }, { status: 400 });
    }

    // تحقق من حجم الملف (50MB أقصى حد)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (الحد الأقصى 50MB)' }, { status: 413 });
    }

    // تحقق من نوع الملف (قائمة موسّعة)
    const allowedTypes = [
      // صور
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'image/bmp', 'image/svg+xml', 'image/tiff', 'image/heic', 'image/heif',
      // مستندات
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // نصوص
      'text/plain', 'text/csv',
      // أرشيف
      'application/zip', 'application/x-zip-compressed',
    ];
    // إذا لم يكن نوع الملف معروفاً (شائع للصور من الموبايل)، نسمح به إذا كان extension صورة
    const ext = path.extname(file.name).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.heic', '.heif'];
    const isAllowedType = allowedTypes.includes(file.type) || (imageExtensions.includes(ext) && file.type.startsWith('image/'));

    if (!isAllowedType) {
      return NextResponse.json({
        error: `نوع الملف غير مسموح: ${file.type || 'غير معروف'} (امتداد: ${ext})`,
      }, { status: 415 });
    }

    // === 1) محاولة Vercel Blob أولاً ===
    // @vercel/blob يعمل تلقائياً إذا كان BLOB_READ_WRITE_TOKEN مضبوطاً
    try {
      const { put } = await import('@vercel/blob');
      const safeName = file.name.replace(/[^\w.-]/g, '_').slice(0, 100);
      const filename = `${randomUUID()}-${safeName}`;
      const blob = await put(filename, file, {
        access: 'public',
        addRandomSuffix: true,
        allowOverwrite: false,
      });
      return NextResponse.json({
        url: blob.url,
        filename: blob.pathname,
        size: file.size,
        provider: 'vercel-blob',
      });
    } catch (blobErr: any) {
      // إذا فشل Vercel Blob، نحاول التخزين المحلي
      const errMsg = (blobErr?.message || String(blobErr)).toLowerCase();
      const isNoToken = errMsg.includes('token') || errMsg.includes('unauthorized') || errMsg.includes('not configured');

      console.error('Vercel Blob upload failed:', blobErr?.message || blobErr);

      // على Vercel، لا يمكن استخدام التخزين المحلي (نظام الملفات read-only)
      if (process.env.VERCEL || process.env.NOW_REGION) {
        return NextResponse.json({
          error: isNoToken
            ? 'خدمة رفع الملفات غير مُعدّة. اربط Vercel Blob Store واحصل على BLOB_READ_WRITE_TOKEN من لوحة تحكم Vercel.'
            : 'فشل رفع الملف إلى Vercel Blob',
          details: blobErr?.message || String(blobErr),
          hint: isNoToken ? 'https://vercel.com/docs/storage/vercel-blob' : undefined,
        }, { status: 503 });
      }
      // في التطوير المحلي: استخدم التخزين المحلي
    }

    // === 2) التخزين المحلي (للتطوير المحلي فقط) ===
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeExt = ext || (file.type === 'image/jpeg' ? '.jpg' : file.type === 'image/png' ? '.png' : '');
    const localFilename = `${randomUUID()}${safeExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, localFilename);
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({
      url: `/uploads/${localFilename}`,
      filename: localFilename,
      size: file.size,
      provider: 'local',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/upload error:', error);
    return NextResponse.json(
      { error: 'فشل رفع الملف', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
