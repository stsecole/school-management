import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// DELETE /api/finance/student-payments/[id] - director only
// If the payment is linked to an installment, decrement the installment's paid amount
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;

    // Use a transaction to ensure both operations succeed together
    await db.$transaction(async (tx) => {
      // Find the payment first
      const payment = await tx.studentPayment.findUnique({ where: { id } });
      if (!payment) {
        throw new Error('PAYMENT_NOT_FOUND');
      }

      // If linked to an installment, decrement its paid amount
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

      // Delete the payment
      await tx.studentPayment.delete({ where: { id } });
    });

    return NextResponse.json({ message: 'تم حذف الدفعة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'الحذف متاح للمدير فقط' }, { status: 403 });
    }
    if (error.message === 'PAYMENT_NOT_FOUND') {
      return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    }
    console.error('DELETE student-payment error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
