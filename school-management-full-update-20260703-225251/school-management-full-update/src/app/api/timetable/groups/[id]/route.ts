import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const group = await db.group.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code || null,
        departmentId: body.departmentId || null,
        specializationId: body.specializationId || null,
        level: body.level || null,
        studentCount: parseInt(body.studentCount) || 0,
        notes: body.notes || null,
      },
      include: { department: true, specialization: true },
    });
    return NextResponse.json({ group });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await db.group.delete({ where: { id } });
    return NextResponse.json({ message: 'تم الحذف' });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
