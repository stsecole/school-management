import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/goals/[id]
 * تفاصيل هدف واحد مع كل العلاقات
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const goal = await db.goal.findUnique({
      where: { id },
      include: {
        plan: true,
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true, username: true } },
        approvedBy: { select: { id: true, name: true } },
        parentGoal: { select: { id: true, title: true } },
        subGoals: {
          include: {
            milestones: true,
            assignedToUser: { select: { id: true, name: true } },
          },
        },
        milestones: { orderBy: { createdAt: 'asc' } },
        updates: {
          include: {
            user: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        correctiveActions: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ goal });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (user.role !== 'director') {
      const existing = await db.goal.findUnique({ where: { id }, select: { assignedTo: true } });
      if (!existing || existing.assignedTo !== user.id) {
        return NextResponse.json({ error: 'غير مصرح بتعديل هذا الهدف' }, { status: 403 });
      }
    }

    const data: any = {};
    const fields = [
      'title', 'description', 'level', 'planId', 'parentGoalId', 'branchId',
      'departmentId', 'assignedTo', 'category', 'priority', 'unit',
      'direction', 'progressMethod', 'dataSource', 'autoMetric', 'notes', 'status',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) {
        if (body[f] === '' && ['planId', 'parentGoalId', 'branchId', 'departmentId', 'assignedTo'].includes(f)) {
          data[f] = null;
        } else {
          data[f] = body[f];
        }
      }
    }
    if (body.weight !== undefined) data.weight = parseFloat(body.weight) || 0;
    if (body.baseline !== undefined) data.baseline = parseFloat(body.baseline) || 0;
    if (body.target !== undefined) data.target = parseFloat(body.target) || 0;
    if (body.actual !== undefined) data.actual = parseFloat(body.actual) || 0;
    if (body.startDate !== undefined)
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (body.status === 'active' && user.role === 'director') {
      data.approvedById = user.id;
      data.approvedAt = new Date();
    }

    const goal = await db.goal.update({ where: { id }, data });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'update',
          module: 'goals',
          description: `تعديل هدف: ${goal.title}`,
          targetType: 'goal',
          targetId: goal.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ goal });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/goals/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    if (user.role !== 'director') {
      const existing = await db.goal.findUnique({ where: { id }, select: { assignedTo: true } });
      if (!existing || existing.assignedTo !== user.id) {
        return NextResponse.json({ error: 'غير مصرح بحذف هذا الهدف' }, { status: 403 });
      }
    }

    const data = await db.goal.findUnique({ where: { id }, select: { title: true } });
    await db.goal.delete({ where: { id } });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'delete',
          module: 'goals',
          description: `حذف هدف: ${data?.title || id}`,
          targetType: 'goal',
          targetId: id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ message: 'تم حذف الهدف' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/goals/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
