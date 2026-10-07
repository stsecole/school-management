import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/reports/comprehensive?year=2025
 * تقرير شامل يجمع كل الإحصائيات (طلاب، أساتذة، أقسام، حضور، مهام، مالية)
 * - الإحصائيات المالية (مداخيل/مصاريف) تُعاد فقط للمدير
 * - يعتمد على Promise.all لتنفيذ كل الاستعلامات بالتوازي
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // نطاق تواريخ السنة المطلوبة
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // ===== تنفيذ كل الاستعلامات بالتوازي =====
    const [
      studentsCount,
      teachersCount,
      departmentsCount,
      attendanceCount,
      tasksCount,
      pendingTasksCount,
      completedTasksCount,
      overdueTasksCount,
      departments,
      attendanceRecords,
      tasks,
      studentPayments,
      teacherPayments,
      expenses,
    ] = await Promise.all([
      db.student.count(),
      db.teacher.count(),
      db.department.count(),
      db.attendance.count({
        where: { date: { gte: yearStart, lt: yearEnd } },
      }),
      db.task.count({
        where: {
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: false,
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: true,
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: false,
          deadline: { lt: new Date(), gte: yearStart, lt: yearEnd },
        },
      }),
      // الأقسام مع عدد الطلاب والأساتذة
      db.department.findMany({
        include: {
          _count: {
            select: {
              students: true,
              teachers: true,
              courses: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      // سجلات الحضور خلال السنة
      db.attendance.findMany({
        where: { date: { gte: yearStart, lt: yearEnd } },
        include: { teacher: true, course: true },
      }),
      // المهام خلال السنة
      db.task.findMany({
        where: {
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      // المداخيل (للمدير فقط)
      isDirector
        ? db.studentPayment.findMany({
            where: { paymentDate: { gte: yearStart, lt: yearEnd } },
          })
        : Promise.resolve([]),
      // رواتب الأساتذة (للمدير فقط)
      isDirector
        ? db.teacherPayment.findMany({
            where: { paymentDate: { gte: yearStart, lt: yearEnd } },
          })
        : Promise.resolve([]),
      // المصاريف الثانوية (للمدير فقط)
      isDirector
        ? db.expense.findMany({
            where: { date: { gte: yearStart, lt: yearEnd } },
          })
        : Promise.resolve([]),
    ]);

    // ===== الإحصائيات العامة =====
    const general = {
      students: studentsCount,
      teachers: teachersCount,
      departments: departmentsCount,
      attendances: attendanceCount,
      tasks: tasksCount,
      pendingTasks: pendingTasksCount,
      completedTasks: completedTasksCount,
      overdueTasks: overdueTasksCount,
    };

    // ===== تجميع الحضور حسب الشهر =====
    const attendanceByMonthMap: Record<string, { total: number; male: number; female: number; sessions: number }> = {};
    for (const a of attendanceRecords) {
      const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
      if (!attendanceByMonthMap[key]) {
        attendanceByMonthMap[key] = { total: 0, male: 0, female: 0, sessions: 0 };
      }
      attendanceByMonthMap[key].total += a.totalCount;
      attendanceByMonthMap[key].male += a.maleCount;
      attendanceByMonthMap[key].female += a.femaleCount;
      attendanceByMonthMap[key].sessions += 1;
    }
    const attendanceByMonth = Object.entries(attendanceByMonthMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ===== ترتيب الأساتذة حسب عدد الجلسات/الحضور =====
    const teacherStatsMap: Record<string, { teacherId: string; teacherName: string; sessions: number; totalAttendees: number }> = {};
    for (const a of attendanceRecords) {
      if (!a.teacherId) continue;
      const id = a.teacherId;
      if (!teacherStatsMap[id]) {
        teacherStatsMap[id] = {
          teacherId: id,
          teacherName: a.teacherName || a.teacher?.name || 'غير معروف',
          sessions: 0,
          totalAttendees: 0,
        };
      }
      teacherStatsMap[id].sessions += 1;
      teacherStatsMap[id].totalAttendees += a.totalCount;
    }
    const topTeachers = Object.values(teacherStatsMap)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    // ===== ترتيب الموظفين حسب إكمال المهام =====
    const employeeRankingMap: Record<string, { name: string; total: number; completed: number; pending: number; overdue: number; avgDays: number; totalDays: number }> = {};
    for (const t of tasks) {
      if (!t.responsible) continue;
      const name = t.responsible;
      if (!employeeRankingMap[name]) {
        employeeRankingMap[name] = { name, total: 0, completed: 0, pending: 0, overdue: 0, avgDays: 0, totalDays: 0 };
      }
      const r = employeeRankingMap[name];
      r.total += 1;
      if (t.completed) {
        r.completed += 1;
        // حساب عدد الأيام بين البدء والإكمال (أو بين البدء والأجال)
        if (t.startDate && t.deadline) {
          const diff = Math.abs(new Date(t.deadline).getTime() - new Date(t.startDate).getTime());
          r.totalDays += Math.round(diff / (1000 * 60 * 60 * 24));
        }
      } else {
        r.pending += 1;
        if (t.deadline && new Date(t.deadline) < new Date()) {
          r.overdue += 1;
        }
      }
    }
    const employeeRanking = Object.values(employeeRankingMap)
      .map(r => ({
        name: r.name,
        total: r.total,
        completed: r.completed,
        pending: r.pending,
        overdue: r.overdue,
        completionRate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
        avgDays: r.completed > 0 ? Math.round(r.totalDays / r.completed) : 0,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    // ===== البيانات المالية (للمدير فقط) =====
    let financial: any = null;
    if (isDirector) {
      const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
      const totalTeacherPayments = teacherPayments.reduce((s, p) => s + p.amount, 0);
      const totalExpensesAmount = expenses.reduce((s, e) => s + e.amount, 0);
      const totalExpenses = totalTeacherPayments + totalExpensesAmount;

      // تجميع المداخيل والمصاريف حسب الشهر
      const monthlyMap: Record<string, { income: number; expenses: number }> = {};
      for (const p of studentPayments) {
        const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
        monthlyMap[key].income += p.amount;
      }
      for (const p of teacherPayments) {
        const key = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
        monthlyMap[key].expenses += p.amount;
      }
      for (const e of expenses) {
        const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
        monthlyMap[key].expenses += e.amount;
      }
      const monthlyIncome = Object.entries(monthlyMap)
        .map(([month, data]) => ({ month, income: data.income }))
        .sort((a, b) => a.month.localeCompare(b.month));
      const monthlyExpenses = Object.entries(monthlyMap)
        .map(([month, data]) => ({ month, expenses: data.expenses }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // المصاريف حسب النوع
      const expensesByType: Record<string, number> = {};
      for (const e of expenses) {
        expensesByType[e.type] = (expensesByType[e.type] || 0) + e.amount;
      }

      financial = {
        totalIncome,
        totalExpenses,
        totalTeacherPayments,
        totalSecondaryExpenses: totalExpensesAmount,
        balance: totalIncome - totalExpenses,
        monthlyIncome,
        monthlyExpenses,
        expensesByType,
      };
    }

    return NextResponse.json({
      year,
      general,
      departments,
      attendanceByMonth,
      topTeachers,
      tasks: {
        total: tasksCount,
        pending: pendingTasksCount,
        completed: completedTasksCount,
        overdue: overdueTasksCount,
        employeeRanking,
      },
      financial,
      isDirector,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/reports/comprehensive error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
