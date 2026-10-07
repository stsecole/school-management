import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

/**
 * GET /api/reports/branch-comparison?year=2026
 *
 * Director-only. Returns a side-by-side comparison of all branches:
 *   - KPIs per branch (students, teachers, payments, expenses, balance)
 *   - Monthly income/expense per branch
 *   - Department breakdown per branch
 *   - Top teachers per branch
 *   - Performance ranking
 *
 * Used by the "مقارنة الفروع" tab in the Reports section.
 */
export async function GET(request: NextRequest) {
  try {
    await requireDirector();

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // ===== Fetch all branches =====
    const branches = await db.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (branches.length === 0) {
      return NextResponse.json({
        year,
        branches: [],
        comparison: { branches: [], totals: null, ranking: [] },
        message: 'No active branches found',
      });
    }

    // ===== Fetch data per branch in parallel =====
    const branchData = await Promise.all(
      branches.map(async (branch) => {
        const [
          studentsCount,
          teachersCount,
          newStudentsThisYear,
          attendancesCount,
          tasksCount,
          pendingTasks,
          completedTasks,
          overdueTasks,
          studentPayments,
          teacherPayments,
          expenses,
          departments,
          recentStudents,
        ] = await Promise.all([
          db.student.count({
            where: { branchId: branch.id, status: { in: ['registered', 'continuing'] } },
          }),
          db.teacher.count({
            where: { branchId: branch.id, status: 'active' },
          }),
          db.student.count({
            where: {
              branchId: branch.id,
              registrationDate: { gte: yearStart, lt: yearEnd },
            },
          }),
          db.attendance.count({
            where: {
              branchId: branch.id,
              date: { gte: yearStart, lt: yearEnd },
            },
          }),
          db.task.count({
            where: {
              branchId: branch.id,
              OR: [
                { startDate: { gte: yearStart, lt: yearEnd } },
                { deadline: { gte: yearStart, lt: yearEnd } },
              ],
            },
          }),
          db.task.count({
            where: {
              branchId: branch.id,
              completed: false,
              OR: [
                { startDate: { gte: yearStart, lt: yearEnd } },
                { deadline: { gte: yearStart, lt: yearEnd } },
              ],
            },
          }),
          db.task.count({
            where: {
              branchId: branch.id,
              completed: true,
              OR: [
                { startDate: { gte: yearStart, lt: yearEnd } },
                { deadline: { gte: yearStart, lt: yearEnd } },
              ],
            },
          }),
          db.task.count({
            where: {
              branchId: branch.id,
              completed: false,
              deadline: { lt: new Date(), gte: yearStart, lt: yearEnd },
            },
          }),
          // Student payments this year
          db.studentPayment.findMany({
            where: {
              branchId: branch.id,
              paymentDate: { gte: yearStart, lt: yearEnd },
            },
            select: { amount: true, paymentDate: true, paymentLabel: true },
          }),
          // Teacher payments this year (via teacher.branchId)
          db.teacherPayment.findMany({
            where: {
              teacher: { branchId: branch.id },
              paymentDate: { gte: yearStart, lt: yearEnd },
            },
            select: { amount: true, paymentDate: true },
          }),
          // Expenses this year
          db.expense.findMany({
            where: {
              branchId: branch.id,
              date: { gte: yearStart, lt: yearEnd },
            },
            select: { amount: true, date: true, type: true },
          }),
          // Departments with counts (filtered by branch)
          db.department.findMany({
            include: {
              _count: {
                select: {
                  students: { where: { branchId: branch.id } },
                  teachers: { where: { branchId: branch.id } },
                },
              },
            },
          }),
          // Recent students (last 5)
          db.student.findMany({
            where: { branchId: branch.id },
            select: { name: true, registrationDate: true, status: true, department: { select: { name: true } } },
            orderBy: { registrationDate: 'desc' },
            take: 5,
          }),
        ]);

        // ===== Compute financial totals =====
        const studentIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
        const teacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
        const secondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);
        const totalIncome = studentIncome;
        const totalExpenses = teacherExpense + secondaryExpense;
        const balance = totalIncome - totalExpenses;

        // ===== Monthly income (Jan-Dec) =====
        const monthlyIncome: number[] = Array(12).fill(0);
        for (const p of studentPayments) {
          const m = p.paymentDate.getMonth();
          monthlyIncome[m] += p.amount;
        }

        // ===== Monthly expenses =====
        const monthlyExpenses: number[] = Array(12).fill(0);
        for (const p of teacherPayments) {
          const m = p.paymentDate.getMonth();
          monthlyExpenses[m] += p.amount;
        }
        for (const e of expenses) {
          const m = e.date.getMonth();
          monthlyExpenses[m] += e.amount;
        }

        // ===== Expenses by type =====
        const expensesByType: Record<string, number> = {};
        for (const e of expenses) {
          expensesByType[e.type] = (expensesByType[e.type] || 0) + e.amount;
        }

        // ===== Departments with branch-specific counts =====
        const departmentsWithCounts = departments
          .map(d => ({
            id: d.id,
            name: d.name,
            students: d._count.students,
            teachers: d._count.teachers,
          }))
          .filter(d => d.students > 0 || d.teachers > 0);

        return {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          managerName: branch.managerName,
          counts: {
            students: studentsCount,
            teachers: teachersCount,
            newStudentsThisYear,
            attendances: attendancesCount,
            tasks: tasksCount,
            pendingTasks,
            completedTasks,
            overdueTasks,
            taskCompletionRate: tasksCount > 0 ? Math.round((completedTasks / tasksCount) * 100) : 0,
          },
          finance: {
            studentIncome,
            teacherExpense,
            secondaryExpense,
            totalIncome,
            totalExpenses,
            balance,
            margin: totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0,
          },
          monthlyIncome,
          monthlyExpenses,
          expensesByType,
          departments: departmentsWithCounts,
          recentStudents,
        };
      })
    );

    // ===== Compute totals across all branches =====
    const totals = {
      students: branchData.reduce((s, b) => s + b.counts.students, 0),
      teachers: branchData.reduce((s, b) => s + b.counts.teachers, 0),
      newStudentsThisYear: branchData.reduce((s, b) => s + b.counts.newStudentsThisYear, 0),
      attendances: branchData.reduce((s, b) => s + b.counts.attendances, 0),
      tasks: branchData.reduce((s, b) => s + b.counts.tasks, 0),
      pendingTasks: branchData.reduce((s, b) => s + b.counts.pendingTasks, 0),
      completedTasks: branchData.reduce((s, b) => s + b.counts.completedTasks, 0),
      overdueTasks: branchData.reduce((s, b) => s + b.counts.overdueTasks, 0),
      studentIncome: branchData.reduce((s, b) => s + b.finance.studentIncome, 0),
      teacherExpense: branchData.reduce((s, b) => s + b.finance.teacherExpense, 0),
      secondaryExpense: branchData.reduce((s, b) => s + b.finance.secondaryExpense, 0),
      totalIncome: branchData.reduce((s, b) => s + b.finance.totalIncome, 0),
      totalExpenses: branchData.reduce((s, b) => s + b.finance.totalExpenses, 0),
      balance: branchData.reduce((s, b) => s + b.finance.balance, 0),
    };

    // ===== Build rankings =====
    const ranking = {
      byIncome: [...branchData].sort((a, b) => b.finance.totalIncome - a.finance.totalIncome).map(b => ({ name: b.name, value: b.finance.totalIncome })),
      byBalance: [...branchData].sort((a, b) => b.finance.balance - a.finance.balance).map(b => ({ name: b.name, value: b.finance.balance })),
      byStudents: [...branchData].sort((a, b) => b.counts.students - a.counts.students).map(b => ({ name: b.name, value: b.counts.students })),
      byTaskCompletion: [...branchData].sort((a, b) => b.counts.taskCompletionRate - a.counts.taskCompletionRate).map(b => ({ name: b.name, value: b.counts.taskCompletionRate })),
      byAttendance: [...branchData].sort((a, b) => b.counts.attendances - a.counts.attendances).map(b => ({ name: b.name, value: b.counts.attendances })),
    };

    return NextResponse.json({
      year,
      branches: branchData,
      totals,
      ranking,
      branchCount: branchData.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('GET /api/reports/branch-comparison error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
