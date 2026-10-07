import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/notifications?unreadOnly=true
 * POST /api/notifications — إنشاء إشعار
 * POST /api/notifications?id=xxx&action=read — تعليم كمقروء
 * POST /api/notifications?action=readAll — تعليم الكل كمقروء
 * DELETE /api/notifications?id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {
      OR: [
        { userId: user.id },
        { userId: null },
      ],
    };
    if (unreadOnly) where.isRead = false;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await db.notification.count({
      where: { ...where, isRead: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    // تعليم كمقروء
    if (action === 'read' && id) {
      await db.notification.updateMany({
        where: { id, OR: [{ userId: user.id }, { userId: null }] },
        data: { isRead: true },
      });
      return NextResponse.json({ ok: true });
    }

    // تعليم الكل كمقروء
    if (action === 'readAll') {
      await db.notification.updateMany({
        where: { OR: [{ userId: user.id }, { userId: null }], isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ ok: true });
    }

    // إنشاء إشعار
    const body = await request.json();
    const { title, message, type, category, link, userId } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'العنوان والرسالة مطلوبان' }, { status: 400 });
    }

    const notification = await db.notification.create({
      data: {
        title,
        message,
        type: type || 'info',
        category: category || 'general',
        link: link || null,
        userId: userId || null,
      },
    });

    return NextResponse.json({ notification });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });
    }

    await db.notification.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
