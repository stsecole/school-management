import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// PUT /api/users/[id] - update user info (director only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;
    const body = await request.json();

    // Validate
    if (!body.username || !body.name) {
      return NextResponse.json(
        { error: 'الاسم واسم المستخدم مطلوبان' },
        { status: 400 }
      );
    }

    const role = body.role || 'employee';
    if (!['director', 'employee'].includes(role)) {
      return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 });
    }

    // Check if username is taken by another user
    const existing = await db.user.findUnique({ where: { username: body.username } });
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: 'اسم المستخدم موجود بالفعل لمستخدم آخر' },
        { status: 400 }
      );
    }

    const user = await db.user.update({
      where: { id },
      data: {
        username: body.username,
        name: body.name,
        role,
        canManageTimetable: body.canManageTimetable === true,
      },
      select: { id: true, username: true, name: true, role: true, canManageTimetable: true, createdAt: true },
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - delete user (director only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;

    // Prevent director from deleting themselves
    // (we need the user context to verify)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    if (sessionCookie) {
      const sessionUser = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
      if (sessionUser.id === id) {
        return NextResponse.json(
          { error: 'لا يمكنك حذف حسابك الحالي' },
          { status: 400 }
        );
      }
    }

    // Count directors to ensure at least one remains
    const directorsCount = await db.user.count({ where: { role: 'director' } });
    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }
    if (targetUser.role === 'director' && directorsCount <= 1) {
      return NextResponse.json(
        { error: 'لا يمكن حذف آخر مدير في النظام' },
        { status: 400 }
      );
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الحساب بنجاح' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('DELETE /api/users/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}

import { cookies } from 'next/headers';
