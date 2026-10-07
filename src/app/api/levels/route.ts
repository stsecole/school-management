import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const level = await db.level.findUnique({ where: { id } });
      if (!level) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ level });
    }
    const levels = await db.level.findMany({ orderBy: { order: 'asc' } });
    return NextResponse.json({ levels });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const level = await db.level.create({
      data: { name: body.name, order: body.order ? parseInt(body.order) : 0 },
    });
    return NextResponse.json({ level }, { status: 201 });
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
    const existing = await db.level.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const level = await db.level.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        order: body.order !== undefined ? (parseInt(body.order) || 0) : undefined,
      },
    });
    return NextResponse.json({ level });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('PUT /api/levels error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const level = await db.level.findUnique({ where: { id } });
    if (!level) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const studentsCount = await db.student.count({ where: { levelId: id } });
    if (studentsCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + studentsCount + ' students linked' }, { status: 400 });
    const coursesCount = await db.course.count({ where: { levelId: id } });
    if (coursesCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + coursesCount + ' courses linked' }, { status: 400 });
    const examsCount = await db.exam.count({ where: { levelId: id } }).catch(() => 0);
    if (examsCount > 0) return NextResponse.json({ error: 'Cannot delete: ' + examsCount + ' exams linked' }, { status: 400 });
    await db.level.delete({ where: { id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('DELETE /api/levels error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}