import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// GET /api/school-branches/[id] - any authenticated user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const branch = await db.schoolBranch.findUnique({ where: { id } });
    if (!branch) {
      return NextResponse.json({ error: 'الشعبة غير موجودة' }, { status: 404 });
    }
    return NextResponse.json({ schoolBranch: branch });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/school-branches/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE /api/school-branches/[id] - director only, check if students use it
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireDirector();
    const { id } = await params;

    const branch = await db.schoolBranch.findUnique({ where: { id } });
    if (!branch) {
      return NextResponse.json({ error: 'الشعبة غير موجودة' }, { status: 404 });
    }

    // Check if any student uses this branch (via the section field which stores branch name)
    const studentsCount = await db.student.count({
      where: { section: branch.name },
    });
    if (studentsCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف الشعبة لأن هناك ${studentsCount} طالب مسجل فيها` },
        { status: 400 }
      );
    }

    await db.schoolBranch.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الشعبة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('DELETE /api/school-branches/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}
