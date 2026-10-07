import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/messages/read - تعليم رسالة كمقروءة
// الجسم: { id: "<messageId>" }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'يرجى تمرير id الرسالة' },
        { status: 400 }
      );
    }

    // التأكد أن الرسالة موجودة ومرئية للمستخدم
    const message = await db.message.findFirst({
      where: {
        id: body.id,
        OR: [
          { recipientId: user.id },
          { recipientId: null, senderRole: 'director' },
        ],
      },
      select: { id: true, isRead: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    }

    if (message.isRead) {
      return NextResponse.json({ message: 'الرسالة مقروءة مسبقاً', updated: 0 });
    }

    await db.message.update({
      where: { id: body.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ message: 'تم تعليم الرسالة كمقروءة', updated: 1 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/messages/read error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}

// DELETE /api/messages/read?id=<messageId> - حذف رسالة
// المدير يمكنه حذف أي رسالة، الموظف يحذف فقط الرسائل الموجهة له أو المرسلة منه
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'يرجى تمرير id الرسالة' }, { status: 400 });
    }

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, senderId: true, recipientId: true, senderRole: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
    }

    const isDirector = user.role === 'director';
    const canDelete =
      isDirector ||
      message.senderId === user.id ||
      message.recipientId === user.id;

    if (!canDelete) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف هذه الرسالة' },
        { status: 403 }
      );
    }

    await db.message.delete({ where: { id } });

    return NextResponse.json({ message: 'تم حذف الرسالة' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/messages/read error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}
