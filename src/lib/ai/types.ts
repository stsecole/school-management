export type ProviderId = 'zai' | 'openai' | 'gemini' | 'claude' | 'deepseek' | 'groq' | 'local';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface ChatRequest { messages: ChatMessage[]; model?: string; temperature?: number; maxTokens?: number; stream?: boolean; }
export interface ChatResponse { content: string; model: string; provider: string; tokensUsed?: number; durationMs?: number; finishReason?: string; }
export interface ChatChunk { delta: string; done?: boolean; provider?: string; tokensUsed?: number; finishReason?: string; }
export interface AISettings { enabled: boolean; provider: ProviderId; apiKey: string; model: string; maxTokens: number; temperature: number; baseUrl?: string; }
export interface AIProvider { id: ProviderId; name: string; chat(req: ChatRequest): Promise<ChatResponse>; chatStream(req: ChatRequest): AsyncIterable<ChatChunk>; testConnection(): Promise<{ ok: boolean; message: string; latencyMs?: number }>; }

export const DEFAULT_AI_SETTINGS: AISettings = { enabled: true, provider: 'zai', apiKey: '', model: 'glm-4.6', maxTokens: 2048, temperature: 0.7 };

export const PROVIDER_DEFAULTS: Record<ProviderId, { name: string; defaultModel: string; baseUrl?: string; requiresKey: boolean; supportsStreaming: boolean; }> = {
  zai: { name: 'Z.AI (مدمج)', defaultModel: 'glm-4.6', requiresKey: false, supportsStreaming: true },
  openai: { name: 'OpenAI', defaultModel: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', requiresKey: true, supportsStreaming: true },
  gemini: { name: 'Google Gemini', defaultModel: 'gemini-1.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', requiresKey: true, supportsStreaming: true },
  claude: { name: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022', baseUrl: 'https://api.anthropic.com/v1', requiresKey: true, supportsStreaming: true },
  deepseek: { name: 'DeepSeek', defaultModel: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', requiresKey: true, supportsStreaming: true },
  groq: { name: 'Groq (مجاني وسريع)', defaultModel: 'llama-3.1-8b-instant', baseUrl: 'https://api.groq.com/openai/v1', requiresKey: true, supportsStreaming: true },
  local: { name: 'محلي (دون اتصال)', defaultModel: 'local-fallback', requiresKey: false, supportsStreaming: false },
};