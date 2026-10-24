// ===== POST /api/job-applications/file =====
// رفع ملف (دبلوم أو سيرة ذاتية) — يستخدم Vercel Blob أو التخزين المحلي

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
      return NextResponse.json({
        error: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد الأقصى 20MB`,
      }, { status: 413 });
    }

    // قائمة موسعة من أنواع الملفات المسموحة
    const allowedTypes = [
      // PDF
      'application/pdf',
      // صور
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
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

    // إذا كان نوع الملف غير معروف، اسمح به إذا كان امتداد صورة/PDF
    const ext = path.extname(file.name).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const isAllowedType = allowedTypes.includes(file.type) ||
      (imageExtensions.includes(ext) && file.type.startsWith('image/')) ||
      (ext === '.pdf' && file.type === 'application/pdf') ||
      (ext === '.doc' || ext === '.docx' || ext === '.xls' || ext === '.xlsx');

    if (!isAllowedType) {
      return NextResponse.json({
        error: `نوع الملف غير مسموح: ${file.type || 'غير معروف'} (امتداد: ${ext || 'لا يوجد'})`,
      }, { status: 415 });
    }

    // === اكتشاف بيئة Vercel ===
    const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
    const hasBlobToken = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);

    // على Vercel: يجب استخدام Vercel Blob (نظام الملفات read-only)
    if (isVercel && !hasBlobToken) {
      return NextResponse.json({
        error: 'خدمة رفع الملفات غير مُعدّة على Vercel',
        hint: 'اربط Vercel Blob Store واحصل على BLOB_READ_WRITE_TOKEN من Vercel Dashboard → Storage → Create Blob Store',
        docs: 'https://vercel.com/docs/storage/vercel-blob',
      }, { status: 503 });
    }

    // === 1) محاولة Vercel Blob (للإنتاج) ===
    if (hasBlobToken) {
      try {
        // استخدام Function indirection لتجاوز التحليل الثابت لـ import path
        // (لأن @vercel/blob حزمة ثقيلة واختيارية؛ إذا لم تكن مثبتة، try/catch يتعامل معها)
        const moduleName = '@vercel/blob';
        const blobModule = await (Function('m', `return import(m)`) as (m: string) => Promise<any>)(moduleName);
        const put = blobModule.put;
        if (typeof put !== 'function') {
          throw new Error('@vercel/blob module loaded but put() is not a function');
        }
        const safeName = file.name.replace(/[^\w.-]/g, '_').slice(0, 100);
        const filename = `jobs/${randomUUID()}-${safeName}`;
        const blob = await put(filename, file, {
          access: 'public',
          addRandomSuffix: true,
        });
        return NextResponse.json({
          url: blob.url,
          filename: blob.pathname,
          size: file.size,
          provider: 'vercel-blob',
        });
      } catch (blobErr: any) {
        console.error('Vercel Blob upload failed:', blobErr?.message || blobErr);
        if (isVercel) {
          // على Vercel، لا يمكن استخدام التخزين المحلي
          return NextResponse.json({
            error: 'فشل رفع الملف إلى Vercel Blob',
            details: blobErr?.message || String(blobErr),
            hint: 'تأكد من ضبط BLOB_READ_WRITE_TOKEN بشكل صحيح في Vercel Environment Variables',
          }, { status: 503 });
        }
        // على التطوير المحلي: نابع إلى التخزين المحلي
        console.log('Falling back to local storage...');
      }
    }

    // === 2) التخزين المحلي (للتطوير المحلي فقط) ===
    if (isVercel) {
      // أمان إضافي: لا نحاول الكتابة على Vercel
      return NextResponse.json({
        error: 'لا يمكن استخدام التخزين المحلي على Vercel (نظام الملفات read-only)',
        hint: 'اضبط BLOB_READ_WRITE_TOKEN لاستخدام Vercel Blob',
      }, { status: 503 });
    }

    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeExt = ext || (file.type === 'application/pdf' ? '.pdf' : '');
      const localFilename = `${randomUUID()}${safeExt}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jobs');
      await fs.mkdir(uploadDir, { recursive: true });
      const fullPath = path.join(uploadDir, localFilename);
      await fs.writeFile(fullPath, buffer);

      return NextResponse.json({
        url: `/uploads/jobs/${localFilename}`,
        filename: localFilename,
        size: file.size,
        provider: 'local',
      });
    } catch (localErr: any) {
      console.error('Local file write failed:', localErr?.message || localErr);
      return NextResponse.json({
        error: 'فشل كتابة الملف على القرص المحلي',
        details: localErr?.message || String(localErr),
        hint: 'تأكد من أن مجلد public/uploads/jobs قابل للكتابة',
      }, { status: 500 });
    }
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
