import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const groups = await db.group.findMany({
      include: {
        department: true,
        specialization: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ groups });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const group = await db.group.create({
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
    return NextResponse.json({ group }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST group:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
