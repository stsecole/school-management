import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/auth/forgot-password
 *
 * خطوتين:
 * 1. { step: 1, username } → يُرجع السؤال السري
 * 2. { step: 2, username, answer, newPassword } → يُعيد تعيين كلمة المرور
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step, username, answer, newPassword } = body;

    if (!username) {
      return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { username: username.toLowerCase().trim() } });

    if (!user) {
      return NextResponse.json({ error: 'اسم المستخدم غير موجود' }, { status: 404 });
    }

    // الخطوة 1: اعرض السؤال السري
    if (step === 1) {
      if (!user.securityQuestion) {
        return NextResponse.json({
          error: 'لم يتم إعداد سؤال سري لهذا المستخدم. تواصل مع المدير لإعادة تعيين كلمة المرور.',
        }, { status: 400 });
      }

      return NextResponse.json({
        step: 1,
        question: user.securityQuestion,
      });
    }

    // الخطوة 2: تحقّق من الإجابة وغيّر كلمة المرور
    if (step === 2) {
      if (!answer || !newPassword) {
        return NextResponse.json({ error: 'الإجابة وكلمة المرور الجديدة مطلوبة' }, { status: 400 });
      }

      if (!user.securityAnswer) {
        return NextResponse.json({ error: 'لم يتم إعداد سؤال سري' }, { status: 400 });
      }

      // قارن الإجابة (غير حساس لحالة الأحرف)
      if (answer.trim().toLowerCase() !== user.securityAnswer.trim().toLowerCase()) {
        return NextResponse.json({ error: 'الإجابة غير صحيحة' }, { status: 400 });
      }

      if (newPassword.length < 4) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }, { status: 400 });
      }

      // حدّث كلمة المرور
      await db.user.update({
        where: { id: user.id },
        data: { password: newPassword.trim() },
      });

      return NextResponse.json({
        ok: true,
        message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.',
      });
    }

    return NextResponse.json({ error: 'خطوة غير صحيحة' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/auth/forgot-password error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
