// ===== /api/ai/conversations/[id] =====
// GET + DELETE + PATCH (pin/rename)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const { id } = await params;
  const conv = await db.aIConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conv) {
    return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  }
  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      pinned: conv.pinned,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      messageType: m.messageType,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      feedback: m.feedback,
      provider: m.provider,
      createdAt: m.createdAt,
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const { id } = await params;
  const conv = await db.aIConversation.findFirst({
    where: { id, userId: user.id },
  });
  if (!conv) {
    return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  }
  await db.aIConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const conv = await db.aIConversation.findFirst({
    where: { id, userId: user.id },
  });
  if (!conv) {
    return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 });
  }
  const data: any = {};
  if (typeof body.pinned === 'boolean') data.pinned = body.pinned;
  if (typeof body.title === 'string') data.title = body.title;
  const updated = await db.aIConversation.update({ where: { id }, data });
  return NextResponse.json({ conversation: updated });
}
