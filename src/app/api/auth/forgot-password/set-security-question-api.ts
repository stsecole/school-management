import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/auth/set-security-question
 * { securityQuestion, securityAnswer }
 * يضبط السؤال السري للمستخدم الحالي
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { securityQuestion, securityAnswer } = body;

    if (!securityQuestion || !securityAnswer) {
      return NextResponse.json({ error: 'السؤال والإجابة مطلوبان' }, { status: 400 });
    }

    if (securityAnswer.trim().length < 2) {
      return NextResponse.json({ error: 'الإجابة قصيرة جداً' }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        securityQuestion: securityQuestion.trim(),
        securityAnswer: securityAnswer.trim(),
      },
    });

    return NextResponse.json({ ok: true, message: 'تم حفظ السؤال السري' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/auth/set-security-question error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * GET /api/auth/set-security-question
 * يُرجع السؤال السري الحالي للمستخدم (إن وُجد)
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { securityQuestion: true },
    });

    return NextResponse.json({
      securityQuestion: dbUser?.securityQuestion || null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
