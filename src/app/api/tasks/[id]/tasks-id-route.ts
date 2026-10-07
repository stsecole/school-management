import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const priorityMap: Record<string, string> = {
      'عالي': 'high', 'متوسط': 'medium', 'منخفض': 'low',
      'high': 'high', 'medium': 'medium', 'low': 'low',
    };
    const priorityLabelMap: Record<string, string> = {
      'high': 'عالي', 'medium': 'متوسط', 'low': 'منخفض',
    };
    const priority = body.priorityLabel ? priorityMap[body.priorityLabel] : body.priority;

    const task = await db.task.update({
      where: { id },
      data: {
        title: body.title,
        priority: priority || undefined,
        priorityLabel: body.priorityLabel || (priority ? priorityLabelMap[priority] : undefined),
        responsible: body.responsible || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        completed: body.completed,
        status: body.status,
        statusValue: body.statusValue !== undefined ? parseInt(body.statusValue) : undefined,
        notes: body.notes || null,
      },
    });

    // سجل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'update', module: 'tasks',
          description: 'تعديل مهمة: ' + task.title,
        }
      });
    } catch (e) {}

    return NextResponse.json({ task });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const taskData = await db.task.findUnique({ where: { id }, select: { title: true } });
    await db.task.delete({ where: { id } });

    // سجل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'delete', module: 'tasks',
          description: 'حذف مهمة: ' + (taskData?.title || id),
        }
      });
    } catch (e) {}

    return NextResponse.json({ message: 'تم حذف المهمة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
