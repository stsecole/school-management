import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendMessage } from '@/lib/whatsapp';

/**
 * POST /api/whatsapp/send
 * إرسال رسالة واتساب واحدة
 * body: { phone, message, recipientName?, templateName? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { phone, message, recipientName, templateName } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: 'الرقم والرسالة مطلوبان' }, { status: 400 });
    }

    const result = await sendMessage(phone, message, {
      recipientName,
      templateName,
      sentBy: user.name,
    });

    // سجل الإرسال
    try { await db.activityLog.create({ data: { userId: user.id, userName: user.name, action: 'create', module: 'whatsapp', description: 'إرسال رسالة واتساب: ' + phone } }); } catch (e) {}

        return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/whatsapp/send error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
