import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET - raw SQL فقط
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const result = await db.$queryRawUnsafe(
      `SELECT * FROM "StaffPayment" WHERE "id" = ?`, id
    ) as any[];
    const payment = result[0] || null;
    if (!payment) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    return NextResponse.json({ payment });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// PUT - raw SQL فقط
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const now = new Date().toISOString();

    const setClauses: string[] = [];
    const setValues: any[] = [];

    if (body.staffName !== undefined) { setClauses.push('"staffName" = ?'); setValues.push(body.staffName); }
    if (body.staffRole !== undefined) { setClauses.push('"staffRole" = ?'); setValues.push(body.staffRole || null); }
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
      setClauses.push('"amount" = ?'); setValues.push(amount);
    }
    if (body.paymentDate !== undefined) { setClauses.push('"paymentDate" = ?'); setValues.push(body.paymentDate ? new Date(body.paymentDate) : new Date()); }
    if (body.month !== undefined) { setClauses.push('"month" = ?'); setValues.push(body.month || null); }
    if (body.note !== undefined) { setClauses.push('"note" = ?'); setValues.push(body.note || null); }
    setClauses.push('"updatedAt" = ?'); setValues.push(now);

    setValues.push(id);
    const sql = `UPDATE "StaffPayment" SET ${setClauses.join(', ')} WHERE "id" = ?`;
    await db.$executeRawUnsafe(sql, ...setValues);

    return NextResponse.json({ payment: { id, ...body, updatedAt: now } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE - raw SQL فقط
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    // تحقق من وجود السجل
    const checkResult = await db.$queryRawUnsafe(
      `SELECT "id" FROM "StaffPayment" WHERE "id" = ?`, id
    ) as any[];

    if (checkResult.length === 0) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    // احذف
    await db.$executeRawUnsafe(`DELETE FROM "StaffPayment" WHERE "id" = ?`, id);

    return NextResponse.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('DELETE staff payment error:', error);
    return NextResponse.json({
      error: 'تعذر الحذف: ' + (error.message || ''),
    }, { status: 500 });
  }
}
