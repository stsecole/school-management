import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// GET /api/departments/[id] - any authenticated user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const department = await db.department.findUnique({
      where: { id },
      include: {
        students: { include: { level: true, specialization: true } },
        teachers: true,
        courses: { include: { level: true, teacher: true } },
        specializations: true,
      },
    });
    if (!department) {
      return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ department });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT /api/departments/[id] - director only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    }

    // Fixed departments cannot have their name/hasInstallments changed
    const updateData: any = {
      code: body.code || null,
      description: body.description || null,
    };
    if (!existing.isFixed) {
      updateData.name = body.name;
      updateData.hasInstallments = body.hasInstallments || false;
      updateData.installmentMonths = body.installmentMonths ? parseInt(body.installmentMonths) : null;
      updateData.defaultMonthlyAmount = body.defaultMonthlyAmount ? parseFloat(body.defaultMonthlyAmount) : null;
    } else {
      // For fixed departments, only allow updating the default monthly amount
      if (body.defaultMonthlyAmount !== undefined) {
        updateData.defaultMonthlyAmount = parseFloat(body.defaultMonthlyAmount);
      }
    }

    // Allow director to toggle isFixed (to "unfix" a department so it can be deleted)
    if (body.isFixed !== undefined && typeof body.isFixed === 'boolean') {
      updateData.isFixed = body.isFixed;
    }

    const department = await db.department.update({
      where: { id },
      data: updateData,
      include: { specializations: true },
    });
    return NextResponse.json({ department });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/departments/[id] - director only, cannot delete fixed departments
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;

    const department = await db.department.findUnique({ where: { id } });
    if (!department) {
      return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    }

    if (department.isFixed) {
      return NextResponse.json(
        { error: 'لا يمكن حذف الأقسام الرئيسية الثابتة' },
        { status: 400 }
      );
    }

    // Check if there are students/teachers/courses linked
    const studentsCount = await db.student.count({ where: { departmentId: id } });
    if (studentsCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف القسم لأن هناك ${studentsCount} طالب مسجل فيه` },
        { status: 400 }
      );
    }

    await db.department.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف القسم' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
