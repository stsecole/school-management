import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

// GET /api/finance/staff-payments/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    let payment: any = null;
    try {
      payment = await (db as any).staffPayment.findUnique({ where: { id } });
    } catch {
      return NextResponse.json({ error: 'جدول رواتب الموظفين غير موجود. شغّل: npx prisma db push' }, { status: 500 });
    }

    if (!payment) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json({ payment });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET staff-payment error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// PUT /api/finance/staff-payments/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // تحقق من وجود السجل
    let existing: any = null;
    try {
      existing = await (db as any).staffPayment.findUnique({ where: { id } });
    } catch {
      return NextResponse.json({ error: 'جدول رواتب الموظفين غير موجود. شغّل: npx prisma db push' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    // جهّز البيانات للتحديث
    const data: any = {};
    if (body.staffName !== undefined) data.staffName = body.staffName;
    if (body.staffRole !== undefined) data.staffRole = body.staffRole || null;
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
      }
      data.amount = amount;
    }
    if (body.paymentDate !== undefined) {
      data.paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    }
    if (body.month !== undefined) data.month = body.month || null;
    if (body.note !== undefined) data.note = body.note || null;

    // حدّث
    const updated = await (db as any).staffPayment.update({
      where: { id },
      data,
    });

    // سجل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'update',
          module: 'finance',
          description: `تعديل راتب موظف: ${existing.staffName} - ${existing.amount} دج`,
          targetType: 'staff_payment',
          targetId: id,
        },
      });
    } catch {}

    return NextResponse.json({ payment: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('PUT staff-payment error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/finance/staff-payments/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // تحقق من وجود السجل
    let existing: any = null;
    try {
      existing = await (db as any).staffPayment.findUnique({ where: { id } });
    } catch {
      return NextResponse.json({ error: 'جدول رواتب الموظفين غير موجود. شغّل: npx prisma db push' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    // احذف
    await (db as any).staffPayment.delete({ where: { id } });

    // سجل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'delete',
          module: 'finance',
          description: `حذف راتب موظف: ${existing.staffName} - ${existing.amount} دج`,
          targetType: 'staff_payment',
          targetId: id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('DELETE staff-payment error:', error);
    return NextResponse.json({
      error: 'تعذر الحذف: ' + (error.message || ''),
    }, { status: 500 });
  }
}
