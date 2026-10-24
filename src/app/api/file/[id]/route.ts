// ===== GET /api/file/[id] =====
// يخدم ملف من قاعدة البيانات (UploadedFile)
// يعمل على Vercel بدون الحاجة لـ filesystem

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const file = await db.uploadedFile.findUnique({
      where: { id },
      select: { id: true, content: true, fileName: true, mimeType: true, size: true },
    });

    if (!file) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }

    // حدّد نوع المحتوى
    const ext = (file.fileName.split('.').pop() || '').toLowerCase();
    let contentType = file.mimeType || 'application/octet-stream';
    if (!file.mimeType) {
      const mimeByExt: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain', 'csv': 'text/csv',
        'zip': 'application/zip',
      };
      contentType = mimeByExt[ext] || 'application/octet-stream';
    }

    // قرر إذا كان العرض inline (معاينة) أو attachment (تحميل)
    // الصور و PDF: inline (معاينة في المتصفح)
    // غير ذلك: attachment (تحميل)
    const isInline = contentType.startsWith('image/') || contentType === 'application/pdf';
    const disposition = isInline ? 'inline' : 'attachment';

    // أعد الملف كاستجابة binary
    return new NextResponse(file.content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.content.length),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.fileName)}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/file/[id] error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — حذف ملف من قاعدة البيانات
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const file = await db.uploadedFile.findUnique({ where: { id }, select: { id: true } });
    if (!file) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }

    await db.uploadedFile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/file/[id] error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
