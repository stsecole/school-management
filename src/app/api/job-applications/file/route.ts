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

    // تحقق من حجم الملف (10MB أقصى حد)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (الحد الأقصى 10MB)' }, { status: 413 });
    }

    // تحقق من نوع الملف
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `نوع الملف غير مسموح: ${file.type}` }, { status: 415 });
    }

    // === 1) محاولة Vercel Blob أولاً ===
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
      try {
        // Use Function() indirection to bypass static analysis of the import path
        // (Vercel Blob is an optional heavy dependency; if missing, runtime try/catch handles it)
        const moduleName = '@vercel/blob';
        const blobModule = await (Function('m', `return import(m)`) as (m: string) => Promise<any>)(moduleName);
        const put = blobModule.put;
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
        const errMsg = (blobErr?.message || String(blobErr)).toLowerCase();
        const isNoToken = errMsg.includes('token') || errMsg.includes('unauthorized');
        console.error('Vercel Blob upload failed:', blobErr?.message || blobErr);
        if (process.env.VERCEL || process.env.NOW_REGION) {
          return NextResponse.json({
            error: isNoToken
              ? 'خدمة رفع الملفات غير مُعدّة. اربط Vercel Blob Store.'
              : 'فشل رفع الملف إلى Vercel Blob',
            details: blobErr?.message,
          }, { status: 503 });
        }
      }
    }

    // === 2) التخزين المحلي (للتطوير المحلي) ===
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name).toLowerCase() || (file.type === 'application/pdf' ? '.pdf' : '');
    const localFilename = `${randomUUID()}${ext}`;
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
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/job-applications/file error:', error);
    return NextResponse.json(
      { error: 'فشل رفع الملف', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
