import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/finance/student-payments - any authenticated user can view student payments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const studentId = searchParams.get('studentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { student: { name: { contains: search } } },
        { student: { studentNumber: { contains: search } } },
      ];
    }

    const payments = await db.studentPayment.findMany({
      where,
      include: {
        student: {
          include: {
            department: true,
            specialization: true,
          },
        },
        installment: true,
      },
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

// POST /api/finance/student-payments - record a student payment
// If installmentId is provided, link the payment to that installment and update its status
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
    const receiptNumber = `W-${counter}`;

    const amount = parseFloat(body.amount);

    // Use a transaction to ensure both payment and installment update succeed together
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.studentPayment.create({
        data: {
          receiptNumber,
          studentId: body.studentId,
          amount,
          paymentType: body.paymentType || 'installment',
          paymentLabel: body.paymentLabel || 'قسط',
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          paymentMethod: body.paymentMethod || 'cash',
          installmentId: body.installmentId || null,
          notes: body.notes || null,
        },
        include: {
          student: { include: { department: true, specialization: true } },
          installment: true,
        },
      });

      // If linked to an installment, update the installment's paid amount and status
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
              paidDate: newPayment.paymentDate,
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
