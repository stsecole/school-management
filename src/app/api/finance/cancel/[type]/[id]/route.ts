// ===== POST /api/finance/cancel/[type]/[id] =====
// شطب/إرجاع شطب وصل (طالب/أستاذ/موظف)
// type: "student" | "teacher" | "staff"
// Body: { reason?: string, action: "cancel" | "uncancel" }
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const modelMap = {
  student: 'studentPayment',
  teacher: 'teacherPayment',
  staff: 'staffPayment',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    await requireDirector();
    const { type, id } = await params;
    const body = await request.json();
    const action = body.action || 'cancel';

    const modelName = modelMap[type as keyof typeof modelMap];
    if (!modelName) {
      return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 });
    }

    const model = (db as any)[modelName];
    if (!model) {
      return NextResponse.json({ error: 'النموذج غير موجود' }, { status: 400 });
    }

    if (action === 'cancel') {
      await model.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelReason: body.reason || null,
        },
      });
      return NextResponse.json({ ok: true, message: 'تم شطب الوصل' });
    } else {
      await model.update({
        where: { id },
        data: {
          isCancelled: false,
          cancelledAt: null,
          cancelReason: null,
        },
      });
      return NextResponse.json({ ok: true, message: 'تم إرجاع الشطب' });
    }
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    console.error('POST /api/finance/cancel error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
