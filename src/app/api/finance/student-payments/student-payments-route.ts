import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

// GET /api/finance/student-payments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };
    if (studentId) where.studentId = studentId;
    if (startDate && endDate) {
      where.paymentDate = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const payments = await db.studentPayment.findMany({
      where,
      include: { student: { include: { department: true } } },
      orderBy: { paymentDate: 'desc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({ payments, total });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/finance/student-payments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/finance/student-payments
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();

    // Generate receipt number
    const setting = await db.setting.findUnique({ where: { key: 'receipt_counter' } });
    let counter = setting ? parseInt(setting.value) : 2000;
    counter++;
    await db.setting.upsert({
      where: { key: 'receipt_counter' },
      update: { value: String(counter) },
      create: { key: 'receipt_counter', value: String(counter) },
    });
    // Capture branch ID once (outside transaction — cookies() can't be awaited in tx)
   

    // Get branch receipt prefix (e.g., X, Y, Z) — if no branch, use 'W' (default)
    let receiptPrefix = 'W';
    if (newBranchId) {
      const branch = await db.branch.findUnique({ where: { id: newBranchId }, select: { receiptPrefix: true } });
      if (branch?.receiptPrefix) receiptPrefix = branch.receiptPrefix;
    }
    const receiptNumber = receiptPrefix + '-' + counter;

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
    }

    // Use transaction for payment + installment update
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.studentPayment.create({
        data: {
          receiptNumber,
          studentId: body.studentId,
          amount,
          paymentType: body.paymentType || 'installment',
          paymentLabel: body.paymentLabel || null,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          paymentMethod: body.paymentMethod || 'cash',
          installmentId: body.installmentId || null,
          notes: body.notes || null,
          branchId: newBranchId,
        },
        include: { student: true },
      });

      // Update installment status if installmentId is provided
      if (body.installmentId) {
        const installment = await tx.installmentPlan.findUnique({
          where: { id: body.installmentId },
        });

        if (installment) {
          const newPaidAmount = installment.paidAmount + amount;
          let newStatus = 'pending';
          if (newPaidAmount >= installment.expectedAmount) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partial';
          }

          await tx.installmentPlan.update({
            where: { id: body.installmentId },
            data: {
              paidAmount: newPaidAmount,
              paidDate: new Date(),
              status: newStatus,
            },
          });
        }
      }

      return newPayment;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/finance/student-payments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
