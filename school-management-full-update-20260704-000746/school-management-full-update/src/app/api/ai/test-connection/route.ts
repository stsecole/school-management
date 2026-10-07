// ===== POST /api/ai/test-connection =====
// اختبار المزود الحالي

import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { getAISettings, createProvider } from '@/lib/ai/provider';
import type { ProviderId } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireDirector();
  } catch {
    return NextResponse.json({ error: 'صلاحيات المدير مطلوبة' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const settings = await getAISettings();
  const targetProvider = (body.provider as ProviderId) || settings.activeProvider;
  const provider = createProvider(targetProvider, settings);
  const result = await provider.testConnection();

  // سجل في audit log
  try {
    const { db } = await import('@/lib/db');
    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'ai_test_connection',
        targetType: 'ai',
        details: JSON.stringify({
          provider: targetProvider,
          ok: result.ok,
          message: result.message,
        }),
        source: 'ai_assistant',
        status: result.ok ? 'success' : 'failed',
      },
    });
  } catch (err) {
    console.error('audit log error:', err);
  }

  return NextResponse.json({ provider: targetProvider, ...result });
}
