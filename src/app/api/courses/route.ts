import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const course = await db.course.findUnique({ where: { id }, include: { department: true, level: true, teacher: true } });
      if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ course });
    }
    const courses = await db.course.findMany({ include: { department: true, level: true, teacher: true }, orderBy: { name: 'asc' } });
    return NextResponse.json({ courses });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
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
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const body = await request.json();
    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const course = await db.course.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        code: body.code !== undefined ? (body.code || null) : undefined,
        departmentId: body.departmentId !== undefined ? (body.departmentId || null) : undefined,
        levelId: body.levelId !== undefined ? (body.levelId || null) : undefined,
        teacherId: body.teacherId !== undefined ? (body.teacherId || null) : undefined,
        price: body.price !== undefined ? parseFloat(body.price) || 0 : undefined,
        duration: body.duration !== undefined ? (body.duration ? parseInt(body.duration) : null) : undefined,
      },
      include: { department: true, level: true, teacher: true },
    });
    return NextResponse.json({ course });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('PUT /api/courses error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const course = await db.course.findUnique({ where: { id } });
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const sessionsCount = await db.timetableSession.count({ where: { courseId: id } }).catch(() => 0);
    if (sessionsCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + sessionsCount + ' sessions linked' }, { status: 400 });
    const subjectSessionsCount = await db.timetableSession.count({ where: { subjectId: id } }).catch(() => 0);
    if (subjectSessionsCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + subjectSessionsCount + ' sessions linked' }, { status: 400 });
    const attendancesCount = await db.attendance.count({ where: { courseId: id } }).catch(() => 0);
    if (attendancesCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + attendancesCount + ' attendances linked' }, { status: 400 });
    const examsCount = await db.exam.count({ where: { courseId: id } }).catch(() => 0);
    if (examsCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + examsCount + ' exams linked' }, { status: 400 });
    await db.course.delete({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('DELETE /api/courses error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}