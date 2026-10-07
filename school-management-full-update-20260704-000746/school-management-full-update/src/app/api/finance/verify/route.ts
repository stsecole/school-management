import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyFinancePassword, requireAuth } from '@/lib/auth';

// POST /api/finance/verify - verify the finance section password
// Requires: logged-in director + finance password
export async function POST(request: NextRequest) {
  try {
    // Step 1: User must be authenticated
    const user = await requireAuth();

    // Step 2: User must be a director
    if (user.role !== 'director') {
      return NextResponse.json(
        { error: 'القسم المالي متاح للمدير فقط' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'يرجى إدخال كلمة المرور' },
        { status: 400 }
      );
    }

    const valid = await verifyFinancePassword(password);
    if (!valid) {
      return NextResponse.json(
        { error: 'كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Issue a short-lived finance session token tied to the director's user id
    const response = NextResponse.json({ message: 'تم التحقق بنجاح' });
    response.cookies.set('finance_auth', user.id, {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });
    return response;
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }
    console.error('Finance verify error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
