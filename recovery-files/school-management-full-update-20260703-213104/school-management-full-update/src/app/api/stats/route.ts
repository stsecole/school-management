import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/stats - dashboard statistics
export async function GET() {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';

    const [
      studentsCount,
      teachersCount,
      departmentsCount,
      coursesCount,
      registrationsCount,
      attendancesCount,
      tasksCount,
      pendingTasksCount,
      overdueTasksCount,
      studentPayments,
      teacherPayments,
      expenses,
    ] = await Promise.all([
      db.student.count(),
      db.teacher.count(),
      db.department.count(),
      db.course.count(),
      db.registration.count(),
      db.attendance.count(),
      db.task.count(),
      db.task.count({ where: { completed: false } }),
      db.task.count({
        where: {
          completed: false,
          deadline: { lt: new Date() },
        },
      }),
      // Only fetch financial data if the user is a director
      isDirector ? db.studentPayment.findMany() : Promise.resolve([]),
      isDirector ? db.teacherPayment.findMany() : Promise.resolve([]),
      isDirector ? db.expense.findMany() : Promise.resolve([]),
    ]);

    const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
    const totalTeacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const totalSecondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const totalExpense = totalTeacherExpense + totalSecondaryExpense;

    // Students by department
    const departments = await db.department.findMany({
      include: { _count: { select: { students: true, teachers: true } } },
    });

    // Students by level
    const levels = await db.level.findMany({
      include: { _count: { select: { students: true } } },
    });

    // Recent students
    const recentStudents = await db.student.findMany({
      include: { department: true, level: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Recent tasks
    const recentTasks = await db.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Attendance by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentAttendances = await db.attendance.findMany({
      where: { date: { gte: sixMonthsAgo } },
      orderBy: { date: 'asc' },
    });

    // Group attendance by month
    const attendanceByMonth: Record<string, { total: number; male: number; female: number }> = {};
    for (const a of recentAttendances) {
      const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
      if (!attendanceByMonth[key]) {
        attendanceByMonth[key] = { total: 0, male: 0, female: 0 };
      }
      attendanceByMonth[key].total += a.totalCount;
      attendanceByMonth[key].male += a.maleCount;
      attendanceByMonth[key].female += a.femaleCount;
    }

    // Payments by month (only computed for directors)
    const paymentsByMonth: Record<string, { income: number; expense: number }> = {};
    if (isDirector) {
      for (const p of studentPayments) {
        const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!paymentsByMonth[key]) paymentsByMonth[key] = { income: 0, expense: 0 };
        paymentsByMonth[key].income += p.amount;
      }
      for (const p of teacherPayments) {
        const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!paymentsByMonth[key]) paymentsByMonth[key] = { income: 0, expense: 0 };
        paymentsByMonth[key].expense += p.amount;
      }
      for (const e of expenses) {
        const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
        if (!paymentsByMonth[key]) paymentsByMonth[key] = { income: 0, expense: 0 };
        paymentsByMonth[key].expense += e.amount;
      }
    }

    return NextResponse.json({
      counts: {
        students: studentsCount,
        teachers: teachersCount,
        departments: departmentsCount,
        courses: coursesCount,
        registrations: registrationsCount,
        attendances: attendancesCount,
        tasks: tasksCount,
        pendingTasks: pendingTasksCount,
        overdueTasks: overdueTasksCount,
      },
      // Financial data is only returned to directors
      finance: isDirector ? {
        totalIncome,
        totalExpense,
        totalTeacherExpense,
        totalSecondaryExpense,
        balance: totalIncome - totalExpense,
      } : null,
      departments,
      levels,
      recentStudents,
      recentTasks,
      attendanceByMonth: Object.entries(attendanceByMonth).map(([month, data]) => ({ month, ...data })),
      paymentsByMonth: isDirector
        ? Object.entries(paymentsByMonth).map(([month, data]) => ({ month, ...data }))
        : [],
      isDirector,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
