import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/exams/[id]
 * يعيد امتحاناً مفرداً مع كل الدرجات والإحصائيات
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        department: true,
        level: true,
        course: true,
        grades: {
          include: {
            student: {
              include: { department: true, level: true },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    // حساب الإحصائيات
    const validGrades = exam.grades.filter(g => g.score !== null && !(g.isAbsent && !g.isExcused));
    const scores = validGrades.map(g => g.score as number);
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passed = scores.filter(s => s >= exam.passingScore).length;
    const passRate = scores.length > 0 ? Math.round((passed / scores.length) * 100) : 0;
    const absentCount = exam.grades.filter(g => g.isAbsent).length;

    return NextResponse.json({
      exam,
      stats: {
        average: Math.round(average * 100) / 100,
        highest: Math.round(highest * 100) / 100,
        lowest: Math.round(lowest * 100) / 100,
        passRate,
        totalStudents: exam.grades.length,
        gradedCount: scores.length,
        absentCount,
        passedCount: passed,
        failedCount: scores.length - passed,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/exams/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/exams/[id]
 * تحديث بيانات الامتحان
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    const exam = await db.exam.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        examDate: body.examDate ? new Date(body.examDate) : undefined,
        maxScore: body.maxScore !== undefined ? parseFloat(body.maxScore) : undefined,
        passingScore: body.passingScore !== undefined ? parseFloat(body.passingScore) : undefined,
        weight: body.weight !== undefined ? parseFloat(body.weight) : undefined,
        term: body.term !== undefined ? body.term : undefined,
        status: body.status !== undefined ? body.status : undefined,
        departmentId: body.departmentId !== undefined ? (body.departmentId || null) : undefined,
        levelId: body.levelId !== undefined ? (body.levelId || null) : undefined,
        courseId: body.courseId !== undefined ? (body.courseId || null) : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
      },
      include: {
        department: true,
        level: true,
        course: true,
        _count: { select: { grades: true } },
      },
    });

    return NextResponse.json({ exam });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/exams/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}

/**
 * DELETE /api/exams/[id]
 * حذف الامتحان (يحذف الدرجات تلقائياً عبر onDelete: Cascade)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    await db.exam.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الامتحان' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/exams/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}
