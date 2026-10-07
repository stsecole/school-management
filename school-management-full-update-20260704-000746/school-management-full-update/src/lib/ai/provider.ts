// ===== مزوّد المساعد الذكي =====
// مصنع المزودات + إدارة الإعدادات (Setting table with ai_ prefix)

import { db } from '@/lib/db';
import {
  AISettings,
  AIProvider,
  ChatRequest,
  ChatResponse,
  DEFAULT_AI_SETTINGS,
  ProviderId,
} from './types';
import { ZaiProvider } from './providers/zai';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { LocalProvider } from './providers/local';
import { PollinationsProvider } from './providers/pollinations';

/**
 * إنشاء مزوّد بناءً على المعرف والإعدادات
 */
export function createProvider(
  id: ProviderId,
  settings: AISettings
): AIProvider {
  const providerCfg = settings.providers[id] || {};
  switch (id) {
    case 'zai':
      return new ZaiProvider({ model: providerCfg.model });
    case 'openai':
      return new OpenAIProvider({
        apiKey: providerCfg.apiKey,
        model: providerCfg.model,
        baseUrl: providerCfg.baseUrl,
      });
    case 'gemini':
      return new GeminiProvider({
        apiKey: providerCfg.apiKey,
        model: providerCfg.model,
        baseUrl: providerCfg.baseUrl,
      });
    case 'claude':
      return new ClaudeProvider({
        apiKey: providerCfg.apiKey,
        model: providerCfg.model,
        baseUrl: providerCfg.baseUrl,
      });
    case 'deepseek':
      return new DeepSeekProvider({
        apiKey: providerCfg.apiKey,
        model: providerCfg.model,
        baseUrl: providerCfg.baseUrl,
      });
    case 'local':
      return PollinationsProvider();
    default:
      return new PollinationsProvider();
  }
}

/**
 * قراءة إعدادات AI من جدول Setting (key prefixed with "ai_")
 */
export async function getAISettings(): Promise<AISettings> {
  try {
    const rows = await db.setting.findMany({
      where: { key: { startsWith: 'ai_' } },
    });
    if (rows.length === 0) return DEFAULT_AI_SETTINGS;

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const providers = { ...DEFAULT_AI_SETTINGS.providers };
    for (const pid of Object.keys(providers) as ProviderId[]) {
      const apiKey = map[`ai_provider_${pid}_apiKey`] || '';
      const model = map[`ai_provider_${pid}_model`] || providers[pid].model;
      const baseUrl = map[`ai_provider_${pid}_baseUrl`] || providers[pid].baseUrl;
      providers[pid] = { apiKey, model, baseUrl };
    }

    return {
      enabled: map['ai_enabled'] !== 'false',
      activeProvider: (map['ai_active_provider'] as ProviderId) || 'zai',
      providers,
      maxTokens: parseInt(map['ai_max_tokens'] || '2048', 10),
      temperature: parseFloat(map['ai_temperature'] || '0.7'),
    };
  } catch (err) {
    console.error('getAISettings error:', err);
    return DEFAULT_AI_SETTINGS;
  }
}

/**
 * حفظ إعدادات AI إلى جدول Setting
 */
export async function saveAISettings(settings: AISettings): Promise<void> {
  const entries: { key: string; value: string }[] = [
    { key: 'ai_enabled', value: String(settings.enabled) },
    { key: 'ai_active_provider', value: settings.activeProvider },
    { key: 'ai_max_tokens', value: String(settings.maxTokens) },
    { key: 'ai_temperature', value: String(settings.temperature) },
  ];
  for (const pid of Object.keys(settings.providers) as ProviderId[]) {
    const cfg = settings.providers[pid];
    entries.push({ key: `ai_provider_${pid}_apiKey`, value: cfg.apiKey });
    entries.push({ key: `ai_provider_${pid}_model`, value: cfg.model });
    if (cfg.baseUrl) {
      entries.push({ key: `ai_provider_${pid}_baseUrl`, value: cfg.baseUrl });
    }
  }
  await Promise.all(
    entries.map((e) =>
      db.setting.upsert({
        where: { key: e.key },
        update: { value: e.value },
        create: { key: e.key, value: e.value },
      })
    )
  );
}

/**
 * الحصول على المزوّد النشط
 */
export async function getActiveProvider(): Promise<{
  provider: AIProvider;
  settings: AISettings;
}> {
  const settings = await getAISettings();
  // إذا كان AI معطّلاً، استخدم Pollinations (مجاني، يعمل دائماً)
  if (!settings.enabled) {
    return { provider: new PollinationsProvider(), settings };
  }
  const provider = createProvider(settings.activeProvider, settings);
  return { provider, settings };
}

/**
 * استدعاء غير متصل
 */
export async function chat(
  req: ChatRequest
): Promise<{ response: ChatResponse; provider: AIProvider; settings: AISettings }> {
  const { provider, settings } = await getActiveProvider();
  try {
    const response = await provider.chat({
      ...req,
      temperature: req.temperature ?? settings.temperature,
      maxTokens: req.maxTokens ?? settings.maxTokens,
    });
    return { response, provider, settings };
  } catch (err: any) {
    // عند فشل المزوّد الأساسي، ارجع إلى Pollinations (مجاني)
    console.error(`[AI] Provider ${provider.id} failed, falling back to Pollinations:`, err?.message);
    const fallback = new PollinationsProvider();
    const response = await fallback.chat(req);
    return { response, provider: fallback, settings };
  }
}

/**
 * استدعاء streaming
 */
export async function* chatStream(
  req: ChatRequest
): AsyncGenerator<
  { delta: string; done?: boolean; finishReason?: string; provider: AIProvider },
  void,
  unknown
> {
  const { provider, settings } = await getActiveProvider();
  console.log(`[AI] Using provider: ${provider.id} (active=${settings.activeProvider}, enabled=${settings.enabled})`);
  try {
    for await (const chunk of provider.chatStream({
      ...req,
      temperature: req.temperature ?? settings.temperature,
      maxTokens: req.maxTokens ?? settings.maxTokens,
    })) {
      yield { ...chunk, provider };
    }
  } catch (err: any) {
    console.error(`[AI] Streaming ${provider.id} failed:`, err?.message || err);
    console.error(`[AI] Falling back to Pollinations provider...`);
    const fallback = new PollinationsProvider();
    for await (const chunk of fallback.chatStream(req)) {
      yield { ...chunk, provider: fallback };
    }
  }
}
