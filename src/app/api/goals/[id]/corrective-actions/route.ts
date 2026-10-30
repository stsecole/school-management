import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/goals/[id]/corrective-actions
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const actions = await db.correctiveAction.findMany({
      where: { goalId: id },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ actions });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/[id]/corrective-actions error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals/[id]/corrective-actions
 * إضافة إجراء تصحيحي
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (!body.description) {
      return NextResponse.json({ error: 'وصف الإجراء مطلوب' }, { status: 400 });
    }

    const goal = await db.goal.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!goal) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 });
    }

    const action = await db.correctiveAction.create({
      data: {
        goalId: id,
        description: body.description,
        rootCause: body.rootCause || null,
        action: body.action || null,
        assignedTo: body.assignedTo || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status || 'open',
        result: body.result || null,
      },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'goals',
          description: `إجراء تصحيحي للهدف "${goal.title}"`,
          targetType: 'corrective-action',
          targetId: action.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ action }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals/[id]/corrective-actions error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals/[id]/corrective-actions?actionId=xxx
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    if (!actionId) {
      return NextResponse.json({ error: 'معرّف الإجراء مطلوب' }, { status: 400 });
    }

    const body = await request.json();
    const existing = await db.correctiveAction.findUnique({ where: { id: actionId } });
    if (!existing || existing.goalId !== id) {
      return NextResponse.json({ error: 'الإجراء غير موجود' }, { status: 404 });
    }

    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.rootCause !== undefined) data.rootCause = body.rootCause;
    if (body.action !== undefined) data.action = body.action;
    if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo || null;
    if (body.startDate !== undefined)
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.result !== undefined) data.result = body.result;

    const action = await db.correctiveAction.update({ where: { id: actionId }, data });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'update',
          module: 'goals',
          description: `تعديل إجراء تصحيحي`,
          targetType: 'corrective-action',
          targetId: actionId,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ action });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/goals/[id]/corrective-actions error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals/[id]/corrective-actions?actionId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    if (!actionId) {
      return NextResponse.json({ error: 'معرّف الإجراء مطلوب' }, { status: 400 });
    }

    const existing = await db.correctiveAction.findUnique({ where: { id: actionId } });
    if (!existing || existing.goalId !== id) {
      return NextResponse.json({ error: 'الإجراء غير موجود' }, { status: 404 });
    }

    await db.correctiveAction.delete({ where: { id: actionId } });

    return NextResponse.json({ message: 'تم حذف الإجراء' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/goals/[id]/corrective-actions error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
