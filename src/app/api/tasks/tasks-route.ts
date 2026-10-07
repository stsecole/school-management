import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { responsible: { contains: search } },
        { notes: { contains: search } },
      ];
    }
    if (status === 'completed') where.completed = true;
    if (status === 'pending') where.completed = false;
    if (priority && priority !== 'all') where.priority = priority;

    const tasks = await db.task.findMany({
      where,
      orderBy: [{ completed: 'asc' }, { deadline: 'asc' }],
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const priorityMap: Record<string, string> = {
      'عالي': 'high', 'متوسط': 'medium', 'منخفض': 'low',
      'high': 'high', 'medium': 'medium', 'low': 'low',
    };
    const priorityLabelMap: Record<string, string> = {
      'high': 'عالي', 'medium': 'متوسط', 'low': 'منخفض',
    };
    const priority = priorityMap[body.priorityLabel] || body.priority || 'medium';

    const task = await db.task.create({
      data: {
        title: body.title,
        priority,
        priorityLabel: body.priorityLabel || priorityLabelMap[priority],
        responsible: body.responsible || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        completed: body.completed || false,
        status: body.status || 'pending',
        statusValue: body.statusValue ? parseInt(body.statusValue) : 0,
        notes: body.notes || null,
      },
    });

    try { await db.activityLog.create({ data: { userId: user.id, userName: user.name, action: 'create', module: 'tasks', description: 'إضافة مهمة: ' + task.title } }); } catch (e) {}

        return NextResponse.json({ task }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
