// ===== GET /api/students/[id]/performance =====
// تحليلات أداء الطالب: الحضور، الدفعات، المقارنة بمتوسط القسم
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: studentId } = await params;

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { name: true } },
        level: { select: { name: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    // ===== 1. Attendance analytics (last 6 months) =====
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const attendances = await db.attendance.findMany({
      where: {
        studentId,
        date: { gte: sixMonthsAgo },
      },
      select: { date: true, courseName: true, startTime: true, endTime: true, durationMinutes: true },
      orderBy: { date: 'asc' },
    });

    // Group by month
    const ARABIC_MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthlyAttendance: { month: string; count: number; totalDuration: number }[] = [];
    const monthMap = new Map<string, { count: number; totalDuration: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      monthMap.set(key, { count: 0, totalDuration: 0 });
    }
    for (const a of attendances) {
      const d = new Date(a.date);
      const key = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      const existing = monthMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalDuration += a.durationMinutes || 0;
      }
    }
    for (const [month, data] of monthMap) {
      monthlyAttendance.push({ month, ...data });
    }

    // ===== 2. Department average attendance (for comparison) =====
    let deptAvgAttendance = 0;
    if (student.departmentId) {
      const deptStudents = await db.student.count({
        where: { departmentId: student.departmentId, status: { in: ['registered', 'continuing'] } },
      });
      const deptAttendances = await db.attendance.count({
        where: {
          date: { gte: sixMonthsAgo },
          student: { departmentId: student.departmentId },
        },
      });
      deptAvgAttendance = deptStudents > 0 ? Math.round(deptAttendances / deptStudents) : 0;
    }

    // ===== 3. Payment analytics =====
    const payments = await db.studentPayment.findMany({
      where: { studentId },
      orderBy: { paymentDate: 'asc' },
      select: { amount: true, paymentDate: true, paymentType: true, paymentLabel: true },
    });

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const paymentsByMonth: { month: string; amount: number }[] = [];
    const payMonthMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      payMonthMap.set(key, 0);
    }
    for (const p of payments) {
      const d = new Date(p.paymentDate);
      const key = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (payMonthMap.has(key)) {
        payMonthMap.set(key, (payMonthMap.get(key) || 0) + p.amount);
      }
    }
    for (const [month, amount] of payMonthMap) {
      paymentsByMonth.push({ month, amount });
    }

    // Installment status
    const installments = await db.installmentPlan.findMany({
      where: { studentId },
      orderBy: { monthNumber: 'asc' },
    });
    const totalExpected = installments.reduce((s, i) => s + i.expectedAmount, 0);
    const totalPaidInstallments = installments.reduce((s, i) => s + i.paidAmount, 0);
    const remaining = Math.max(0, totalExpected - totalPaidInstallments);
    const overdueInstallments = installments.filter(i =>
      (i.status === 'late' || (i.status === 'pending' && new Date(i.expectedDate) < now))
    ).length;

    // ===== 4. Alerts =====
    const alerts: { type: 'danger' | 'warning' | 'info'; text: string }[] = [];

    // Attendance rate (last month)
    const lastMonthKey = monthlyAttendance[monthlyAttendance.length - 1];
    if (lastMonthKey && lastMonthKey.count === 0) {
      alerts.push({ type: 'danger', text: 'لم يحضر الطالب في الشهر الماضي على الإطلاق' });
    } else if (lastMonthKey && deptAvgAttendance > 0 && lastMonthKey.count < deptAvgAttendance * 0.5) {
      alerts.push({ type: 'warning', text: `حضور الشهر الماضي (${lastMonthKey.count}) أقل بـ 50% من متوسط القسم (${deptAvgAttendance})` });
    }

    // Overdue installments
    if (overdueInstallments > 0) {
      alerts.push({ type: 'danger', text: `${overdueInstallments} قسط متأخر السداد` });
    }

    // Remaining amount
    if (remaining > 0) {
      alerts.push({ type: 'warning', text: `متبقي ${remaining.toLocaleString('en-US')} دج من إجمالي الأقساط` });
    }

    // Good attendance
    if (lastMonthKey && lastMonthKey.count > 0 && deptAvgAttendance > 0 && lastMonthKey.count >= deptAvgAttendance) {
      alerts.push({ type: 'info', text: 'معدل الحضور ممتاز — يطابق أو يتجاوز متوسط القسم' });
    }

    // ===== 5. Summary stats =====
    const totalAttendanceDays = attendances.length;
    const totalDurationHours = Math.round(attendances.reduce((s, a) => s + (a.durationMinutes || 0), 0) / 60);
    const avgMonthlyAttendance = Math.round(totalAttendanceDays / 6);

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        department: student.department?.name || null,
        level: student.level?.name || null,
        status: student.status,
        gender: student.gender,
      },
      attendance: {
        monthly: monthlyAttendance,
        totalDays: totalAttendanceDays,
        totalDurationHours,
        avgMonthly: avgMonthlyAttendance,
        deptAverage: deptAvgAttendance,
      },
      payments: {
        monthly: paymentsByMonth,
        totalPaid,
        totalPayments: payments.length,
        installments: installments.length > 0 ? {
          total: installments.length,
          totalExpected,
          totalPaid: totalPaidInstallments,
          remaining,
          overdue: overdueInstallments,
        } : null,
      },
      alerts,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/students/[id]/performance error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
