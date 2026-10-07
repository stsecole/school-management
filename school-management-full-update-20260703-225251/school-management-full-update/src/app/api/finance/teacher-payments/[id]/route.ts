import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;
    await db.teacherPayment.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الدفعة' });
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
    console.error('DELETE teacher-payment error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
