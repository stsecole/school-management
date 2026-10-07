import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// GET /api/users - list all users (director only)
export async function GET() {
  try {
    await requireDirector();
    const [users, roles] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          roleId: true,
          canManageTimetable: true,
          branchId: true,
          branch: { select: { id: true, name: true, code: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.role.findMany({
        include: { _count: { select: { users: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return NextResponse.json({ users, roles });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/users - create a new user (director only)
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    if (!body.username || !body.password || !body.name) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول (الاسم، اسم المستخدم، كلمة المرور)' },
        { status: 400 }
      );
    }

    if (body.password.length < 4) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' },
        { status: 400 }
      );
    }

    const role = body.role || 'employee';
    if (!['director', 'employee'].includes(role)) {
      return NextResponse.json({ error: 'دور غير صالح' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { username: body.username } });
    if (existing) {
      return NextResponse.json(
        { error: 'اسم المستخدم موجود بالفعل' },
        { status: 400 }
      );
    }

    const user = await db.user.create({
      data: {
        username: body.username,
        password: body.password,
        name: body.name,
        role,
        roleId: body.roleId || null,
        canManageTimetable: body.canManageTimetable === true,
        branchId: body.branchId || null,
      },
      select: { id: true, username: true, name: true, role: true, roleId: true, canManageTimetable: true, branchId: true, createdAt: true },
    });

    try { await db.activityLog.create({ data: { userId: user.id, userName: user.name, action: 'create', module: 'users', description: 'إضافة مستخدم: ' + body.username } }); } catch (e) {}

        return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
