// ===== POST /api/upload =====
// يرفع ملف (صورة عادة) إلى public/uploads ويُرجع URL
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WebP, GIF, SVG' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (حد أقصى 5 ميجا)' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const id = randomUUID();
    const filename = `${id}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buf);
    return NextResponse.json({ url: `/uploads/${filename}`, filename, size: buf.length });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/upload error:', error);
    return NextResponse.json({ error: 'فشل رفع الملف: ' + (error.message || '') }, { status: 500 });
  }
}
