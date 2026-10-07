// ===== GET /api/dashboard/charts?months=12 =====
// إحصائيات متقدمة للوحة التفاعلية:
// - توزيع الطلاب حسب الجنس
// - توزيع الطلاب حسب الفئة العمرية
// - توزيع الطلاب حسب الحالة
// - منحنى الحضور الشهري (آخر 12 شهر)
// - مقارنة الإيرادات الشهرية (آخر 12 شهر)
// - توزيع الطلاب حسب القسم + الجنس
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';
    const { searchParams } = new URL(request.url);
    const months = Math.min(Math.max(parseInt(searchParams.get('months') || '12', 10), 3), 24);

    const branchFilter = await getBranchFilter();
    const now = new Date();

    // Build the start date for monthly aggregation (N months ago from start of current month)
    const startAgg = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // ===== Parallel queries =====
    const [
      studentsByGender,
      studentsByStatus,
      studentsByDeptRaw,
      studentsForAge,
      attendanceMonthlyRaw,
      paymentsMonthlyRaw,
      expensesMonthlyRaw,
    ] = await Promise.all([
      // Gender distribution
      db.student.groupBy({
        by: ['gender'],
        where: { ...branchFilter, status: { in: ['registered', 'continuing'] } },
        _count: { _all: true },
      }),
      // Status distribution
      db.student.groupBy({
        by: ['status'],
        where: branchFilter,
        _count: { _all: true },
      }),
      // Students per department (with gender breakdown)
      db.department.findMany({
        include: {
          students: {
            where: { ...branchFilter, status: { in: ['registered', 'continuing'] } },
            select: { gender: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      // All active students (for age computation, take only birthDate)
      db.student.findMany({
        where: { ...branchFilter, status: { in: ['registered', 'continuing'] } },
        select: { birthDate: true, gender: true },
      }),
      // Attendance per month
      db.attendance.findMany({
        where: { ...branchFilter, date: { gte: startAgg, lt: now } },
        select: { date: true, totalCount: true, maleCount: true, femaleCount: true },
      }),
      // Payments per month (director only)
      isDirector
        ? db.studentPayment.findMany({
            where: { ...branchFilter, paymentDate: { gte: startAgg, lt: now } },
            select: { paymentDate: true, amount: true, paymentType: true },
          })
        : Promise.resolve([]),
      // Expenses per month (director only)
      isDirector
        ? db.expense.findMany({
            where: { ...branchFilter, date: { gte: startAgg, lt: now } },
            select: { date: true, amount: true, type: true },
          })
        : Promise.resolve([]),
    ]);

    // ===== Gender distribution =====
    const genderStats = {
      male: studentsByGender.find(g => g.gender === 'ذكر')?._count._all || 0,
      female: studentsByGender.find(g => g.gender === 'أنثى')?._count._all || 0,
      unknown: studentsByGender.find(g => !g.gender || (g.gender !== 'ذكر' && g.gender !== 'أنثى'))?._count._all || 0,
    };
    const genderChart = [
      { name: 'ذكور', value: genderStats.male, color: '#3b82f6' },
      { name: 'إناث', value: genderStats.female, color: '#ec4899' },
      ...(genderStats.unknown > 0 ? [{ name: 'غير محدد', value: genderStats.unknown, color: '#94a3b8' }] : []),
    ];

    // ===== Status distribution =====
    const statusLabels: Record<string, string> = {
      registered: 'مسجّل',
      continuing: 'مستمر',
      graduated: 'متخرج',
      abandoned: 'منقطع',
      postponed: 'مؤجّل',
    };
    const statusColors: Record<string, string> = {
      registered: '#10b981',
      continuing: '#3b82f6',
      graduated: '#8b5cf6',
      abandoned: '#ef4444',
      postponed: '#f59e0b',
    };
    const statusChart = studentsByStatus.map(s => ({
      name: statusLabels[s.status] || s.status,
      value: s._count._all,
      color: statusColors[s.status] || '#94a3b8',
      rawStatus: s.status,
    }));

    // ===== Age distribution =====
    const ageBuckets = [
      { name: 'أقل من 15', min: 0, max: 14, count: 0 },
      { name: '15-17', min: 15, max: 17, count: 0 },
      { name: '18-21', min: 18, max: 21, count: 0 },
      { name: '22-25', min: 22, max: 25, count: 0 },
      { name: '26-30', min: 26, max: 30, count: 0 },
      { name: '31-40', min: 31, max: 40, count: 0 },
      { name: 'أكثر من 40', min: 41, max: 200, count: 0 },
    ];
    let unknownAge = 0;
    for (const s of studentsForAge) {
      if (!s.birthDate) { unknownAge++; continue; }
      const age = Math.floor((now.getTime() - s.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
      const bucket = ageBuckets.find(b => age >= b.min && age <= b.max);
      if (bucket) bucket.count++;
      else unknownAge++;
    }
    const ageChart = ageBuckets.filter(b => b.count > 0).map(b => ({
      name: b.name,
      value: b.count,
    }));
    if (unknownAge > 0) ageChart.push({ name: 'غير محدد', value: unknownAge });

    // ===== Department × Gender =====
    const deptGenderChart = studentsByDeptRaw
      .filter(d => d.students.length > 0)
      .map(d => ({
        name: d.name,
        ذكور: d.students.filter(s => s.gender === 'ذكر').length,
        إناث: d.students.filter(s => s.gender === 'أنثى').length,
        المجموع: d.students.length,
      }))
      .sort((a, b) => b.المجموع - a.المجموع)
      .slice(0, 10);

    // ===== Helper: month key =====
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = (d: Date) => d.toLocaleDateString('ar', { month: 'short', year: 'numeric' });

    // Build list of months
    const monthsList: { key: string; label: string; date: Date }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsList.push({ key: monthKey(d), label: monthLabel(d), date: d });
    }

    // ===== Monthly attendance =====
    const attendanceByMonth = new Map<string, { total: number; male: number; female: number; sessions: number }>();
    for (const a of attendanceMonthlyRaw) {
      const k = monthKey(a.date);
      const e = attendanceByMonth.get(k) || { total: 0, male: 0, female: 0, sessions: 0 };
      e.total += a.totalCount;
      e.male += a.maleCount;
      e.female += a.femaleCount;
      e.sessions++;
      attendanceByMonth.set(k, e);
    }
    const monthlyAttendanceChart = monthsList.map(m => {
      const e = attendanceByMonth.get(m.key) || { total: 0, male: 0, female: 0, sessions: 0 };
      return {
        name: m.label,
        المجموع: e.total,
        ذكور: e.male,
        إناث: e.female,
        جلسات: e.sessions,
      };
    });

    // ===== Monthly revenue vs expenses =====
    const paymentsByMonth = new Map<string, number>();
    for (const p of paymentsMonthlyRaw as any[]) {
      const k = monthKey(p.paymentDate);
      paymentsByMonth.set(k, (paymentsByMonth.get(k) || 0) + p.amount);
    }
    const expensesByMonth = new Map<string, number>();
    for (const e of expensesMonthlyRaw as any[]) {
      const k = monthKey(e.date);
      expensesByMonth.set(k, (expensesByMonth.get(k) || 0) + e.amount);
    }
    const monthlyFinanceChart = monthsList.map(m => {
      const income = paymentsByMonth.get(m.key) || 0;
      const expenses = expensesByMonth.get(m.key) || 0;
      return {
        name: m.label,
        المداخيل: income,
        المصاريف: expenses,
        الصافي: income - expenses,
      };
    });

    // ===== Revenue by payment type =====
    const paymentTypeMap = new Map<string, number>();
    const paymentTypeLabels: Record<string, string> = {
      registration: 'تسجيل',
      installment: 'قسط',
      full: 'دفع كامل',
    };
    for (const p of paymentsMonthlyRaw as any[]) {
      const k = paymentTypeLabels[p.paymentType] || p.paymentType;
      paymentTypeMap.set(k, (paymentTypeMap.get(k) || 0) + p.amount);
    }
    const revenueByTypeChart = Array.from(paymentTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      gender: genderChart,
      status: statusChart,
      age: ageChart,
      deptGender: deptGenderChart,
      monthlyAttendance: monthlyAttendanceChart,
      monthlyFinance: monthlyFinanceChart,
      revenueByType: revenueByTypeChart,
      months,
      isDirector,
      lastUpdate: now.toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/dashboard/charts error:', error);
    return NextResponse.json({ error: 'خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
