// ===== POST /api/ai/setup-groq — يكتب إعدادات Groq مباشرة في قاعدة البيانات =====
// هذا المسار يتجاوز TypeScript types — يكتب 'groq' كنص مباشر
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const apiKey = body.apiKey;

    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    // Write settings DIRECTLY to database as raw strings
    // This bypasses TypeScript ProviderId type checking
    await db.setting.upsert({
      where: { key: 'ai_enabled' },
      create: { key: 'ai_enabled', value: 'true' },
      update: { value: 'true' },
    });

    await db.setting.upsert({
      where: { key: 'ai_provider' },
      create: { key: 'ai_provider', value: 'groq' },
      update: { value: 'groq' },
    });

    await db.setting.upsert({
      where: { key: 'ai_api_key' },
      create: { key: 'ai_api_key', value: apiKey },
      update: { value: apiKey },
    });

    await db.setting.upsert({
      where: { key: 'ai_model' },
      create: { key: 'ai_model', value: 'llama-3.1-8b-instant' },
      update: { value: 'llama-3.1-8b-instant' },
    });

    await db.setting.upsert({
      where: { key: 'ai_max_tokens' },
      create: { key: 'ai_max_tokens', value: '2048' },
      update: { value: '2048' },
    });

    await db.setting.upsert({
      where: { key: 'ai_temperature' },
      create: { key: 'ai_temperature', value: '0.7' },
      update: { value: '0.7' },
    });

    return NextResponse.json({
      ok: true,
      message: 'Groq configured successfully',
      settings: {
        enabled: true,
        provider: 'groq',
        apiKey: apiKey.substring(0, 5) + '...',
        model: 'llama-3.1-8b-instant',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('POST /api/ai/setup-groq error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown') },
      { status: 500 }
    );
  }
}
