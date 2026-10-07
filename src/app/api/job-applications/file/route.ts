// ===== GET /api/job-applications/file?path=xxx =====
// معاينة/تنزيل ملف مرفوع لطلب عمل
// يدعم المسارات:
// - /uploads/jobs/filename (public)
// - uploads/jobs/filename (نسبي)
// - /download/job-files/filename (fallback)

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const download = searchParams.get('download') === 'true';

    if (!filePath) {
      return NextResponse.json({ error: 'مسار الملف مطلوب' }, { status: 400 });
    }

    // أمان: منع path traversal
    if (filePath.includes('..') || filePath.startsWith('//')) {
      return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 });
    }

    // تطبيع المسار (إزالة / من البداية)
    let relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // قائمة المجلدات المسموح بها
    const allowedDirs = ['uploads/jobs', 'download/job-files'];
    const isAllowed = allowedDirs.some(dir => relativePath.startsWith(dir));
    if (!isAllowed) {
      return NextResponse.json({ error: 'مسار غير مصرح به' }, { status: 403 });
    }

    // تحويل المسار إلى مطلق
    const absolutePath = path.join(process.cwd(), 'public', relativePath);

    // تحقق من وجود الملف في public/
    let fileExists = false;
    try {
      await fs.access(absolutePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    // إذا لم يوجد في public/, ابحث في download/job-files/
    let actualPath = absolutePath;
    if (!fileExists) {
      const filename = path.basename(relativePath);
      const fallbackPath = path.join(process.cwd(), 'download', 'job-files', filename);
      try {
        await fs.access(fallbackPath);
        actualPath = fallbackPath;
        fileExists = true;
      } catch {
        // غير موجود في كلا المكانين
        return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }

    // قراءة الملف
    const fileBuffer = await fs.readFile(actualPath);
    const filename = path.basename(actualPath);
    const ext = path.extname(filename).toLowerCase();

    // تحديد Content-Type
    let contentType = 'application/octet-stream';
    let isInline = true;

    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        isInline = true;
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        isInline = true;
        break;
      case '.png':
        contentType = 'image/png';
        isInline = true;
        break;
      default:
        isInline = false;
    }

    // إعداد الاستجابة
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Cache-Control', 'public, max-age=3600');

    if (download || !isInline) {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('GET /api/job-applications/file error:', error);
    return NextResponse.json({
      error: 'حدث خطأ: ' + (error.message || ''),
    }, { status: 500 });
  }
}
