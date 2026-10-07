// ===== GET /api/certificates/file?path=xxx =====
// معاينة/تنزيل ملف شهادة

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

    if (filePath.includes('..') || filePath.startsWith('//')) {
      return NextResponse.json({ error: 'مسار غير صالح' }, { status: 400 });
    }

    let relativePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const allowedDirs = ['uploads/certificates', 'download/cert-files'];
    const isAllowed = allowedDirs.some(dir => relativePath.startsWith(dir));
    if (!isAllowed) {
      return NextResponse.json({ error: 'مسار غير مصرح به' }, { status: 403 });
    }

    const absolutePath = path.join(process.cwd(), 'public', relativePath);
    let actualPath = absolutePath;
    let fileExists = false;
    try {
      await fs.access(absolutePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      const filename = path.basename(relativePath);
      const fallbackPath = path.join(process.cwd(), 'download', 'cert-files', filename);
      try {
        await fs.access(fallbackPath);
        actualPath = fallbackPath;
        fileExists = true;
      } catch {
        return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
      }
    }

    if (!fileExists) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(actualPath);
    const filename = path.basename(actualPath);
    const ext = path.extname(filename).toLowerCase();

    let contentType = 'application/octet-stream';
    let isInline = true;

    switch (ext) {
      case '.pdf': contentType = 'application/pdf'; break;
      case '.jpg':
      case '.jpeg': contentType = 'image/jpeg'; break;
      case '.png': contentType = 'image/png'; break;
      default: isInline = false;
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Content-Disposition', (download || !isInline ? 'attachment' : 'inline') + `; filename="${filename}"`);

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch (error: any) {
    console.error('GET /api/certificates/file error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
