import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// GET /api/departments - any authenticated user can list departments
export async function GET() {
  try {
    await requireAuth();
    const departments = await db.department.findMany({
      include: {
        _count: { select: { students: true, teachers: true, courses: true, specializations: true } },
        specializations: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ departments });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/departments - director only can create new departments
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'اسم القسم مطلوب' }, { status: 400 });
    }

    const department = await db.department.create({
      data: {
        name: body.name,
        code: body.code || null,
        description: body.description || null,
        isFixed: false, // user-created departments are not fixed
        hasInstallments: body.hasInstallments || false,
        installmentMonths: body.installmentMonths ? parseInt(body.installmentMonths) : null,
        defaultMonthlyAmount: body.defaultMonthlyAmount ? parseFloat(body.defaultMonthlyAmount) : null,
      },
      include: { specializations: true },
    });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('POST /api/departments error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
