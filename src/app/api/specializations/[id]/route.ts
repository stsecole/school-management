import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// PUT /api/specializations/[id] - update (director only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'اسم التخصص مطلوب' }, { status: 400 });
    }

    const specialization = await db.specialization.update({
      where: { id },
      data: { name: body.name },
      include: { department: true },
    });

    return NextResponse.json({ specialization });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/specializations/[id] - delete (director only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;

    // Check if any students use this specialization
    const studentsCount = await db.student.count({ where: { specializationId: id } });
    if (studentsCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف التخصص لأن هناك ${studentsCount} طالب مسجل فيه` },
        { status: 400 }
      );
    }

    await db.specialization.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف التخصص' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
