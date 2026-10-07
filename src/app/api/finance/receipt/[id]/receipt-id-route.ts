import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/finance/receipt/[id]?type=student - any authenticated user (for printing student receipts)
// GET /api/finance/receipt/[id]?type=teacher - director only (teacher receipts are confidential)
// Returns JSON consumed by the /receipt/[id] page route (NOT opened directly in the browser).
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

    const schoolSetting = await db.setting.findUnique({ where: { key: 'school_name' } });
    const schoolName = schoolSetting?.value || 'مدرسة السلامة';

    if (type === 'student') {
      const payment = await db.studentPayment.findUnique({
        where: { id },
        include: { student: { include: { department: true, level: true } } },
      });
      if (!payment) {
        return NextResponse.json({ error: 'الوصل غير موجود' }, { status: 404 });
      }
      // Field names MUST match the Receipt interface in /receipt/[id]/page.tsx
      return NextResponse.json({
        receipt: {
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          name: payment.student.name,
          studentNumber: payment.student.studentNumber || undefined,
          department: payment.student.department?.name || undefined,
          level: payment.student.level?.name || undefined,
          amount: payment.amount,
          label: payment.paymentLabel,
          paymentMethod: payment.paymentMethod || undefined,
          notes: payment.notes || undefined,
          schoolName,
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
      // Field names MUST match the Receipt interface in /receipt/[id]/page.tsx
      return NextResponse.json({
        receipt: {
          receiptNumber: payment.receiptNumber,
          date: payment.paymentDate,
          name: payment.teacher.name,
          department: payment.teacher.department?.name || undefined,
          amount: payment.amount,
          month: payment.month,
          label: payment.paymentLabel,
          notes: payment.notes || undefined,
          schoolName,
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
