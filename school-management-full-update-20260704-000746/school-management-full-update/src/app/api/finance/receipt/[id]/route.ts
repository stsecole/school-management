import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/finance/receipt/[id]?type=student - any authenticated user (for printing student receipts)
// GET /api/finance/receipt/[id]?type=teacher - director only (teacher receipts are confidential)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const type = new URL(_request.url).searchParams.get('type') || 'student';

    // Teacher receipts are director-only
    if (type === 'teacher' && user.role !== 'director') {
      return NextResponse.json(
        { error: 'وصولات الأساتذة متاحة للمدير فقط' },
        { status: 403 }
      );
    }

    if (type === 'student') {
      const payment = await db.studentPayment.findUnique({
        where: { id },
        include: { student: { include: { department: true, level: true } } },
      });
      if (!payment) {
        return NextResponse.json({ error: 'الوصل غير موجود' }, { status: 404 });
      }
      const schoolSetting = await db.setting.findUnique({ where: { key: 'school_name' } });
      return NextResponse.json({
        receipt: {
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          studentName: payment.student.name,
          studentNumber: payment.student.studentNumber,
          department: payment.student.department?.name,
          level: payment.student.level?.name,
          amount: payment.amount,
          paymentLabel: payment.paymentLabel,
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
          schoolName: schoolSetting?.value || 'مدرسة السلامة',
          type: 'student',
        },
      });
    } else {
      const payment = await db.teacherPayment.findUnique({
        where: { id },
        include: { teacher: { include: { department: true } } },
      });
      if (!payment) {
        return NextResponse.json({ error: 'الوصل غير موجود' }, { status: 404 });
      }
      const schoolSetting = await db.setting.findUnique({ where: { key: 'school_name' } });
      return NextResponse.json({
        receipt: {
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          teacherName: payment.teacher.name,
          department: payment.teacher.department?.name,
          amount: payment.amount,
          month: payment.month,
          paymentLabel: payment.paymentLabel,
          notes: payment.notes,
          schoolName: schoolSetting?.value || 'مدرسة السلامة',
          type: 'teacher',
        },
      });
    }
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET receipt error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
