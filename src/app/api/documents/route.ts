import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * GET /api/documents?studentId=xxx&type=xxx&search=xxx
 * قائمة الوثائق
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (type && type !== 'all') where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { studentName: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const documents = await db.document.findMany({
      where,
      include: { student: { select: { name: true, studentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/documents error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * POST /api/documents
 * رفع وثيقة جديدة (multipart/form-data)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const studentId = formData.get('studentId') as string;
    const studentName = formData.get('studentName') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;

    if (!file || !title || !type) {
      return NextResponse.json({ error: 'الملف والعنوان والنوع مطلوبة' }, { status: 400 });
    }

    // قيود الحجم (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 10 ميغابايت' }, { status: 400 });
    }

    // الأنواع المسموحة
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'نوع الملف غير مدعوم. المدعوم: صور، PDF، Word',
      }, { status: 400 });
    }

    // احفظ الملف
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, new Uint8Array(bytes));

    const url = `/uploads/documents/${fileName}`;

    // احفظ في قاعدة البيانات
    const doc = await db.document.create({
      data: {
        title,
        type,
        studentId: studentId || null,
        studentName: studentName || null,
        fileName: file.name,
        filePath: url,
        fileSize: file.size,
        mimeType: file.type,
        description: description || null,
        tags: tags || null,
        uploadedBy: user.name,
      },
      include: { student: { select: { name: true, studentNumber: true } } },
    });

    return NextResponse.json({ document: doc });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/documents error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}

/**
 * DELETE /api/documents?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) {
      return NextResponse.json({ error: 'الوثيقة غير موجودة' }, { status: 404 });
    }

    // احذف الملف من القرص
    const fullPath = path.join(process.cwd(), 'public', doc.filePath);
    try {
      const { unlink } = await import('fs/promises');
      await unlink(fullPath);
    } catch {}

    await db.document.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/documents error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
