import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encodeSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Trim whitespace and convert to lowercase for username
    const username = (body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    console.log('[Login] Attempt:', JSON.stringify({ username, passwordLength: password.length }));

    if (!username || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      );
    }

    // Try exact match first, then case-insensitive
    let user = await db.user.findUnique({ where: { username } });
    
    // If not found, try case-insensitive search
    if (!user) {
      user = await db.user.findFirst({
        where: { username: { contains: username } },
      });
    }

    if (!user) {
      console.log('[Login] User not found:', username);
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Compare passwords (trim both sides)
    const storedPassword = (user.password || '').trim();
    if (password !== storedPassword) {
      console.log('[Login] Password mismatch for:', username, '| received length:', password.length, '| stored length:', storedPassword.length);
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    console.log('[Login] Success:', username);

    const session = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      canManageTimetable: user.canManageTimetable,
    };

    const response = NextResponse.json({
      user: session,
      message: 'تم تسجيل الدخول بنجاح',
    });

    response.cookies.set('session', encodeSession(session), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    );
  }
}
