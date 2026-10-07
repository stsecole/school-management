import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const registration = await db.registration.update({
      where: { id },
      data: {
        courseId: body.courseId || null,
        courseName: body.courseName,
        level: body.level || null,
        specialty: body.specialty || null,
        date: body.date ? new Date(body.date) : undefined,
        note: body.note || null,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : undefined,
      },
      include: { student: true },
    });

    return NextResponse.json({ registration });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/registrations/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await db.registration.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف التسجيل' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
