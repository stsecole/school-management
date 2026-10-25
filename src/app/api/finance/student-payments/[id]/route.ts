import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

// DELETE /api/finance/student-payments/[id]
// يسمح لأي مستخدم مصدّق بحذف الدفعة (مع التحقق من الفرع)
// إذا كانت الدفعة مرتبطة بقسط، يُنقص المبلغ المدفوع من القسط
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const branchFilter = await getBranchFilter();

    // Use a transaction to ensure both operations succeed together
    await db.$transaction(async (tx) => {
      // Find the payment first (مفلتر بالفرع)
      const payment = await tx.studentPayment.findFirst({
        where: { id, ...branchFilter },
      });
      if (!payment) {
        throw new Error('PAYMENT_NOT_FOUND');
      }

      // احذف سجلات توزيع المدفوعات المرتبطة (PaymentAllocation)
      // واحفظ قائمة بالأقساط المتأثرة لتحديثها لاحقاً
      const affectedAllocations: { installmentId: string; amount: number }[] = [];
      try {
        const allocations = await tx.paymentAllocation.findMany({
          where: { paymentId: id },
        });
        affectedAllocations.push(...allocations.map(a => ({ installmentId: a.installmentId, amount: a.amount })));
        await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
      } catch (e) {
        // تجاهل الأخطاء — ربما لا توجد سجلات (للدفعات القديمة)
      }

      // If linked to an installment directly (payment.installmentId), decrement
      if (payment.installmentId) {
        const installment = await tx.installmentPlan.findUnique({
          where: { id: payment.installmentId },
        });
        if (installment) {
          const newPaidAmount = Math.max(0, installment.paidAmount - payment.amount);
          let newStatus = 'pending';
          if (newPaidAmount >= installment.expectedAmount) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partial';
          }
          await tx.installmentPlan.update({
            where: { id: payment.installmentId },
            data: {
              paidAmount: newPaidAmount,
              paidDate: newPaidAmount > 0 ? installment.paidDate : null,
              status: newStatus,
            },
          });
        }
      }

      // عكس توزيع المدفوعات على الأقساط (PaymentAllocation)
      // كل توزيع يُنقص المبلغ المدفوع من القسط المناسب
      for (const alloc of affectedAllocations) {
        const installment = await tx.installmentPlan.findUnique({
          where: { id: alloc.installmentId },
        });
        if (installment) {
          const newPaidAmount = Math.max(0, installment.paidAmount - alloc.amount);
          let newStatus = 'pending';
          if (newPaidAmount >= installment.expectedAmount) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partial';
          }
          await tx.installmentPlan.update({
            where: { id: alloc.installmentId },
            data: {
              paidAmount: newPaidAmount,
              paidDate: newPaidAmount > 0 ? installment.paidDate : null,
              status: newStatus,
            },
          });
        }
      }

      // Delete the payment
      await tx.studentPayment.delete({ where: { id } });

      // سجل النشاط
      try {
        await tx.activityLog.create({
          data: {
            userId: user.id,
            userName: user.name,
            action: 'delete',
            module: 'finance',
            description: `حذف دفعة وصل رقم ${payment.receiptNumber} - ${payment.amount} دج`,
            targetType: 'payment',
            targetId: id,
          },
        });
      } catch {}
    });

    return NextResponse.json({ message: 'تم حذف الدفعة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'الدفعة غير موجودة أو لا تخص فرعك' }, { status: 404 });
    }
    console.error('DELETE student-payment error:', error);
    return NextResponse.json({
      error: 'حدث خطأ: ' + (error.message || ''),
    }, { status: 500 });
  }
}
