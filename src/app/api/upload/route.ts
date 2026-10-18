import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * POST /api/upload
 * رفع ملف (صورة أو مستند) وإرجاع رابط الوصول إليه
 *
 * - في بيئة التطوير (dev): يحفظ في public/uploads/
 * - في Vercel: يستخدم @vercel/blob إذا كان مثبتاً، وإلا يعيد 503
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

    // تحقق من حجم الملف (20MB أقصى حد)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (الحد الأقصى 20MB)' }, { status: 413 });
    }

    // تحقق من نوع الملف (صور ومستندات فقط)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `نوع الملف غير مسموح: ${file.type}` }, { status: 415 });
    }

    // محاولة استخدام Vercel Blob أولاً (للإنتاج)
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import('@vercel/blob');
        const filename = `${randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const blob = await put(filename, file, {
          access: 'public',
          addRandomSuffix: true,
        });
        return NextResponse.json({
          url: blob.url,
          filename: blob.pathname,
          size: file.size,
        });
      } catch (e: any) {
        console.error('Vercel Blob upload failed, falling back to local:', e?.message || e);
        // متابعة إلى التخزين المحلي
      }
    }

    // التخزين المحلي (للتطوير المحلي)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || (file.type === 'image/jpeg' ? '.jpg' : file.type === 'image/png' ? '.png' : '');
    const filename = `${randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, filename);
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      filename,
      size: file.size,
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
