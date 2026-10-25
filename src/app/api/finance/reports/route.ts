import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

// GET /api/finance/reports - customizable financial reports (director only)
// الآن يدعم فلترة الفرع: كل فرع يرى إحصائياته المالية فقط
export async function GET(request: NextRequest) {
  try {
    await requireDirector();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const departmentId = searchParams.get('departmentId');
    const specializationId = searchParams.get('specializationId');
    const studentId = searchParams.get('studentId');
    const groupBy = searchParams.get('groupBy') || 'none';

    // ===== فلتر الفرع =====
    const branchFilter = await getBranchFilter();

    // Build date range for month filter
    let dateRange: any = null;
    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      dateRange = { gte: start, lt: end };
    }

    // ===== Student payments (مفلترة بالفرع) =====
    const studentPaymentWhere: any = { ...branchFilter };
    if (dateRange) studentPaymentWhere.paymentDate = dateRange;
    if (studentId) studentPaymentWhere.studentId = studentId;
    if (departmentId || specializationId) {
      studentPaymentWhere.student = {};
      if (departmentId) studentPaymentWhere.student.departmentId = departmentId;
      if (specializationId) studentPaymentWhere.student.specializationId = specializationId;
    }

    const studentPayments = await db.studentPayment.findMany({
      where: studentPaymentWhere,
      include: {
        student: {
          include: {
            department: true,
            specialization: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // ===== Teacher payments (مفلترة بالفرع عبر علاقة teacher) =====
    // ملاحظة: TeacherPayment ليس به حقل branchId مباشر — الفرع على Teacher
    const teacherPaymentWhere: any = {};
    if (month) teacherPaymentWhere.month = month;
    // الفلترة بالفرع تتم عبر علاقة teacher
    const teacherFilter: any = { ...branchFilter };
    if (departmentId) teacherFilter.departmentId = departmentId;
    teacherPaymentWhere.teacher = teacherFilter;

    const teacherPayments = await db.teacherPayment.findMany({
      where: teacherPaymentWhere,
      include: {
        teacher: { include: { department: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // ===== Expenses (مفلترة بالفرع) =====
    const expenseWhere: any = { ...branchFilter };
    if (dateRange) expenseWhere.date = dateRange;

    const expenses = await db.expense.findMany({
      where: expenseWhere,
      orderBy: { date: 'desc' },
    });

    // ===== Staff payments (مفلترة بالفرع) =====
    let staffPayments: any[] = [];
    let totalStaffExpense = 0;
    try {
      staffPayments = await (db as any).staffPayment.findMany({
        where: branchFilter,
        orderBy: { paymentDate: 'desc' },
      });
      totalStaffExpense = staffPayments
        .filter((p: any) => !p.isCancelled)
        .reduce((s: number, p: any) => s + p.amount, 0);
    } catch {}

    // ===== Totals =====
    const totalIncome = studentPayments
      .filter(p => !p.isCancelled && !p.isReversed)
      .reduce((sum, p) => sum + p.amount, 0);
    const totalTeacherExpense = teacherPayments
      .filter(p => !p.isCancelled)
      .reduce((sum, p) => sum + p.amount, 0);
    const totalSecondaryExpense = expenses
      .filter(e => !e.isCancelled)
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = totalTeacherExpense + totalSecondaryExpense + totalStaffExpense;
    const balance = totalIncome - totalExpense;

    // ===== Grouping =====
    let grouped: any = null;
    if (groupBy === 'department') {
      const groups: Record<string, { income: number; students: Set<string>; payments: number }> = {};
      for (const p of studentPayments) {
        if (p.isCancelled || p.isReversed) continue;
        const deptName = p.student.department?.name || 'بدون قسم';
        if (!groups[deptName]) groups[deptName] = { income: 0, students: new Set(), payments: 0 };
        groups[deptName].income += p.amount;
        groups[deptName].students.add(p.studentId);
        groups[deptName].payments++;
      }
      grouped = Object.entries(groups).map(([name, data]) => ({
        name,
        income: data.income,
        studentsCount: data.students.size,
        paymentsCount: data.payments,
      }));
    } else if (groupBy === 'specialization') {
      const groups: Record<string, { income: number; students: Set<string>; department: string }> = {};
      for (const p of studentPayments) {
        if (p.isCancelled || p.isReversed) continue;
        const specName = p.student.specialization?.name || 'بدون تخصص';
        const deptName = p.student.department?.name || 'بدون قسم';
        if (!groups[specName]) groups[specName] = { income: 0, students: new Set(), department: deptName };
        groups[specName].income += p.amount;
        groups[specName].students.add(p.studentId);
      }
      grouped = Object.entries(groups).map(([name, data]) => ({
        name,
        department: data.department,
        income: data.income,
        studentsCount: data.students.size,
      }));
    } else if (groupBy === 'student') {
      const groups: Record<string, { name: string; income: number; payments: number; department: string }> = {};
      for (const p of studentPayments) {
        if (p.isCancelled || p.isReversed) continue;
        if (!groups[p.studentId]) {
          groups[p.studentId] = {
            name: p.student.name,
            income: 0,
            payments: 0,
            department: p.student.department?.name || 'بدون قسم',
          };
        }
        groups[p.studentId].income += p.amount;
        groups[p.studentId].payments++;
      }
      grouped = Object.values(groups).sort((a, b) => b.income - a.income);
    }

    // ===== Expenses by type =====
    const expensesByType: Record<string, number> = {};
    for (const e of expenses) {
      if (e.isCancelled) continue;
      expensesByType[e.type] = (expensesByType[e.type] || 0) + e.amount;
    }

    // ===== All-time totals (مفلترة بالفرع) =====
    const allStudentPayments = await db.studentPayment.findMany({ where: branchFilter });
    const allTeacherPayments = await db.teacherPayment.findMany({ where: { teacher: { ...branchFilter } } });
    const allExpenses = await db.expense.findMany({ where: branchFilter });
    const totalIncomeAll = allStudentPayments
      .filter(p => !p.isCancelled && !p.isReversed)
      .reduce((s, p) => s + p.amount, 0);
    const totalTeacherExpenseAll = allTeacherPayments
      .filter(p => !p.isCancelled)
      .reduce((s, p) => s + p.amount, 0);
    const totalSecondaryExpenseAll = allExpenses
      .filter(e => !e.isCancelled)
      .reduce((s, e) => s + e.amount, 0);
    const totalStaffExpenseAll = staffPayments
      .filter(p => !p.isCancelled)
      .reduce((s, p) => s + p.amount, 0);

    // ===== Outstanding balances (مفلترة بالفرع) =====
    const outstandingWhere: any = { ...branchFilter };
    if (departmentId) outstandingWhere.departmentId = departmentId;
    if (specializationId) outstandingWhere.specializationId = specializationId;
    const students = await db.student.findMany({
      where: outstandingWhere,
      include: {
        department: true,
        specialization: true,
        payments: true,
        installments: true,
      },
    });
    const outstanding = students.map(s => {
      const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
      const installmentsPaid = s.installments.reduce((sum, i) => sum + i.paidAmount, 0);
      const installmentsExpected = s.installments.reduce((sum, i) => sum + i.expectedAmount, 0);
      const totalPaid = paid + installmentsPaid;
      const totalFees = installmentsExpected > 0 ? installmentsExpected : (s.departmentId ? 8000 : 0);
      return {
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        department: s.department?.name,
        specialization: s.specialization?.name,
        paid: totalPaid,
        fees: totalFees,
        remaining: Math.max(0, totalFees - totalPaid),
      };
    }).filter(s => s.remaining > 0);

    // ===== Teacher totals (مفلترة بالفرع) =====
    const teachers = await db.teacher.findMany({
      where: branchFilter,
      include: { payments: true },
    });
    const teacherTotals = teachers.map(t => {
      const paid = t.payments.reduce((sum, p) => sum + p.amount, 0);
      return { id: t.id, name: t.name, salary: t.salary, paid };
    });

    return NextResponse.json({
      filters: { month, departmentId, specializationId, studentId, groupBy },
      studentPayments,
      teacherPayments,
      expenses,
      totalIncome,
      totalTeacherExpense,
      totalSecondaryExpense,
      totalStaffExpense,
      totalExpense,
      balance,
      expensesByType,
      grouped,
      allTime: {
        totalIncome: totalIncomeAll,
        totalTeacherExpense: totalTeacherExpenseAll,
        totalSecondaryExpense: totalSecondaryExpenseAll,
        totalStaffExpense: totalStaffExpenseAll,
        totalExpense: totalTeacherExpenseAll + totalSecondaryExpenseAll + totalStaffExpenseAll,
        balance: totalIncomeAll - totalTeacherExpenseAll - totalSecondaryExpenseAll - totalStaffExpenseAll,
      },
      outstanding,
      teacherTotals,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'القسم المالي متاح للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/finance/reports error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
