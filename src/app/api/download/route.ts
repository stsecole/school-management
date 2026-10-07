import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';

// قاموس أنواع المحتوى حسب امتداد الملف
const CONTENT_TYPES: Record<string, string> = {
  // PDF والوثائق
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // الصور
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  // ملفات Excel
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  // النصوص
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  // الأرشيف
  zip: 'application/zip',
  // الصوت والفيديو
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  // أخرى
  jsonl: 'application/x-ndjson',
};

// الحصول على نوع المحتوى من امتداد الملف
function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

// تحديد ما إذا كان عرض الصور مضمّناً (inline) أم تنزيلاً (attachment)
function shouldDisplayInline(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'txt', 'json', 'html'].includes(ext);
}

// تطبيع المسار ومنع هجمات Path Traversal
function sanitizePath(relativePath: string): string | null {
  // فك الترميز أولاً
  let decoded: string;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null;
  }

  // منع المسارات المطلقة أو التي تحوي .. للخروج من الجذر
  if (decoded.includes('..') || decoded.startsWith('/') || decoded.startsWith('\\')) {
    return null;
  }

  // إزالة أي محاولة لتجاوز المجلد بـ Windows-style
  if (decoded.includes(':') || decoded.includes('\0')) {
    return null;
  }

  // تطبيع الفواصل
  return decoded.replace(/\\/g, '/');
}

// GET /api/download?file=<relative-path>
// يخدم الملفات من مجلد download/ مع حماية المسار
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get('file');

    if (!fileParam) {
      return NextResponse.json(
        { error: 'لم يتم تحديد الملف' },
        { status: 400 }
      );
    }

    // تطبيع المسار ومنع هجمات Path Traversal
    const sanitized = sanitizePath(fileParam);
    if (!sanitized) {
      return NextResponse.json(
        { error: 'مسار غير صالح' },
        { status: 400 }
      );
    }

    // بناء المسار الكامل
    const projectRoot = process.cwd();
    const downloadRoot = path.join(projectRoot, 'download');
    const requestedPath = path.join(downloadRoot, sanitized);

    // التأكد مرة أخرى من أن المسار النهائي داخل مجلد download/
    const normalizedRequested = path.normalize(requestedPath);
    const normalizedRoot = path.normalize(downloadRoot);
    if (!normalizedRequested.startsWith(normalizedRoot + path.sep) && normalizedRequested !== normalizedRoot) {
      return NextResponse.json(
        { error: 'مسار غير صالح' },
        { status: 403 }
      );
    }

    // التحقق من وجود الملف
    let stat;
    try {
      stat = await fs.stat(normalizedRequested);
    } catch {
      return NextResponse.json(
        { error: 'الملف غير موجود' },
        { status: 404 }
      );
    }

    if (!stat.isFile()) {
      return NextResponse.json(
        { error: 'العنصر ليس ملفاً' },
        { status: 400 }
      );
    }

    // قراءة محتوى الملف
    const fileBuffer = await fs.readFile(normalizedRequested);
    const fileName = path.basename(normalizedRequested);
    const contentType = getContentType(fileName);
    const isInline = shouldDisplayInline(fileName);

    // إعداد رأس Content-Disposition
    const disposition = isInline ? 'inline' : 'attachment';
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `${disposition}; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/download error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحميل الملف' },
      { status: 500 }
    );
  }
}
