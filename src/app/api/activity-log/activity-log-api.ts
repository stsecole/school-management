import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/activity-log?limit=100&offset=0&action=xxx&module=xxx&userId=xxx&search=xxx
 * قراءة سجل التغييرات
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const module = searchParams.get('module');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');

    const where: any = {};
    if (action && action !== 'all') where.action = action;
    if (module && module !== 'all') where.module = module;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { userName: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activityLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/activity-log error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/activity-log?id=xxx  أو  ?olderThan=30 (حذف الأقدم من 30 يوم)
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const olderThan = searchParams.get('olderThan');

    if (id) {
      await db.activityLog.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (olderThan) {
      const days = parseInt(olderThan);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const result = await db.activityLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    return NextResponse.json({ error: 'id or olderThan required' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
