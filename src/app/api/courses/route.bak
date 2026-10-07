import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const courses = await db.course.findMany({
      include: { department: true, level: true, teacher: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ courses });
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
    const course = await db.course.create({
      data: {
        name: body.name,
        code: body.code || null,
        departmentId: body.departmentId || null,
        levelId: body.levelId || null,
        teacherId: body.teacherId || null,
        price: body.price ? parseFloat(body.price) : 0,
        duration: body.duration ? parseInt(body.duration) : null,
      },
      include: { department: true, level: true, teacher: true },
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
