import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { step, username, answer, newPassword } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { username: username.toLowerCase().trim() } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (step === 1) {
      if (!user.securityQuestion) {
        return NextResponse.json({ error: 'No security question set. Contact admin.' }, { status: 400 });
      }
      return NextResponse.json({ step: 1, question: user.securityQuestion });
    }

    if (step === 2) {
      if (!answer || !newPassword) {
        return NextResponse.json({ error: 'Answer and new password required' }, { status: 400 });
      }

      if (!user.securityAnswer) {
        return NextResponse.json({ error: 'No security answer set' }, { status: 400 });
      }

      if (answer.trim().toLowerCase() !== user.securityAnswer.trim().toLowerCase()) {
        return NextResponse.json({ error: 'Wrong answer' }, { status: 400 });
      }

      if (newPassword.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }

      await db.user.update({
        where: { id: user.id },
        data: { password: newPassword.trim() },
      });

      return NextResponse.json({ ok: true, message: 'Password changed successfully' });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}