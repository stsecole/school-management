import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';

// GET /api/finance/teacher-payments - director only
export async function GET(request: NextRequest) {
  try {
    await requireDirector();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const teacherId = searchParams.get('teacherId');
    const month = searchParams.get('month');

    const where: any = {};
    if (teacherId) where.teacherId = teacherId;
    if (month) where.month = month;
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { teacher: { name: { contains: search } } },
      ];
    }

    const payments = await db.teacherPayment.findMany({
      where,
      include: { teacher: { include: { department: true } } },
      orderBy: { paymentDate: 'desc' },
    });

    // استثني الوصولات المشطوبة من المجموع
    const total = payments
      .filter((p: any) => !p.isCancelled)
      .reduce((sum, p) => sum + p.amount, 0);
    return NextResponse.json({ payments, total });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'القسم المالي متاح للمدير فقط' }, { status: 403 });
    }
    if (error.message === 'FINANCE_AUTH_REQUIRED') {
      return NextResponse.json({ error: 'يلزم إدخال كلمة سر القسم المالي' }, { status: 403 });
    }
    console.error('GET /api/finance/teacher-payments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/finance/teacher-payments - director only
export async function POST(request: NextRequest) {
  try {
    await requireDirector();

    const body = await request.json();

    // Generate receipt number
    const setting = await db.setting.findUnique({ where: { key: 'teacher_receipt_counter' } });
    let counter = setting ? parseInt(setting.value) : 5000;
    counter++;
    await db.setting.upsert({
      where: { key: 'teacher_receipt_counter' },
      update: { value: String(counter) },
      create: { key: 'teacher_receipt_counter', value: String(counter) },
    });
    // Get branch receipt prefix
    const newBranchId = await getBranchIdForNewRecord();
    let receiptPrefix = 'TS';
    if (newBranchId) {
      const branch = await db.branch.findUnique({ where: { id: newBranchId }, select: { receiptPrefix: true } });
      if (branch?.receiptPrefix) receiptPrefix = branch.receiptPrefix + 'S'; // e.g., XS, YS, ZS
    }
    const receiptNumber = `${receiptPrefix}-${counter}`;

    const payment = await db.teacherPayment.create({
      data: {
        receiptNumber,
        teacherId: body.teacherId,
        amount: parseFloat(body.amount),
        month: body.month,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        paymentType: body.paymentType || 'salary',
        paymentLabel: body.paymentLabel || 'راتب',
        notes: body.notes || null,
      },
      include: { teacher: { include: { department: true } } },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'القسم المالي متاح للمدير فقط' }, { status: 403 });
    }
    if (error.message === 'FINANCE_AUTH_REQUIRED') {
      return NextResponse.json({ error: 'يلزم إدخال كلمة سر القسم المالي' }, { status: 403 });
    }
    console.error('POST /api/finance/teacher-payments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
