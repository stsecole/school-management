import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/goals/[id]/reviews
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const reviews = await db.goalReview.findMany({
      where: { goalId: id },
      include: {
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reviews });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/[id]/reviews error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals/[id]/reviews
 * إضافة مراجعة (تقييم ذاتي / مدير / نهائي)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const goal = await db.goal.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!goal) {
      return NextResponse.json({ error: 'الهدف غير موجود' }, { status: 404 });
    }

    const review = await db.goalReview.create({
      data: {
        goalId: id,
        reviewerId: user.id,
        reviewType: body.reviewType || 'self',
        period: body.period || null,
        rating: parseFloat(body.rating) || 0,
        achievements: body.achievements || null,
        challenges: body.challenges || null,
        nextSteps: body.nextSteps || null,
      },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'goals',
          description: `مراجعة للهدف "${goal.title}" (${review.reviewType})`,
          targetType: 'goal-review',
          targetId: review.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals/[id]/reviews error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
