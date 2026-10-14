import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/installments/add-student
 * إضافة طالب لخطة دفع موجودة + توليد أقساطه
 * Body: { planId, studentId }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }

    const body = await request.json();
    const { planId, studentId } = body;

    if (!planId || !studentId) {
      return NextResponse.json({ error: 'planId و studentId مطلوبان' }, { status: 400 });
    }

    const plan = await db.paymentPlan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: 'الخطة غير موجودة' }, { status: 404 });

    // التحقق من عدم وجود أقساط سابقة
    const existing = await db.installment.findFirst({
      where: { paymentPlanId: planId, studentId },
    });
    if (existing) {
      return NextResponse.json({ error: 'الطالب مضاف بالفعل لهذه الخطة' }, { status: 400 });
    }

    // توليد الأقساط
    const installmentsData = [];
    for (let i = 0; i < plan.monthsCount; i++) {
      const dueDate = new Date(plan.startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      installmentsData.push({
        paymentPlanId: planId,
        studentId,
        amount: plan.monthlyAmount,
        installmentNumber: i + 1,
        dueDate,
        status: 'PENDING',
      });
    }

    await db.installment.createMany({ data: installmentsData });

    return NextResponse.json({
      ok: true,
      installmentsCreated: installmentsData.length,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST /api/installments/add-student error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
