import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const subject = await db.subject.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code || null,
        departmentId: body.departmentId || null,
        specializationId: body.specializationId || null,
        weeklyHours: parseInt(body.weeklyHours) || 2,
        requiredRoomType: body.requiredRoomType || null,
        color: body.color || null,
        notes: body.notes || null,
        teacherId: body.teacherId || null,
      },
      include: { department: true, specialization: true, teacher: true },
    });
    return NextResponse.json({ subject });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await db.subject.delete({ where: { id } });
    return NextResponse.json({ message: 'تم الحذف' });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
