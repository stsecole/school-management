import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/installments/dashboard
 * لوحة تحكم الأقساط: KPIs + قائمة الطلاب بأقساطهم
 * Query: ?planId=xxx&status=PENDING&search=احمد
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search') || '';

    // بناء شروط البحث
    const where: any = {};
    if (planId) where.paymentPlanId = planId;
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;

    // جلب الأقساط مع بيانات الطالب
    const installments = await db.installment.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, studentNumber: true, phone: true, department: { select: { name: true } } } },
        payment: { select: { id: true, receiptNumber: true, paymentDate: true, paymentMethod: true } },
        paymentPlan: { select: { id: true, name: true } },
      },
      orderBy: [{ student: { name: 'asc' } }, { installmentNumber: 'asc' }],
      take: 500,
    });

    // فلترة بالبحث النصي
    let filtered = installments;
    if (search) {
      filtered = installments.filter(i =>
        i.student.name.includes(search) ||
        i.student.studentNumber?.includes(search) ||
        i.student.phone?.includes(search)
      );
    }

    // حساب الإحصائيات
    const allInstallments = await db.installment.findMany({
      where: planId ? { paymentPlanId: planId } : {},
      select: { amount: true, status: true },
    });

    const totalAmount = allInstallments.reduce((s, i) => s + i.amount, 0);
    const totalPaid = allInstallments.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
    const totalRemaining = totalAmount - totalPaid;
    const totalOverdue = allInstallments.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0);

    const stats = {
      totalAmount,
      totalPaid,
      totalRemaining,
      totalOverdue,
      totalCount: allInstallments.length,
      paidCount: allInstallments.filter(i => i.status === 'PAID').length,
      pendingCount: allInstallments.filter(i => i.status === 'PENDING').length,
      dueCount: allInstallments.filter(i => i.status === 'DUE').length,
      overdueCount: allInstallments.filter(i => i.status === 'OVERDUE').length,
    };

    // المستخدم العادي يرى أقساطه فقط
    if (user.role === 'employee') {
      // الموظف العادي: نحتاج ربطه بالطالب، لكن في النظام الحالي الموظف ليس طالباً
      // لذا نعرض له البيانات المجمعة فقط بدون أسماء الطلاب
      return NextResponse.json({
        stats,
        installments: [],
        message: 'صلاحيات العرض غير متاحة للموظفين',
      });
    }

    return NextResponse.json({
      stats,
      installments: filtered,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/installments/dashboard error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
