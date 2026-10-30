import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  calculateProgress,
  calculateWeightedScore,
} from '@/lib/goals/progress-engine';

/**
 * GET /api/goals/my-goals
 * أهداف المستخدم الحالي (للموظف)
 *
 * - جلب أهداف المستخدم + آخر التحديثات + المراجعات
 * - إحصائيات شخصية: العدد، متوسط التقدّم، المكتملة، المتأخرة
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');

    const where: any = { assignedTo: user.id };
    if (status && status !== 'all') where.status = status;
    if (planId && planId !== 'all') where.planId = planId;

    const goals = await db.goal.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        milestones: true,
        subGoals: { include: { milestones: true } },
        updates: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    // ===== إحصائيات شخصية =====
    const now = new Date();
    const progressList = goals.map(g => calculateProgress(g).progress);
    const avgProgress =
      progressList.length > 0
        ? progressList.reduce((s, v) => s + v, 0) / progressList.length
        : 0;

    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    const overdueGoals = goals.filter(
      g => g.status !== 'completed' && g.status !== 'cancelled' && g.dueDate && new Date(g.dueDate) < now
    ).length;
    const pendingReview = goals.reduce(
      (sum, g) => sum + g.updates.filter(u => u.status === 'submitted').length,
      0
    );

    const weighted = calculateWeightedScore(goals);

    return NextResponse.json({
      goals,
      stats: {
        totalGoals,
        activeGoals,
        completedGoals,
        overdueGoals,
        pendingReview,
        avgProgress: Math.round(avgProgress * 10) / 10,
        weightedScore: Math.round(weighted.weightedScore * 10) / 10,
        totalWeight: weighted.totalWeight,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/my-goals error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
