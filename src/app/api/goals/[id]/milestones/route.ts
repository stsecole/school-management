import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/goals/[id]/milestones
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const milestones = await db.goalMilestone.findMany({
      where: { goalId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ milestones });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/[id]/milestones error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals/[id]/milestones
 * إنشاء معلم جديد
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'عنوان المعلم مطلوب' }, { status: 400 });
    }

    const goal = await db.goal.findUnique({ where: { id }, select: { id: true, assignedTo: true } });
    if (!goal) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 });
    }

    if (user.role !== 'director' && goal.assignedTo !== user.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const milestone = await db.goalMilestone.create({
      data: {
        goalId: id,
        title: body.title,
        description: body.description || null,
        weight: parseFloat(body.weight) || 0,
        completed: body.completed || false,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        completedAt: body.completedAt ? new Date(body.completedAt) : (body.completed ? new Date() : null),
      },
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals/[id]/milestones error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals/[id]/milestones?milestoneId=xxx
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');
    if (!milestoneId) {
      return NextResponse.json({ error: 'معرّف المعلم مطلوب' }, { status: 400 });
    }

    const body = await request.json();
    const existing = await db.goalMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing || existing.goalId !== id) {
      return NextResponse.json({ error: 'المعلم غير موجود' }, { status: 404 });
    }

    const goal = await db.goal.findUnique({ where: { id }, select: { assignedTo: true } });
    if (user.role !== 'director' && goal?.assignedTo !== user.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.weight !== undefined) data.weight = parseFloat(body.weight) || 0;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.completed !== undefined) {
      data.completed = body.completed;
      data.completedAt = body.completed ? new Date() : null;
    }

    const milestone = await db.goalMilestone.update({ where: { id: milestoneId }, data });

    return NextResponse.json({ milestone });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/goals/[id]/milestones error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals/[id]/milestones?milestoneId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');
    if (!milestoneId) {
      return NextResponse.json({ error: 'معرّف المعلم مطلوب' }, { status: 400 });
    }

    const existing = await db.goalMilestone.findUnique({ where: { id: milestoneId } });
    if (!existing || existing.goalId !== id) {
      return NextResponse.json({ error: 'المعلم غير موجود' }, { status: 404 });
    }

    const goal = await db.goal.findUnique({ where: { id }, select: { assignedTo: true } });
    if (user.role !== 'director' && goal?.assignedTo !== user.id) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    await db.goalMilestone.delete({ where: { id: milestoneId } });

    return NextResponse.json({ message: 'تم حذف المعلم' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/goals/[id]/milestones error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
