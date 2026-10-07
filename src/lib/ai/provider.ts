import { db } from '@/lib/db';
import type { AIProvider, AISettings, ChatChunk, ChatRequest, ChatResponse, ProviderId } from './types';
import { DEFAULT_AI_SETTINGS, PROVIDER_DEFAULTS } from './types';
import { ZaiProvider } from './providers/zai';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { GroqProvider } from './providers/groq';
import { LocalProvider } from './providers/local';

export const SETTING_KEYS = {
  ENABLED: 'ai_enabled',
  PROVIDER: 'ai_provider',
  API_KEY: 'ai_api_key',
  MODEL: 'ai_model',
  MAX_TOKENS: 'ai_max_tokens',
  TEMPERATURE: 'ai_temperature',
  BASE_URL: 'ai_base_url',
} as const;

export async function getAISettings(): Promise<AISettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const provider = (map[SETTING_KEYS.PROVIDER] as ProviderId) || 'zai';
  const defaults = PROVIDER_DEFAULTS[provider];

  return {
    enabled: map[SETTING_KEYS.ENABLED] !== 'false',
    provider,
    apiKey: map[SETTING_KEYS.API_KEY] || '',
    model: map[SETTING_KEYS.MODEL] || defaults.defaultModel,
    maxTokens: parseInt(map[SETTING_KEYS.MAX_TOKENS] || '2048', 10),
    temperature: parseFloat(map[SETTING_KEYS.TEMPERATURE] || '0.7'),
    baseUrl: map[SETTING_KEYS.BASE_URL] || undefined,
  };
}

export async function saveAISettings(settings: Partial<AISettings>): Promise<void> {
  const entries: { key: string; value: string }[] = [];
  if (settings.enabled !== undefined)
    entries.push({ key: SETTING_KEYS.ENABLED, value: String(settings.enabled) });
  if (settings.provider)
    entries.push({ key: SETTING_KEYS.PROVIDER, value: settings.provider });
  if (settings.apiKey !== undefined)
    entries.push({ key: SETTING_KEYS.API_KEY, value: settings.apiKey });
  if (settings.model !== undefined)
    entries.push({ key: SETTING_KEYS.MODEL, value: settings.model });
  if (settings.maxTokens !== undefined)
    entries.push({ key: SETTING_KEYS.MAX_TOKENS, value: String(settings.maxTokens) });
  if (settings.temperature !== undefined)
    entries.push({ key: SETTING_KEYS.TEMPERATURE, value: String(settings.temperature) });
  if (settings.baseUrl !== undefined)
    entries.push({ key: SETTING_KEYS.BASE_URL, value: settings.baseUrl });

  for (const e of entries) {
    await db.setting.upsert({
      where: { key: e.key },
      create: { key: e.key, value: e.value },
      update: { value: e.value },
    });
  }
}

export function createProvider(settings: AISettings): AIProvider {
  const defaults = PROVIDER_DEFAULTS[settings.provider];
  switch (settings.provider) {
    case 'zai':
      return new ZaiProvider();
    case 'openai':
      return new OpenAIProvider({ apiKey: settings.apiKey, baseUrl: settings.baseUrl || defaults.baseUrl, model: settings.model });
    case 'gemini':
      return new GeminiProvider({ apiKey: settings.apiKey, baseUrl: settings.baseUrl || defaults.baseUrl, model: settings.model });
    case 'claude':
      return new ClaudeProvider({ apiKey: settings.apiKey, baseUrl: settings.baseUrl || defaults.baseUrl, model: settings.model });
    case 'deepseek':
      return new DeepSeekProvider({ apiKey: settings.apiKey, baseUrl: settings.baseUrl || defaults.baseUrl, model: settings.model });
    case 'groq':
      return new GroqProvider({ apiKey: settings.apiKey, baseUrl: settings.baseUrl || defaults.baseUrl, model: settings.model });
    case 'local':
    default:
      return new LocalProvider();
  }
}

export async function getActiveProvider(): Promise<{ provider: AIProvider; settings: AISettings }> {
  const settings = await getAISettings();
  if (!settings.enabled) {
    return { provider: new LocalProvider(), settings: { ...settings, provider: 'local' } };
  }
  const provider = createProvider(settings);
  return { provider, settings };
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const { provider, settings } = await getActiveProvider();
  return provider.chat({
    ...req,
    model: req.model || settings.model,
    temperature: req.temperature ?? settings.temperature,
    maxTokens: req.maxTokens ?? settings.maxTokens,
  });
}

export async function* chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
  const { provider, settings } = await getActiveProvider();
  yield* provider.chatStream({
    ...req,
    model: req.model || settings.model,
    temperature: req.temperature ?? settings.temperature,
    maxTokens: req.maxTokens ?? settings.maxTokens,
  });
}

export { DEFAULT_AI_SETTINGS, PROVIDER_DEFAULTS };
export type { AIProvider, AISettings, ChatChunk, ChatRequest, ChatResponse, ProviderId };