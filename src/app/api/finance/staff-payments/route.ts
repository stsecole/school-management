import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/finance/staff-payments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const month = searchParams.get('month');

    const where: any = {};
    if (search) {
      where.OR = [
        { staffName: { contains: search } },
        { staffRole: { contains: search } },
        { receiptNumber: { contains: search } },
        { note: { contains: search } },
      ];
    }
    if (month && month !== 'all') where.month = month;

    let payments: any[] = [];
    let total = 0;
    try {
      payments = await (db as any).staffPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
      });
      // استثني الوصولات المشطوبة من المجموع
      total = payments
        .filter((p: any) => !p.isCancelled)
        .reduce((s: number, p: any) => s + p.amount, 0);
    } catch (err: any) {
      console.log('StaffPayment model not found, returning empty list');
      return NextResponse.json({ payments: [], total: 0 });
    }

    // تنسيق البيانات للواجهة
    const formattedPayments = payments.map((p: any) => ({
      id: p.id,
      receiptNumber: p.receiptNumber || '',
      userId: '',
      userName: p.staffName,
      staffName: p.staffName,
      staffRole: p.staffRole,
      amount: p.amount,
      month: p.month || '',
      paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
      paymentType: 'salary',
      paymentLabel: null,
      notes: p.note,
      note: p.note,
      isCancelled: p.isCancelled || false,
      cancelledAt: p.cancelledAt,
      cancelReason: p.cancelReason,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));

    return NextResponse.json({ payments: formattedPayments, total });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/finance/staff-payments error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/finance/staff-payments
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    let staffName = body.staffName || body.name || body.employeeName || body.staff_name || body.fullName || '';
    const userId = body.userId || body.user_id || body.employeeId || body.employee_id;
    const amountRaw = body.amount ?? body.paymentAmount ?? body.salary ?? body.value ?? body.price;
    let staffRole = body.staffRole || body.role || body.position || body.staff_role || null;

    // إذا لم يكن هناك staffName مباشرة، لكن هناك userId، اجلب الاسم من جدول User
    if (!staffName && userId) {
      try {
        const userRecord = await db.user.findUnique({ where: { id: userId } });
        if (userRecord) {
          staffName = userRecord.name;  // ← إصلاح: تعيين القيمة مباشرة
          if (!staffRole) {
            staffRole = userRecord.role === 'director' ? 'مدير' : 'موظف';
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    }

    if (!staffName || !amountRaw || amountRaw === '' || amountRaw === 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم الموظف والمبلغ' },
        { status: 400 }
      );
    }

    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(/[^\d.-]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
    }

    // Generate receipt number
    let receiptNumber = body.receiptNumber;
    if (!receiptNumber) {
      try {
        const setting = await db.setting.findUnique({ where: { key: 'staff_receipt_counter' } });
        let counter = setting ? parseInt(setting.value) : 5000;
        counter++;
        await db.setting.upsert({
          where: { key: 'staff_receipt_counter' },
          update: { value: String(counter) },
          create: { key: 'staff_receipt_counter', value: String(counter) },
        });
        receiptNumber = `STF-${counter}`;
      } catch {
        receiptNumber = `STF-${Date.now()}`;
      }
    }

    const paymentType = body.paymentType || body.payment_type || null;
    const paymentLabel = body.paymentLabel || body.payment_label || null;
    let noteParts: string[] = [];
    if (paymentLabel) noteParts.push(paymentLabel);
    if (paymentType && paymentType !== 'salary') noteParts.push(`(${paymentType})`);
    if (body.note || body.notes || body.description) noteParts.push(body.note || body.notes || body.description);
    const finalNote = noteParts.join(' - ') || null;

    let payment: any;
    try {
      payment = await (db as any).staffPayment.create({
        data: {
          staffName,
          staffRole: staffRole || null,
          amount,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          month: body.month || body.paymentMonth || null,
          note: finalNote,
          receiptNumber,
          isCancelled: false,
        },
      });
    } catch (err: any) {
      console.error('StaffPayment model error:', err);
      return NextResponse.json(
        { error: 'نموذج رواتب الموظفين غير موجود. يرجى تشغيل: npx prisma db push' },
        { status: 500 }
      );
    }

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'finance',
          description: `صرف راتب لموظف: ${staffName} - ${amount} دج`,
          targetType: 'staff_payment',
          targetId: payment.id,
        },
      });
    } catch (e) {}

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/finance/staff-payments error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
