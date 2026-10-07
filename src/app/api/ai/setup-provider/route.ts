// ===== POST /api/ai/setup-provider — حفظ إعدادات أي مزود مباشرة =====
// هذا المسار يتجاوز TypeScript types — يكتب الإعدادات كنصوص مباشرة في قاعدة البيانات
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_CONFIG: Record<string, { model: string; label: string }> = {
  groq: { model: 'llama-3.1-8b-instant', label: 'Groq' },
  gemini: { model: 'gemini-1.5-flash', label: 'Google Gemini' },
  openai: { model: 'gpt-4o-mini', label: 'OpenAI' },
  deepseek: { model: 'deepseek-chat', label: 'DeepSeek' },
};

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const provider = body.provider;
    const apiKey = body.apiKey;

    if (!provider || !PROVIDER_CONFIG[provider]) {
      return NextResponse.json({ error: 'مزود غير صالح' }, { status: 400 });
    }
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: 'مفتاح API غير صالح' }, { status: 400 });
    }

    const config = PROVIDER_CONFIG[provider];

    // Write settings DIRECTLY to database
    await db.setting.upsert({ where: { key: 'ai_enabled' }, create: { key: 'ai_enabled', value: 'true' }, update: { value: 'true' } });
    await db.setting.upsert({ where: { key: 'ai_provider' }, create: { key: 'ai_provider', value: provider }, update: { value: provider } });
    await db.setting.upsert({ where: { key: 'ai_api_key' }, create: { key: 'ai_api_key', value: apiKey }, update: { value: apiKey } });
    await db.setting.upsert({ where: { key: 'ai_model' }, create: { key: 'ai_model', value: config.model }, update: { value: config.model } });
    await db.setting.upsert({ where: { key: 'ai_max_tokens' }, create: { key: 'ai_max_tokens', value: '2048' }, update: { value: '2048' } });
    await db.setting.upsert({ where: { key: 'ai_temperature' }, create: { key: 'ai_temperature', value: '0.7' }, update: { value: '0.7' } });

    return NextResponse.json({
      ok: true,
      message: `تم تفعيل ${config.label} بنجاح`,
      provider,
      model: config.model,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('POST /api/ai/setup-provider error:', error);
    return NextResponse.json({ error: 'Server error: ' + (error.message || '') }, { status: 500 });
  }
}
