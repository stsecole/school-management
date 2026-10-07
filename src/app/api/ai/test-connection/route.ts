// ===== POST /api/ai/test-connection - اختبار الاتصال بالمزود الحالي =====
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getActiveProvider } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Allow up to 60 seconds for LLM connection test (default 10s is too short for ZAI)
export const maxDuration = 60;

export async function POST() {
  const user = await requireAuth();
  if (user.role !== 'director') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { provider, settings } = await getActiveProvider();
  const result = await provider.testConnection();
  return NextResponse.json({ ...result, provider: settings.provider });
}
