import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { specialty: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (departmentId && departmentId !== 'all') where.departmentId = departmentId;

    const teachers = await db.teacher.findMany({
      where,
      include: { department: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ teachers });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const teacher = await db.teacher.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gender: body.gender || null,
        specialty: body.specialty || null,
        departmentId: body.departmentId || null,
        salary: body.salary ? parseFloat(body.salary) : 0,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        status: body.status || 'active',
      },
      include: { department: true },
    });
    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/teachers error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
