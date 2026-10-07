import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/students/[id]/installments - list all installments for a student
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const student = await db.student.findUnique({
      where: { id },
      include: { department: true, specialization: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    const installments = await db.installmentPlan.findMany({
      where: { studentId: id },
      include: { payments: true },
      orderBy: { monthNumber: 'asc' },
    });

    const totalExpected = installments.reduce((s, i) => s + i.expectedAmount, 0);
    const totalPaid = installments.reduce((s, i) => s + i.paidAmount, 0);
    const remaining = totalExpected - totalPaid;

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        department: student.department,
        specialization: student.specialization,
        courseStartDate: student.courseStartDate,
        totalAmount: student.totalAmount,
        initialPayment: student.initialPayment,
      },
      installments,
      totalExpected,
      totalPaid,
      remaining,
      paidCount: installments.filter(i => i.status === 'paid').length,
      pendingCount: installments.filter(i => i.status === 'pending').length,
      partialCount: installments.filter(i => i.status === 'partial').length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/students/[id]/installments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT /api/students/[id]/installments - bulk update installments
// Body: { installments: [{ id, paidAmount, paidDate, status, notes }] }
// This route also creates/updates StudentPayment records linked to each installment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (!body.installments || !Array.isArray(body.installments)) {
      return NextResponse.json({ error: 'صيغة البيانات غير صحيحة' }, { status: 400 });
    }

    const results = [];

    // Use a transaction for atomicity
    await db.$transaction(async (tx) => {
      for (const item of body.installments) {
        if (!item.id) continue;

        const existing = await tx.installmentPlan.findUnique({ where: { id: item.id } });
        if (!existing) continue;

        const newPaidAmount = parseFloat(item.paidAmount) || 0;
        const oldPaidAmount = existing.paidAmount;
        const difference = newPaidAmount - oldPaidAmount;

        // Determine status
        let status = item.status || 'pending';
        if (newPaidAmount >= existing.expectedAmount) {
          status = 'paid';
        } else if (newPaidAmount > 0) {
          status = 'partial';
        } else {
          status = 'pending';
        }

        // Update the installment
        const updated = await tx.installmentPlan.update({
          where: { id: item.id },
          data: {
            paidAmount: newPaidAmount,
            paidDate: item.paidDate ? new Date(item.paidDate) : null,
            status,
            notes: item.notes || null,
          },
        });

        // If there's a difference in paid amount, sync with StudentPayment records
        if (Math.abs(difference) > 0.01) {
          if (difference > 0) {
            // Increased: create a new StudentPayment linked to this installment
            const setting = await tx.setting.findUnique({ where: { key: 'receipt_counter' } });
            let counter = setting ? parseInt(setting.value) : 2000;
            counter++;
            await tx.setting.upsert({
              where: { key: 'receipt_counter' },
              update: { value: String(counter) },
              create: { key: 'receipt_counter', value: String(counter) },
            });

            await tx.studentPayment.create({
              data: {
                receiptNumber: `W-${counter}`,
                studentId: id,
                amount: difference,
                paymentType: 'installment',
                paymentLabel: `قسط شهر ${existing.monthNumber}`,
                paymentDate: item.paidDate ? new Date(item.paidDate) : new Date(),
                paymentMethod: 'cash',
                installmentId: item.id,
                notes: `دفعة من جدول الأقساط - الشهر ${existing.monthNumber}`,
              },
            });
          } else {
            // Decreased: find and remove/update the most recent payment for this installment
            const payments = await tx.studentPayment.findMany({
              where: { installmentId: item.id },
              orderBy: { paymentDate: 'desc' },
            });
            let amountToRemove = Math.abs(difference);
            for (const p of payments) {
              if (amountToRemove <= 0) break;
              if (p.amount <= amountToRemove) {
                await tx.studentPayment.delete({ where: { id: p.id } });
                amountToRemove -= p.amount;
              } else {
                await tx.studentPayment.update({
                  where: { id: p.id },
                  data: { amount: p.amount - amountToRemove },
                });
                amountToRemove = 0;
              }
            }
          }
        }

        results.push(updated);
      }
    });

    return NextResponse.json({ updated: results.length, installments: results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/students/[id]/installments error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}
