import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// DELETE /api/timesheet/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const entry = await db.employeeTimesheet.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    }

    // Employees can only delete their own entries
    if (user.role !== 'director' && entry.userId !== user.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    await db.employeeTimesheet.delete({ where: { id } });
    return NextResponse.json({ message: 'تم الحذف' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
