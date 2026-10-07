import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

// GET /api/stats - dashboard statistics
// All counts are filtered by branch (director's active_branch or employee's branch)
export async function GET() {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';

    // Branch filter — employees see their branch, directors see active branch (or all)
    const branchFilter = await getBranchFilter();

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
      db.student.count({ where: branchFilter }),
      db.teacher.count({ where: branchFilter }),
      db.department.count(),
      db.course.count(),
      db.registration.count({ where: branchFilter }),
      db.attendance.count({ where: branchFilter }),
      db.task.count({ where: branchFilter }),
      db.task.count({ where: { ...branchFilter, completed: false } }),
      db.task.count({
        where: {
          ...branchFilter,
          completed: false,
          deadline: { lt: new Date() },
        },
      }),
      // Only fetch financial data if the user is a director
      isDirector ? db.studentPayment.findMany({ where: branchFilter }) : Promise.resolve([]),
      // Teacher payments don't have branchId on the model — we filter via teacher.branchId
      isDirector
        ? db.teacherPayment.findMany({ where: { teacher: branchFilter } })
        : Promise.resolve([]),
      isDirector ? db.expense.findMany({ where: branchFilter }) : Promise.resolve([]),
    ]);

    const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
    const totalTeacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const totalSecondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const totalExpense = totalTeacherExpense + totalSecondaryExpense;

    // Students by department (filter counts by branch)
    const departments = await db.department.findMany({
      include: {
        _count: {
          select: {
            students: { where: branchFilter },
            teachers: { where: branchFilter },
          },
        },
      },
    });

    // Students by level (filter by branch)
    const levels = await db.level.findMany({
      include: { _count: { select: { students: { where: branchFilter } } } },
    });

    // Recent students (only this branch)
    const recentStudents = await db.student.findMany({
      where: branchFilter,
      include: { department: true, level: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Recent tasks (only this branch)
    const recentTasks = await db.task.findMany({
      where: branchFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Attendance by month (last 6 months, this branch only)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentAttendances = await db.attendance.findMany({
      where: { date: { gte: sixMonthsAgo }, ...branchFilter },
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
