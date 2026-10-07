import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const studentId = searchParams.get('studentId');

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (search) {
      where.OR = [
        { courseName: { contains: search } },
        { specialty: { contains: search } },
        { student: { name: { contains: search } } },
      ];
    }

    const registrations = await db.registration.findMany({
      where,
      include: { student: { include: { department: true, level: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ registrations });
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

    const registration = await db.registration.create({
      data: {
        studentId: body.studentId,
        courseId: body.courseId || null,
        courseName: body.courseName || 'تسجيل عام',
        level: body.level || null,
        specialty: body.specialty || null,
        date: body.date ? new Date(body.date) : new Date(),
        note: body.note || null,
        photoUrl: body.photoUrl || null,
      },
      include: { student: true },
    });

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/registrations error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
