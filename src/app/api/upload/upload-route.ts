import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/upload
 * Body: multipart/form-data with `file` field
 *
 * Uploads an image file (avatar, photo, etc.) to /public/uploads/students/
 * Returns: { url: "/uploads/students/<filename>" }
 *
 * Used by:
 *  - Student photo upload in students-section.tsx
 *  - Student photo upload in student-cards-section.tsx
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف' }, { status: 400 });
    }

    // Size limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف كبير جداً (حد أقصى 5 ميغابايت)' }, { status: 400 });
    }

    // Allowed types (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'نوع الملف غير مدعوم. المدعوم: JPG, PNG, WEBP, GIF',
      }, { status: 400 });
    }

    // Save file to /public/uploads/students/
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'students');

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      // directory may already exist
    }

    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, new Uint8Array(bytes));

    const url = `/uploads/students/${fileName}`;
    return NextResponse.json({ url, fileName });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/upload error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
