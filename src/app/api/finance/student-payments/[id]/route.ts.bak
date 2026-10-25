import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/finance/staff-payments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    let payment: any = null;
    try {
      payment = await (db as any).staffPayment.findUnique({ where: { id } });
    } catch {
      const result = await db.$queryRawUnsafe(
        `SELECT * FROM "StaffPayment" WHERE "id" = ?`,
        id
      ) as any[];
      payment = result[0] || null;
    }

    if (!payment) {
      return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ payment });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/finance/staff-payments/[id] error:', error);
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
    if (body.paymentDate !== undefined) data.paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    if (body.month !== undefined) data.month = body.month || null;
    if (body.note !== undefined) data.note = body.note || null;

    let payment: any;
    try {
      payment = await (db as any).staffPayment.update({
        where: { id },
        data,
      });
    } catch (prismaErr: any) {
      console.log('Prisma update failed, using raw SQL:', prismaErr.message);
      // Raw SQL fallback
      const setClauses: string[] = [];
      const setValues: any[] = [];
      const now = new Date().toISOString();

      if (data.staffName !== undefined) { setClauses.push('"staffName" = ?'); setValues.push(data.staffName); }
      if (data.staffRole !== undefined) { setClauses.push('"staffRole" = ?'); setValues.push(data.staffRole); }
      if (data.amount !== undefined) { setClauses.push('"amount" = ?'); setValues.push(data.amount); }
      if (data.paymentDate !== undefined) { setClauses.push('"paymentDate" = ?'); setValues.push(data.paymentDate); }
      if (data.month !== undefined) { setClauses.push('"month" = ?'); setValues.push(data.month); }
      if (data.note !== undefined) { setClauses.push('"note" = ?'); setValues.push(data.note); }
      setClauses.push('"updatedAt" = ?'); setValues.push(now);

      setValues.push(id);
      const sql = `UPDATE "StaffPayment" SET ${setClauses.join(', ')} WHERE "id" = ?`;
      await db.$executeRawUnsafe(sql, ...setValues);
      payment = { id, ...body, updatedAt: now };
    }

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'update',
          module: 'finance', description: `تعديل راتب موظف: ${body.staffName || ''}`,
          targetType: 'staff_payment', targetId: id,
        },
      });
    } catch (e) {}

    return NextResponse.json({ payment });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/finance/staff-payments/[id] error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/finance/staff-payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    console.log('DELETE staff payment, id:', id);

    // Try Prisma first
    try {
      await (db as any).staffPayment.delete({ where: { id } });
      console.log('Deleted via Prisma');
    } catch (prismaErr: any) {
      console.log('Prisma delete failed, using raw SQL:', prismaErr.message);
      // Raw SQL fallback
      try {
        await db.$executeRawUnsafe(`DELETE FROM "StaffPayment" WHERE "id" = ?`, id);
        console.log('Deleted via raw SQL');
      } catch (rawErr: any) {
        console.error('Both delete methods failed:', rawErr.message);
        return NextResponse.json({
          error: 'تعذر الحذف: ' + rawErr.message,
          details: rawErr.message,
        }, { status: 500 });
      }
    }

    // Log activity
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'delete',
          module: 'finance', description: `حذف راتب موظف`,
          targetType: 'staff_payment', targetId: id,
        },
      });
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'تم الحذف' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/finance/staff-payments/[id] error:', error);
    return NextResponse.json({
      error: error.message || 'حدث خطأ',
      details: error.message,
    }, { status: 500 });
  }
}
