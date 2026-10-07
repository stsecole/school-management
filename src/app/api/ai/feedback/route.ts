// ===== POST /api/ai/feedback =====
// { messageId, feedback }

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { messageId, feedback, note } = body;
  if (!messageId) {
    return NextResponse.json({ error: 'messageId مطلوب' }, { status: 400 });
  }
  if (!['positive', 'negative'].includes(feedback)) {
    return NextResponse.json(
      { error: 'feedback يجب أن يكون positive أو negative' },
      { status: 400 }
    );
  }
  const msg = await db.aIMessage.findUnique({ where: { id: messageId } });
  if (!msg) {
    return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 });
  }
  // تحقق من الملكية عبر المحادثة
  const conv = await db.aIConversation.findUnique({
    where: { id: msg.conversationId },
  });
  if (!conv || conv.userId !== user.id) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }
  const updated = await db.aIMessage.update({
    where: { id: messageId },
    data: { feedback, feedbackNote: note || null },
  });
  return NextResponse.json({ ok: true, message: updated });
}
