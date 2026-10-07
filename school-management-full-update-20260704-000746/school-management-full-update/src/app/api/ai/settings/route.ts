// ===== /api/ai/settings =====
// GET (mask API key for non-directors) + PUT (directors only)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireDirector } from '@/lib/auth';
import { getAISettings, saveAISettings } from '@/lib/ai/provider';
import { DEFAULT_AI_SETTINGS, PROVIDER_DEFAULTS } from '@/lib/ai/types';
import type { AISettings, ProviderId } from '@/lib/ai/types';

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

function maskSettings(settings: AISettings): AISettings {
  const providers = { ...settings.providers };
  for (const pid of Object.keys(providers) as ProviderId[]) {
    providers[pid] = {
      ...providers[pid],
      apiKey: maskApiKey(providers[pid].apiKey),
    };
  }
  return { ...settings, providers };
}

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const settings = await getAISettings();
  // للموظفين: أعد المعلومات العامة فقط مع إخفاء المفاتيح
  if (user.role !== 'director') {
    return NextResponse.json({
      settings: {
        enabled: settings.enabled,
        activeProvider: settings.activeProvider,
        providers: Object.fromEntries(
          (Object.keys(settings.providers) as ProviderId[]).map((pid) => [
            pid,
            {
              apiKey: maskApiKey(settings.providers[pid].apiKey),
              model: settings.providers[pid].model,
              baseUrl: settings.providers[pid].baseUrl,
              hasKey: !!settings.providers[pid].apiKey,
            },
          ])
        ),
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      },
      isDirector: false,
      providerDefaults: PROVIDER_DEFAULTS,
    });
  }
  return NextResponse.json({
    settings,
    isDirector: true,
    providerDefaults: PROVIDER_DEFAULTS,
  });
}

export async function PUT(request: NextRequest) {
  let user;
  try {
    user = await requireDirector();
  } catch {
    return NextResponse.json({ error: 'صلاحيات المدير مطلوبة' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const current = await getAISettings();

  // دمج الإعدادات: احتفظ بمفاتيح API القديمة إذا لم تُرسل أو إذا كانت مُقنّعة
  const providers = { ...current.providers };
  if (body.providers) {
    for (const pid of Object.keys(body.providers) as ProviderId[]) {
      const incoming = body.providers[pid];
      const existing = providers[pid] || DEFAULT_AI_SETTINGS.providers[pid];
      let apiKey = incoming.apiKey ?? existing.apiKey;
      // إذا كان المفتاح مُقنّعاً، احتفظ بالقديم
      if (typeof apiKey === 'string' && apiKey.includes('••••')) {
        apiKey = existing.apiKey;
      }
      providers[pid] = {
        apiKey,
        model: incoming.model ?? existing.model,
        baseUrl: incoming.baseUrl ?? existing.baseUrl,
      };
    }
  }

  const newSettings: AISettings = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    activeProvider: (body.activeProvider as ProviderId) || current.activeProvider,
    providers,
    maxTokens:
      typeof body.maxTokens === 'number' ? body.maxTokens : current.maxTokens,
    temperature:
      typeof body.temperature === 'number'
        ? body.temperature
        : current.temperature,
  };

  await saveAISettings(newSettings);

  // سجل في audit log
  try {
    const { db } = await import('@/lib/db');
    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'ai_settings_update',
        targetType: 'ai',
        details: JSON.stringify({
          enabled: newSettings.enabled,
          activeProvider: newSettings.activeProvider,
        }),
        source: 'ai_assistant',
        status: 'success',
      },
    });
  } catch (err) {
    console.error('audit log error:', err);
  }

  return NextResponse.json({
    ok: true,
    settings: maskSettings(newSettings),
  });
}
