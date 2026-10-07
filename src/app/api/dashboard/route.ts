import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

/**
 * GET /api/dashboard?period=week|month|year|today&departmentId=xxx
 *
 * يُرجع بيانات شاملة للوحة التحكم التفاعلية:
 * - KPIs (مؤشرات الأداء)
 * - رسوم بيانية (حضور، إيرادات، تسجيلات)
 * - توزيع الطلاب
 * - أداء الأساتذة
 * - تنبيهات
 *
 * جميع البيانات مُصفّاة حسب الفرع النشط (للمدير) أو فرع المستخدم (للموظف).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const departmentId = searchParams.get('departmentId') || '';

    // ===== فلتر الفرع =====
    // للمدير: يأخذ من active_branch cookie (كل الفروع أو فرع محدد)
    // للموظف: فرعه فقط
    const branchFilter = await getBranchFilter();

    // حساب النطاق الزمني
    const now = new Date();
    let startDate = new Date();
    let prevStartDate = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
    }

    const endDate = now;
    const prevEndDate = startDate;

    // ===== الفلاتر المركبة =====
    // فلتر القسم (اختياري)
    const deptFilter = departmentId ? { departmentId } : {};

    // فلتر الفرع + القسم للطلاب
    const studentFilter = { ...branchFilter, ...deptFilter };

    // فلتر الفرع + القسم للأساتذة
    const teacherFilter = { ...branchFilter, ...deptFilter };

    // فلتر الفرع + القسم للحضور (عبر العلاقة course.department)
    const attendanceDeptFilter = departmentId ? { course: { departmentId } } : {};
    const attendanceFilter = { ...branchFilter, ...attendanceDeptFilter };

    // فلتر الفرع + القسم للمدفوعات
    const paymentFilter = { ...branchFilter };

    // فلتر الفرع للمصاريف
    const expenseFilter = { ...branchFilter };

    // فلتر الفرع للمهام
    const taskFilter = { ...branchFilter };

    // ===== جلب البيانات =====
    const [
      // الإحصائيات الحالية
      totalStudents,
      totalTeachers,
      totalDepartments,
      newStudentsThisPeriod,
      newStudentsPrevPeriod,
      attendanceThisPeriod,
      attendancePrevPeriod,
      paymentsThisPeriod,
      paymentsPrevPeriod,
      expensesThisPeriod,
      pendingTasks,
      overdueTasks,
      // الرسوم البيانية
      departments,
      topTeachers,
      recentPayments,
      attendanceByDay,
      // تنبيهات
      lateInstallments,
      lowAttendanceCourses,
    ] = await Promise.all([
      db.student.count({ where: { ...studentFilter, status: { in: ['registered', 'continuing'] } } }),
      db.teacher.count({ where: { ...teacherFilter, status: 'active' } }),
      db.department.count(),
      db.student.count({
        where: { ...studentFilter, registrationDate: { gte: startDate, lt: endDate } },
      }),
      db.student.count({
        where: { ...studentFilter, registrationDate: { gte: prevStartDate, lt: prevEndDate } },
      }),
      db.attendance.count({
        where: { date: { gte: startDate, lt: endDate }, ...attendanceFilter },
      }),
      db.attendance.count({
        where: { date: { gte: prevStartDate, lt: prevEndDate }, ...attendanceFilter },
      }),
      isDirector
        ? db.studentPayment.aggregate({
            where: { paymentDate: { gte: startDate, lt: endDate }, ...paymentFilter },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { amount: 0 }, _count: 0 }),
      isDirector
        ? db.studentPayment.aggregate({
            where: { paymentDate: { gte: prevStartDate, lt: prevEndDate }, ...paymentFilter },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { amount: 0 }, _count: 0 }),
      isDirector
        ? db.expense.aggregate({
            where: { date: { gte: startDate, lt: endDate }, ...expenseFilter },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      db.task.count({ where: { ...taskFilter, completed: false } }),
      db.task.count({ where: { ...taskFilter, completed: false, deadline: { lt: now } } }),
      // الرسوم
      db.department.findMany({
        where: departmentId ? { id: departmentId } : undefined,
        include: {
          _count: { select: { students: { where: branchFilter }, teachers: { where: branchFilter }, courses: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // أفضل الأساتذة (حسب الحضور)
      db.teacher.findMany({
        where: { ...teacherFilter, status: 'active' },
        include: {
          attendances: {
            where: { date: { gte: startDate, lt: endDate }, ...branchFilter },
            select: { durationMinutes: true, totalCount: true, date: true },
          },
          _count: { select: { courses: true } },
        },
        take: 10,
      }),
      // آخر الدفعات
      isDirector
        ? db.studentPayment.findMany({
            where: { paymentDate: { gte: startDate, lt: endDate }, ...paymentFilter },
            include: { student: { select: { name: true, studentNumber: true } } },
            orderBy: { paymentDate: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
      // الحضور بالأيام (للرسم البياني)
      db.attendance.findMany({
        where: { date: { gte: startDate, lt: endDate }, ...attendanceFilter },
        select: { date: true, totalCount: true, maleCount: true, femaleCount: true },
        orderBy: { date: 'asc' },
      }),
      // تنبيهات
      isDirector
        ? db.installmentPlan.findMany({
            where: {
              status: { in: ['pending', 'late', 'partial'] },
              expectedDate: { lt: now },
              student: { ...branchFilter },
            },
            include: { student: { select: { name: true, phone: true } } },
            take: 10,
          })
        : Promise.resolve([]),
      db.attendance.findMany({
        where: { date: { gte: startDate, lt: endDate }, ...attendanceFilter },
        select: { courseName: true, totalCount: true },
        take: 100,
      }),
    ]);

    // ===== حساب النسب =====
    const calcChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    const incomeThis = paymentsThisPeriod._sum.amount || 0;
    const incomePrev = paymentsPrevPeriod._sum.amount || 0;
    const expensesTotal = expensesThisPeriod._sum.amount || 0;
    const profit = incomeThis - expensesTotal;

    // ===== تجميع بيانات الرسوم =====

    // الحضور بالأيام
    const attendanceByDayAgg = new Map<string, { total: number; male: number; female: number; date: string }>();
    for (const a of attendanceByDay) {
      const dayKey = a.date.toISOString().split('T')[0];
      const existing = attendanceByDayAgg.get(dayKey) || { total: 0, male: 0, female: 0, date: dayKey };
      existing.total += a.totalCount;
      existing.male += a.maleCount;
      existing.female += a.femaleCount;
      attendanceByDayAgg.set(dayKey, existing);
    }
    const attendanceChart = Array.from(attendanceByDayAgg.values()).map(d => ({
      name: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      المجموع: d.total,
      ذكور: d.male,
      إناث: d.female,
    }));

    // توزيع الطلاب حسب القسم
    const departmentChart = departments.map(d => ({
      name: d.name,
      الطلاب: d._count.students,
      الأساتذة: d._count.teachers,
      الدورات: d._count.courses,
    }));

    // أفضل الأساتذة
    const teachersChart = topTeachers
      .map(t => ({
        name: t.name,
        ساعات: Math.round(t.attendances.reduce((s, a) => s + (a.durationMinutes || 0), 0) / 60),
        جلسات: t.attendances.length,
        طلاب: t.attendances.reduce((s, a) => s + a.totalCount, 0),
      }))
      .filter(t => t.ساعات > 0 || t.جلسات > 0)
      .sort((a, b) => b.ساعات - a.ساعات)
      .slice(0, 8);

    // المداخيل اليومية
    const paymentsByDay = new Map<string, number>();
    for (const p of recentPayments) {
      const dayKey = p.paymentDate.toISOString().split('T')[0];
      paymentsByDay.set(dayKey, (paymentsByDay.get(dayKey) || 0) + p.amount);
    }
    const incomeChart = Array.from(paymentsByDay.entries()).map(([date, amount]) => ({
      name: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      المداخيل: amount,
    })).sort((a, b) => a.name.localeCompare(b.name));

    // ===== KPIs =====
    const kpis = {
      students: {
        current: totalStudents,
        change: calcChange(newStudentsThisPeriod, newStudentsPrevPeriod),
        new: newStudentsThisPeriod,
        label: 'الطلاب',
      },
      teachers: {
        current: totalTeachers,
        change: 0,
        new: 0,
        label: 'الأساتذة',
      },
      attendance: {
        current: attendanceThisPeriod,
        change: calcChange(attendanceThisPeriod, attendancePrevPeriod),
        new: attendanceThisPeriod,
        label: 'سجلات الحضور',
      },
      income: isDirector ? {
        current: incomeThis,
        change: calcChange(incomeThis, incomePrev),
        new: paymentsThisPeriod._count,
        label: 'المداخيل',
        expenses: expensesTotal,
        profit,
      } : null,
    };

    // ===== تنبيهات =====
    const alerts: { type: 'danger' | 'warning' | 'info'; text: string; count: number }[] = [];

    if (overdueTasks > 0) {
      alerts.push({ type: 'danger', text: `${overdueTasks} مهمة متأخرة`, count: overdueTasks });
    }
    if (pendingTasks > 5) {
      alerts.push({ type: 'warning', text: `${pendingTasks} مهام معلقة`, count: pendingTasks });
    }
    if (lateInstallments.length > 0) {
      const total = lateInstallments.reduce((s, i) => s + (i.expectedAmount - i.paidAmount), 0);
      alerts.push({
        type: 'warning',
        text: `${lateInstallments.length} قسط متأخر (${total.toLocaleString('ar-DZ')} دج)`,
        count: lateInstallments.length,
      });
    }
    if (isDirector && profit < 0) {
      alerts.push({ type: 'danger', text: `صافي خسارة: ${profit.toLocaleString('ar-DZ')} دج`, count: 1 });
    }

    // ===== بيانات المستوى المتقدم =====
    const lowAttendance = new Map<string, { count: number; total: number }>();
    for (const a of lowAttendanceCourses) {
      const k = a.courseName || 'غير محدد';
      const existing = lowAttendance.get(k) || { count: 0, total: 0 };
      existing.count++;
      existing.total += a.totalCount;
      lowAttendance.set(k, existing);
    }
    const lowAttendanceList = Array.from(lowAttendance.entries())
      .map(([name, v]) => ({ name, avg: v.count > 0 ? Math.round(v.total / v.count) : 0, sessions: v.count }))
      .filter(v => v.avg < 5)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);

    return NextResponse.json({
      period,
      departmentId,
      kpis,
      alerts,
      charts: {
        attendance: attendanceChart,
        departments: departmentChart,
        teachers: teachersChart,
        income: incomeChart,
        lowAttendance: lowAttendanceList,
      },
      recentPayments: recentPayments.slice(0, 10),
      lateInstallments: lateInstallments.slice(0, 5),
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        students: d._count.students,
        teachers: d._count.teachers,
        courses: d._count.courses,
      })),
      isDirector,
      lastUpdate: now.toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/dashboard error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
