// ===== /api/ai/conversations =====
// GET (list) + POST (create)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const convs = await db.aIConversation.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({
    conversations: convs.map((c) => ({
      id: c.id,
      title: c.title,
      pinned: c.pinned,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const conv = await db.aIConversation.create({
    data: {
      userId: user.id,
      title: body.title || 'محادثة جديدة',
    },
  });
  return NextResponse.json({ conversation: conv });
}
