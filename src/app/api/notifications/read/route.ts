import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/notifications/read - تعليم إشعار كمقروء
// الجسم: { id: "<notificationId>" } لتعليم إشعار واحد
// أو: { all: true } لتعليم كل إشعارات المستخدم كمقروءة
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // تعليم كل الإشعارات كمقروءة (الموجّهة للجميع أو لدور المستخدم)
    if (body.all === true) {
      const result = await db.notification.updateMany({
        where: {
          isRead: false,
          OR: [{ targetRole: 'all' }, { targetRole: user.role }],
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        message: 'تم تعليم جميع الإشعارات كمقروءة',
        updated: result.count,
      });
    }

    // تعليم إشعار واحد كمقروء
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'يرجى تمرير id الإشعار أو all=true' },
        { status: 400 }
      );
    }

    // التأكد أن الإشعار موجود ومرئي للمستخدم قبل التحديث
    const notification = await db.notification.findFirst({
      where: {
        id: body.id,
        OR: [{ targetRole: 'all' }, { targetRole: user.role }],
      },
      select: { id: true, isRead: true },
    });

    if (!notification) {
      return NextResponse.json({ error: 'الإشعار غير موجود' }, { status: 404 });
    }

    if (notification.isRead) {
      // الإشعار مقروء مسبقاً - لا حاجة للتحديث
      return NextResponse.json({ message: 'الإشعار مقروء مسبقاً', updated: 0 });
    }

    await db.notification.update({
      where: { id: body.id },
      data: { isRead: true },
    });

    return NextResponse.json({ message: 'تم تعليم الإشعار كمقروء', updated: 1 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/notifications/read error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}
