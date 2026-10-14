import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/installments/payments
 * تسجيل دفعة (مفردة أو مجمعة)
 * Body: {
 *   installments: [{ id, amount }],  // قائمة الأقساط المراد دفعها
 *   paymentMethod: string,
 *   paymentDate?: string,
 *   notes?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { installments, paymentMethod, paymentDate, notes } = body;

    if (!installments || !Array.isArray(installments) || installments.length === 0) {
      return NextResponse.json({ error: 'قائمة الأقساط مطلوبة' }, { status: 400 });
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'طريقة الدفع مطلوبة' }, { status: 400 });
    }

    // توليد رقم وصل موحد
    const setting = await db.setting.findUnique({ where: { key: 'receipt_counter' } });
    let counter = setting ? parseInt(setting.value) : 2000;
    counter++;
    const receiptNumber = `W-${counter}`;
    await db.setting.upsert({
      where: { key: 'receipt_counter' },
      update: { value: String(counter) },
      create: { key: 'receipt_counter', value: String(counter) },
    });

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const results: any[] = [];

    // معاملة آمنة (Atomic Transaction)
    await db.$transaction(async (tx) => {
      for (const item of installments) {
        const inst = await tx.installment.findUnique({ where: { id: item.id } });
        if (!inst) continue;
        if (inst.status === 'PAID') continue; // تخطي المدفوع

        // إنشاء سجل الدفع
        const payment = await tx.payment.create({
          data: {
            installmentId: inst.id,
            studentId: inst.studentId,
            amountPaid: parseFloat(item.amount) || inst.amount,
            paymentDate: payDate,
            paymentMethod,
            receiptNumber,
          },
        });

        // تحديث حالة القسط
        await tx.installment.update({
          where: { id: inst.id },
          data: { status: 'PAID' },
        });

        results.push({ installmentId: inst.id, paymentId: payment.id });
      }
    });

    return NextResponse.json({
      ok: true,
      receiptNumber,
      paymentsCount: results.length,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST /api/installments/payments error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم', details: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/installments/payments?receiptNumber=xxx
 * تراجع عن دفعة (يُعيد القسط لحالته السابقة)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const receiptNumber = searchParams.get('receiptNumber');
    if (!receiptNumber) return NextResponse.json({ error: 'رقم الوصل مطلوب' }, { status: 400 });

    await db.$transaction(async (tx) => {
      // جلب كل الدفعات بهذا الرقم
      const payments = await tx.payment.findMany({ where: { receiptNumber } });

      // إعادة الأقساط لحالتها السابقة + حذف الدفعات
      for (const p of payments) {
        await tx.installment.update({
          where: { id: p.installmentId },
          data: { status: 'PENDING' },
        });
        await tx.payment.delete({ where: { id: p.id } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('DELETE /api/installments/payments error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
