import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/calendar?month=YYYY-MM
 * POST /api/calendar — إنشاء حدث
 * DELETE /api/calendar?id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // 2026-07

    let startDate: Date;
    let endDate: Date;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      startDate = new Date(year, mon - 1, 1);
      endDate = new Date(year, mon, 1);
    } else {
      // الشهر الحالي
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const events = await db.calendarEvent.findMany({
      where: {
        OR: [
          { startDate: { gte: startDate, lt: endDate } },
          { endDate: { gte: startDate, lt: endDate } },
          { startDate: { lt: startDate }, endDate: { gte: endDate } },
        ],
      },
      orderBy: { startDate: 'asc' },
    });

    // أضف الأحداث التلقائية (الامتحانات القادمة)
    const upcomingExams = await db.exam.findMany({
      where: { examDate: { gte: startDate, lt: endDate } },
      include: { course: true, department: true },
    });

    const examsAsEvents = upcomingExams.map(e => ({
      id: `exam-${e.id}`,
      title: `📝 ${e.title}`,
      description: e.notes || undefined,
      type: 'exam',
      startDate: e.examDate,
      endDate: e.examDate,
      color: '#dc2626',
      location: undefined,
      isAuto: true,
    }));

    // أضف تواريخ استحقاق الأقساط المتأخرة
    const lateInstallments = await db.installmentPlan.findMany({
      where: {
        status: { in: ['pending', 'late'] },
        expectedDate: { gte: startDate, lt: endDate },
      },
      include: { student: { select: { name: true } } },
      take: 50,
    });

    const installmentsAsEvents = lateInstallments.map(i => ({
      id: `inst-${i.id}`,
      title: `💰 قسط ${i.student.name}`,
      description: `المبلغ: ${i.expectedAmount} دج`,
      type: 'payment',
      startDate: i.expectedDate,
      endDate: i.expectedDate,
      color: '#f59e0b',
      isAuto: true,
    }));

    // أضف مهام deadline
    const tasksWithDeadline = await db.task.findMany({
      where: {
        deadline: { gte: startDate, lt: endDate },
        completed: false,
      },
      take: 50,
    });

    const tasksAsEvents = tasksWithDeadline.map(t => ({
      id: `task-${t.id}`,
      title: `📋 ${t.title}`,
      description: t.responsible ? `المسؤول: ${t.responsible}` : undefined,
      type: 'deadline',
      startDate: t.deadline!,
      endDate: t.deadline!,
      color: '#7c3aed',
      isAuto: true,
    }));

    const allEvents = [
      ...events.map(e => ({ ...e, isAuto: false })),
      ...examsAsEvents,
      ...installmentsAsEvents,
      ...tasksAsEvents,
    ].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return NextResponse.json({ events: allEvents });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/calendar error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { title, description, type, startDate, endDate, color, location, departmentId } = body;

    if (!title || !startDate) {
      return NextResponse.json({ error: 'العنوان والتاريخ مطلوبان' }, { status: 400 });
    }

    const event = await db.calendarEvent.create({
      data: {
        title,
        description: description || null,
        type: type || 'event',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        color: color || '#0f766e',
        location: location || null,
        departmentId: departmentId || null,
      },
    });

    return NextResponse.json({ event });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    // إن كان حدثاً تلقائياً، لا تحذفه (امتحان، قسط، مهمة)
    if (id.startsWith('exam-') || id.startsWith('inst-') || id.startsWith('task-')) {
      return NextResponse.json({ error: 'لا يمكن حذف الأحداث التلقائية' }, { status: 400 });
    }

    await db.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
