import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// GET /api/specializations - list all specializations (any auth user)
// Optional: ?departmentId=xxx to filter by department
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const where: any = {};
    if (departmentId) where.departmentId = departmentId;

    const specializations = await db.specialization.findMany({
      where,
      include: { department: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ specializations });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/specializations error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/specializations - create specialization (director only)
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    if (!body.name || !body.departmentId) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم التخصص واختيار القسم' },
        { status: 400 }
      );
    }

    // Verify department exists
    const dept = await db.department.findUnique({ where: { id: body.departmentId } });
    if (!dept) {
      return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    }

    // Check for duplicate within same department
    const existing = await db.specialization.findFirst({
      where: { name: body.name, departmentId: body.departmentId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'هذا التخصص موجود بالفعل في هذا القسم' },
        { status: 400 }
      );
    }

    const specialization = await db.specialization.create({
      data: {
        name: body.name,
        departmentId: body.departmentId,
      },
      include: { department: true },
    });

    return NextResponse.json({ specialization }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('POST /api/specializations error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
