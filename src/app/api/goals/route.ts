import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

/**
 * GET /api/goals
 * قائمة الأهداف (مُصفّاة حسب الفرع النشط + الأدوار)
 *
 * المدير: يرى كل الأهداف في نطاق الفرع النشط
 * الموظف: يرى فقط الأهداف المُسنَدة إليه
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const level = searchParams.get('level');
    const priority = searchParams.get('priority');
    const planId = searchParams.get('planId');
    const assignedTo = searchParams.get('assignedTo');
    const departmentId = searchParams.get('departmentId');
    const includeSubGoals = searchParams.get('includeSubGoals') === 'true';

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };

    // الموظف: يرى فقط أهدافه
    if (user.role !== 'director') {
      where.assignedTo = user.id;
    } else if (assignedTo && assignedTo !== 'all') {
      where.assignedTo = assignedTo;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') where.status = status;
    if (level && level !== 'all') where.level = level;
    if (priority && priority !== 'all') where.priority = priority;
    if (planId && planId !== 'all') where.planId = planId;
    if (departmentId && departmentId !== 'all') where.departmentId = departmentId;

    // افتراضيًا نُخفي الأهداف الفرعية من القائمة الرئيسية (تظهر داخل تفاصيل الأب)
    if (!includeSubGoals) {
      where.parentGoalId = null;
    }

    const goals = await db.goal.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        milestones: true,
        subGoals: {
          select: {
            id: true,
            title: true,
            status: true,
            actual: true,
            target: true,
            baseline: true,
            progressMethod: true,
            direction: true,
            weight: true,
            milestones: true,
          },
        },
        _count: {
          select: { updates: true, reviews: true, correctiveActions: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ goals });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/goals error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/goals
 * إنشاء هدف جديد
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // الموظفون يمكنهم إنشاء أهداف لأنفسهم فقط؛ المديرون لكل المستخدمين
    if (user.role !== 'director' && body.assignedTo && body.assignedTo !== user.id) {
      return NextResponse.json(
        { error: 'يمكنك إنشاء أهداف لنفسك فقط' },
        { status: 403 }
      );
    }

    if (!body.title) {
      return NextResponse.json({ error: 'عنوان الهدف مطلوب' }, { status: 400 });
    }

    const assignedTo = body.assignedTo || (user.role === 'director' ? null : user.id);
    const branchId = body.branchId || (await getBranchIdForNewRecord());

    // إذا تم تمرير approvedById وكان المستخدم مديرًا، نُسجّل اعتمادًا تلقائيًا
    const approvedById = user.role === 'director' && body.status === 'active' ? user.id : null;
    const approvedAt = approvedById ? new Date() : null;

    const goal = await db.goal.create({
      data: {
        title: body.title,
        description: body.description || null,
        level: body.level || 'employee',
        planId: body.planId || null,
        parentGoalId: body.parentGoalId || null,
        branchId: branchId || null,
        departmentId: body.departmentId || null,
        assignedTo: assignedTo || null,
        category: body.category || null,
        priority: body.priority || 'medium',
        weight: parseFloat(body.weight) || 0,
        baseline: parseFloat(body.baseline) || 0,
        target: parseFloat(body.target) || 100,
        actual: parseFloat(body.actual) || 0,
        unit: body.unit || 'percentage',
        direction: body.direction || 'higher-is-better',
        progressMethod: body.progressMethod || 'formula',
        dataSource: body.dataSource || 'manual',
        autoMetric: body.autoMetric || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status || 'draft',
        notes: body.notes || null,
        approvedById,
        approvedAt,
      },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'goals',
          description: `إنشاء هدف: ${goal.title}`,
          targetType: 'goal',
          targetId: goal.id,
        },
      });
    } catch (e) {
      /* ignore */
    }

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/goals error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/goals?id=xxx
 * تحديث هدف
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرّف الهدف مطلوب' }, { status: 400 });
    }

    const body = await request.json();

    // التحقق من الملكية للموظف
    if (user.role !== 'director') {
      const existing = await db.goal.findUnique({ where: { id }, select: { assignedTo: true } });
      if (!existing || existing.assignedTo !== user.id) {
        return NextResponse.json({ error: 'غير مصرح بتعديل هذا الهدف' }, { status: 403 });
      }
    }

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.level !== undefined) data.level = body.level;
    if (body.planId !== undefined) data.planId = body.planId || null;
    if (body.parentGoalId !== undefined) data.parentGoalId = body.parentGoalId || null;
    if (body.branchId !== undefined) data.branchId = body.branchId || null;
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo || null;
    if (body.category !== undefined) data.category = body.category;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.weight !== undefined) data.weight = parseFloat(body.weight) || 0;
    if (body.baseline !== undefined) data.baseline = parseFloat(body.baseline) || 0;
    if (body.target !== undefined) data.target = parseFloat(body.target) || 0;
    if (body.actual !== undefined) data.actual = parseFloat(body.actual) || 0;
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.direction !== undefined) data.direction = body.direction;
    if (body.progressMethod !== undefined) data.progressMethod = body.progressMethod;
    if (body.dataSource !== undefined) data.dataSource = body.dataSource;
    if (body.autoMetric !== undefined) data.autoMetric = body.autoMetric;
    if (body.startDate !== undefined)
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined) {
      data.status = body.status;
      // اعتماد تلقائي عندما يحوّل المدير الهدف إلى active
      if (user.role === 'director' && body.status === 'active') {
        data.approvedById = user.id;
        data.approvedAt = new Date();
      }
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
    console.error('PUT /api/goals error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/goals?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'معرّف الهدف مطلوب' }, { status: 400 });
    }

    if (user.role !== 'director') {
      const existing = await db.goal.findUnique({ where: { id }, select: { assignedTo: true, title: true } });
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
    console.error('DELETE /api/goals error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
