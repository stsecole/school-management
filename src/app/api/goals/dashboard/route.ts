import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';
import {
  calculateProgress,
  calculateWeightedScore,
  validateWeightsSum,
} from '@/lib/goals/progress-engine';

/**
 * GET /api/goals/dashboard
 * لوحة قيادة المدير — إحصائيات مجمّعة عن الأهداف والأداء
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const level = searchParams.get('level');
    const periodType = searchParams.get('periodType') || 'all';

    const branchFilter = await getBranchFilter();

    // ===== فلتر الخطة =====
    const planWhere: any = { ...branchFilter };
    if (periodType !== 'all') planWhere.periodType = periodType;

    const plans = await db.goalPlan.findMany({
      where: planWhere,
      include: {
        _count: { select: { goals: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    // ===== فلتر الأهداف =====
    const goalWhere: any = { ...branchFilter };
    if (planId && planId !== 'all') goalWhere.planId = planId;
    if (level && level !== 'all') goalWhere.level = level;
    // فقط الأهداف الأب في القائمة الرئيسية
    goalWhere.parentGoalId = null;

    const goals = await db.goal.findMany({
      where: goalWhere,
      include: {
        milestones: true,
        plan: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
        subGoals: { include: { milestones: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    // ===== KPIs =====
    const now = new Date();
    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    const overdueGoals = goals.filter(
      g => g.status !== 'completed' && g.status !== 'cancelled' && g.dueDate && new Date(g.dueDate) < now
    ).length;
    const pendingApprovalGoals = goals.filter(g => g.status === 'pending-approval').length;
    const draftGoals = goals.filter(g => g.status === 'draft').length;

    // متوسط التقدّم
    const progressList = goals.map(g => calculateProgress(g).progress);
    const avgProgress =
      progressList.length > 0
        ? progressList.reduce((s, v) => s + v, 0) / progressList.length
        : 0;

    // النتيجة المرجّحة
    const weighted = calculateWeightedScore(goals);

    // التحقق من مجموع الأوزان
    const weightsValidation = validateWeightsSum(goals);

    // توزيع حسب الحالة
    const byStatus: Record<string, number> = {};
    for (const g of goals) {
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;
    }

    // توزيع حسب المستوى
    const byLevel: Record<string, number> = {};
    for (const g of goals) {
      byLevel[g.level] = (byLevel[g.level] || 0) + 1;
    }

    // توزيع حسب الأولوية
    const byPriority: Record<string, number> = {};
    for (const g of goals) {
      byPriority[g.priority] = (byPriority[g.priority] || 0) + 1;
    }

    // توزيع حسب الفئة
    const byCategory: Record<string, number> = {};
    for (const g of goals) {
      const cat = g.category || 'غير مصنّف';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // الأهداف المتعثرة (تقدّم < 25% مع اقتراب الموعد أو تجاوزه)
    const struggling = goals
      .map(g => {
        const p = calculateProgress(g);
        const dueIn = g.dueDate
          ? Math.floor((new Date(g.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return { goal: g, progress: p.progress, status: p.status, dueIn };
      })
      .filter(
        x =>
          x.status === 'behind' ||
          x.status === 'at-risk' ||
          (x.dueIn !== null && x.dueIn < 0 && x.status !== 'completed')
      )
      .slice(0, 10);

    // أفضل الأهداف (مكتملة أو متقدمة)
    const topPerformers = goals
      .map(g => ({ goal: g, progress: calculateProgress(g).progress }))
      .filter(x => x.progress >= 75)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5);

    // الأهداف حسب الموظف
    const byEmployeeMap = new Map<string, { name: string; total: number; avgProgress: number }>();
    for (const g of goals) {
      const key = g.assignedTo || 'unassigned';
      const name = g.assignedToUser?.name || 'غير مُسنَد';
      const existing = byEmployeeMap.get(key) || { name, total: 0, avgProgress: 0 };
      existing.total++;
      existing.avgProgress += calculateProgress(g).progress;
      byEmployeeMap.set(key, existing);
    }
    const byEmployee = Array.from(byEmployeeMap.entries()).map(([k, v]) => ({
      id: k,
      name: v.name,
      total: v.total,
      avgProgress: v.total > 0 ? Math.round(v.avgProgress / v.total) : 0,
    }));

    // ===== آخر التحديثات =====
    const recentUpdates = await db.goalUpdate.findMany({
      where: { goal: { ...branchFilter } },
      include: {
        goal: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      kpis: {
        totalGoals,
        activeGoals,
        completedGoals,
        overdueGoals,
        pendingApprovalGoals,
        draftGoals,
        avgProgress: Math.round(avgProgress * 10) / 10,
        weightedScore: Math.round(weighted.weightedScore * 10) / 10,
        totalWeight: weighted.totalWeight,
        averageProgress: Math.round(weighted.averageProgress * 10) / 10,
        plansCount: plans.length,
      },
      weightsValidation,
      distributions: {
        byStatus,
        byLevel,
        byPriority,
        byCategory,
      },
      plans,
      struggling: struggling.map(x => ({
        id: x.goal.id,
        title: x.goal.title,
        progress: Math.round(x.progress),
        status: x.status,
        dueIn: x.dueIn,
        assignedTo: x.goal.assignedToUser?.name || null,
        priority: x.goal.priority,
      })),
      topPerformers: topPerformers.map(x => ({
        id: x.goal.id,
        title: x.goal.title,
        progress: Math.round(x.progress),
        assignedTo: x.goal.assignedToUser?.name || null,
      })),
      byEmployee,
      recentUpdates: recentUpdates.map(u => ({
        id: u.id,
        goalId: u.goal.id,
        goalTitle: u.goal.title,
        actualValue: u.actualValue,
        previousValue: u.previousValue,
        status: u.status,
        submittedAt: u.submittedAt,
        user: u.user?.name || null,
        notes: u.notes,
      })),
      isDirector: true,
      lastUpdate: now.toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals/dashboard error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
