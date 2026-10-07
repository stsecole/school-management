import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const subjects = await db.subject.findMany({
      include: {
        department: true,
        specialization: true,
        teacher: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ subjects });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const subject = await db.subject.create({
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
    return NextResponse.json({ subject }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST subject:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
