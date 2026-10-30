import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/goals/[id]/updates
 * قائمة تحديثات التقدم لهدف
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const updates = await db.goalUpdate.findMany({
      where: { goalId: id },
      include: {
        user: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ updates });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/[id]/updates error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals/[id]/updates
 * تقديم تحديث تقدّم جديد
 *
 * - يُحدّث قيمة الهدف الفعلية (actual) بقيمة التحديث الجديدة
 * - يحفظ القيمة السابقة في previousValue
 * - إذا كان المستخدم مديرًا، يمكن اعتماد التحديث تلقائيًا
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // التحقق من الهدف
    const goal = await db.goal.findUnique({
      where: { id },
      select: { id: true, title: true, actual: true, assignedTo: true },
    });
    if (!goal) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 });
    }

    // الموظف يُقدّم تحديثات لأهدافه فقط
    if (user.role !== 'director' && goal.assignedTo !== user.id) {
      return NextResponse.json(
        { error: 'غير مصرح بإضافة تحديث لهذا الهدف' },
        { status: 403 }
      );
    }

    const actualValue = parseFloat(body.actualValue);
    if (Number.isNaN(actualValue)) {
      return NextResponse.json({ error: 'القيمة الفعلية يجب أن تكون رقمًا' }, { status: 400 });
    }

    const previousValue = goal.actual || 0;
    const isDirector = user.role === 'director';
    const status = body.status || (isDirector ? 'approved' : 'submitted');

    const update = await db.goalUpdate.create({
      data: {
        goalId: id,
        userId: user.id,
        actualValue,
        previousValue,
        notes: body.notes || null,
        evidenceUrl: body.evidenceUrl || null,
        status,
        reviewedAt: status === 'approved' || status === 'rejected' ? new Date() : null,
        reviewedById: status === 'approved' || status === 'rejected' ? user.id : null,
        reviewNotes: body.reviewNotes || null,
      },
    });

    // تحديث القيمة الفعلية للهدف
    // - الموظف: يبقى الهدف actual كما هو حتى يعتمد المدير التحديث
    // - المدير (auto-approve): نحدّث الهدف مباشرة
    if (isDirector && status === 'approved') {
      await db.goal.update({
        where: { id },
        data: { actual: actualValue },
      });
    }

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'goals',
          description: `تحديث تقدّم للهدف "${goal.title}": ${actualValue}`,
          targetType: 'goal-update',
          targetId: update.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ update }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals/[id]/updates error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals/[id]/updates?updateId=xxx
 * مراجعة تحديث (اعتماد/رفض) — المدير فقط
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const updateId = searchParams.get('updateId');
    if (!updateId) {
      return NextResponse.json({ error: 'معرّف التحديث مطلوب' }, { status: 400 });
    }

    const body = await request.json();
    const status = body.status; // "approved" | "rejected"

    const existing = await db.goalUpdate.findUnique({ where: { id: updateId } });
    if (!existing || existing.goalId !== id) {
      return NextResponse.json({ error: 'التحديث غير موجود' }, { status: 404 });
    }

    const update = await db.goalUpdate.update({
      where: { id: updateId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: user.id,
        reviewNotes: body.reviewNotes || null,
      },
    });

    // إذا اعتُمد، نُحدّث القيمة الفعلية للهدف
    if (status === 'approved') {
      await db.goal.update({
        where: { id },
        data: { actual: existing.actualValue },
      });
    }

    try {
      const goal = await db.goal.findUnique({ where: { id }, select: { title: true } });
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'update',
          module: 'goals',
          description: `${status === 'approved' ? 'اعتماد' : 'رفض'} تحديث للهدف "${goal?.title || id}"`,
          targetType: 'goal-update',
          targetId: updateId,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ update });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/goals/[id]/updates error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
