// ===== GET /api/backup/download?filename=backup-YYYYMMDD-HHMMSS.db =====
// (المدير فقط)
// يُنزّل نسخة احتياطية محددة إلى جهاز المستخدم
import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename || !/^backup-\d{8}-\d{6}\.db$/.test(filename)) {
      return NextResponse.json({ error: 'اسم الملف غير صالح' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'download', 'backups', filename);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'النسخة الاحتياطية غير موجودة' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/backup/download error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
