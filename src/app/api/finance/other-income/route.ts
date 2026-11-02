import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// PUT /api/finance/other-income/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.otherIncome.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    const data: any = {};
    if (body.source !== undefined) data.source = body.source;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
      data.amount = amount;
    }
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : new Date();

    const updated = await db.otherIncome.update({ where: { id }, data });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'update', module: 'finance',
          description: `تعديل مدخل آخر: ${existing.source} - ${existing.amount} دج`,
          targetType: 'other_income', targetId: id,
        },
      });
    } catch {}

    return NextResponse.json({ income: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('PUT other-income error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/finance/other-income/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await db.otherIncome.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

    await db.otherIncome.delete({ where: { id } });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'delete', module: 'finance',
          description: `حذف مدخل آخر: ${existing.source} - ${existing.amount} دج`,
          targetType: 'other_income', targetId: id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'تم الحذف' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('DELETE other-income error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
