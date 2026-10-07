import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/upload
 * رفع ملف (صورة/PDF) وحفظه في public/uploads/
 * يُرجع: { url, fileName, fileSize }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 });
    }

    // قيود الحجم (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 5 ميغابايت' }, { status: 400 });
    }

    // الأنواع المسموحة
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'نوع الملف غير مدعوم. الأنواع المسموحة: صور (JPEG, PNG, WebP, GIF) و PDF',
      }, { status: 400 });
    }

    // امتداد الملف
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, new Uint8Array(bytes));

    const url = `/uploads/${folder}/${fileName}`;

    return NextResponse.json({
      ok: true,
      url,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/upload error:', error);
    return NextResponse.json({
      error: 'فشل رفع الملف: ' + (error.message || ''),
    }, { status: 500 });
  }
}
