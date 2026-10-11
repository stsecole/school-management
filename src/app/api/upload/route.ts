import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { put } from '@vercel/blob';

/**
 * POST /api/upload
 * رفع صورة أو ملف إلى Vercel Blob
 * يستخدم لصور الطلاب والوثائق
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'students';

    if (!file) {
      return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
    }

    // قيود الحجم (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 10 ميغابايت' }, { status: 400 });
    }

    // الأنواع المسموحة
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'نوع الملف غير مدعوم. المدعوم: صور، PDF',
      }, { status: 400 });
    }

    // إنشاء اسم فريد للملف
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const fullPath = `${folder}/${fileName}`;

    // رفع الملف إلى Vercel Blob
    const blob = await put(fullPath, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({ 
      url: blob.url,
      path: fullPath,
      size: file.size,
      type: file.type,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'خطأ في رفع الملف: ' + error.message 
    }, { status: 500 });
  }
}