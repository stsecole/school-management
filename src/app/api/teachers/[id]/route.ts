import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const teacher = await db.teacher.findUnique({
      where: { id },
      include: {
        department: true,
        courses: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: 'الأستاذ غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ teacher });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const teacher = await db.teacher.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gender: body.gender || null,
        specialty: body.specialty || null,
        departmentId: body.departmentId || null,
        salary: body.salary ? parseFloat(body.salary) : 0,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        status: body.status,
      },
      include: { department: true },
    });
    return NextResponse.json({ teacher });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await db.teacher.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الأستاذ' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
