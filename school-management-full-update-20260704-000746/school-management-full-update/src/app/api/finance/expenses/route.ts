import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// GET /api/finance/expenses - list expenses (director only)
export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');

    const where: any = {};
    if (search) {
      where.OR = [
        { type: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (type && type !== 'all') where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const expenses = await db.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Group totals by type
    const byType: Record<string, number> = {};
    for (const e of expenses) {
      byType[e.type] = (byType[e.type] || 0) + e.amount;
    }

    return NextResponse.json({ expenses, total, byType });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('GET /api/finance/expenses error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/finance/expenses - create expense (director only)
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    if (!body.type || !body.amount || !body.date) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة (النوع، المبلغ، التاريخ)' },
        { status: 400 }
      );
    }

    const expense = await db.expense.create({
      data: {
        date: new Date(body.date),
        type: body.type,
        description: body.description || null,
        amount: parseFloat(body.amount),
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('POST /api/finance/expenses error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
