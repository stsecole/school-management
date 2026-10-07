import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { SECTIONS, DEFAULT_ROLES, initializeDefaultRoles } from '@/lib/permissions';

/**
 * GET /api/roles
 * قائمة كل الأدوار + صلاحياتها
 */
export async function GET() {
  try {
    await requireDirector();

    // تهيئة الأدوار الافتراضية إن لم توجد
    await initializeDefaultRoles();

    const roles = await db.role.findMany({
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      roles: roles.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        usersCount: r._count.users,
        permissions: r.permissions.map(p => ({
          section: p.section,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        })),
      })),
      sections: SECTIONS,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }
    console.error('GET /api/roles error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * POST /api/roles
 * إنشاء دور جديد
 * body: { name, description, permissions: [{ section, canView, canCreate, canEdit, canDelete }] }
 */
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: 'اسم الدور مطلوب' }, { status: 400 });
    }

    // تحقّق من عدم التكرار
    const existing = await db.role.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'اسم الدور موجود مسبقاً' }, { status: 400 });
    }

    const role = await db.role.create({
      data: {
        name,
        description: description || null,
        isSystem: false,
        permissions: {
          create: (permissions || []).map((p: any) => ({
            section: p.section,
            canView: p.canView || false,
            canCreate: p.canCreate || false,
            canEdit: p.canEdit || false,
            canDelete: p.canDelete || false,
          })),
        },
      },
      include: { permissions: true },
    });

    return NextResponse.json({ role });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }
    console.error('POST /api/roles error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * PUT /api/roles
 * تعديل دور موجود
 * body: { id, name?, description?, permissions? }
 */
export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const { id, name, description, permissions } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'الدور غير موجود' }, { status: 404 });
    }

    // تحديث الدور
    await db.role.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    // تحديث الصلاحيات إن أُرسلت
    if (permissions && Array.isArray(permissions)) {
      // احذف القديمة
      await db.rolePermission.deleteMany({ where: { roleId: id } });
      // أضف الجديدة
      for (const p of permissions) {
        await db.rolePermission.create({
          data: {
            roleId: id,
            section: p.section,
            canView: p.canView || false,
            canCreate: p.canCreate || false,
            canEdit: p.canEdit || false,
            canDelete: p.canDelete || false,
          },
        });
      }
    }

    const role = await db.role.findUnique({
      where: { id },
      include: { permissions: true },
    });

    return NextResponse.json({ role });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }
    console.error('PUT /api/roles error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * DELETE /api/roles?id=xxx
 * حذف دور (لا يمكن حذف الأدوار الافتراضية)
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    const role = await db.role.findUnique({ where: { id } });
    if (!role) {
      return NextResponse.json({ error: 'الدور غير موجود' }, { status: 404 });
    }
    if (role.isSystem) {
      return NextResponse.json({ error: 'لا يمكن حذف الأدوار الافتراضية' }, { status: 400 });
    }

    // تحقّق من عدم وجود مستخدمين مرتبطين
    const usersCount = await db.user.count({ where: { roleId: id } });
    if (usersCount > 0) {
      return NextResponse.json({ error: `لا يمكن حذف الدور — ${usersCount} مستخدم مرتبط به` }, { status: 400 });
    }

    await db.role.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }
    console.error('DELETE /api/roles error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
