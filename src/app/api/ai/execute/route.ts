// ===== POST /api/ai/execute =====
// تنفيذ إجراء مؤكد

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ctxFromUser } from '@/lib/ai/context';
import { executeAction, getAction } from '@/lib/ai/tools/actions';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { action, params, messageId } = body;
  if (!action) {
    return NextResponse.json({ error: 'الإجراء مطلوب' }, { status: 400 });
  }
  const def = getAction(action);
  if (!def) {
    return NextResponse.json({ error: 'الإجراء غير معروف' }, { status: 400 });
  }
  const ctx = ctxFromUser(user);
  const result = await executeAction(action, ctx, params || {});

  // حدّث metadata للرسالة الأصلية بحالة التنفيذ
  if (messageId) {
    try {
      const msg = await db.aIMessage.findUnique({ where: { id: messageId } });
      if (msg) {
        const meta = msg.metadata ? JSON.parse(msg.metadata) : {};
        meta.execution = {
          action,
          params,
          success: result.success,
          message: result.message,
          executedAt: new Date().toISOString(),
        };
        await db.aIMessage.update({
          where: { id: messageId },
          data: { metadata: JSON.stringify(meta) },
        });
      }
    } catch (err) {
      console.error('Failed to update message metadata:', err);
    }
  }

  return NextResponse.json(result);
}
