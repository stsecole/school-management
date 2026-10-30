import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

/**
 * GET /api/goals/plans
 * قائمة خطط الأهداف (مُصفّاة حسب الفرع النشط)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const periodType = searchParams.get('periodType');

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };
    if (status && status !== 'all') where.status = status;
    if (periodType && periodType !== 'all') where.periodType = periodType;

    const plans = await db.goalPlan.findMany({
      where,
      include: {
        _count: { select: { goals: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    });

    return NextResponse.json({ plans });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/plans error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals/plans
 * إنشاء خطة أهداف جديدة (المدير فقط)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    const body = await request.json();

    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'الاسم وتاريخ البداية والنهاية مطلوبة' },
        { status: 400 }
      );
    }

    const plan = await db.goalPlan.create({
      data: {
        name: body.name,
        description: body.description || null,
        periodType: body.periodType || 'annual',
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: body.status || 'draft',
        branchId: body.branchId || (await getBranchIdForNewRecord()),
      },
      include: { _count: { select: { goals: true } } },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'goals',
          description: `إنشاء خطة أهداف: ${plan.name}`,
          targetType: 'goal-plan',
          targetId: plan.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals/plans error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals/plans?id=xxx
 * تحديث خطة أهداف (المدير فقط)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرّف الخطة مطلوب' }, { status: 400 });
    }

    const body = await request.json();
    const plan = await db.goalPlan.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        periodType: body.periodType,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        status: body.status,
        branchId: body.branchId === undefined ? undefined : (body.branchId || null),
      },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'update',
          module: 'goals',
          description: `تعديل خطة أهداف: ${plan.name}`,
          targetType: 'goal-plan',
          targetId: plan.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ plan });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/goals/plans error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals/plans?id=xxx
 * حذف خطة أهداف (المدير فقط)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرّف الخطة مطلوب' }, { status: 400 });
    }

    const data = await db.goalPlan.findUnique({ where: { id }, select: { name: true } });
    await db.goalPlan.delete({ where: { id } });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'delete',
          module: 'goals',
          description: `حذف خطة أهداف: ${data?.name || id}`,
          targetType: 'goal-plan',
          targetId: id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ message: 'تم حذف الخطة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/goals/plans error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
