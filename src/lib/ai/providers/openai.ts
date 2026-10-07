// ===== مزود OpenAI (REST API مع دعم SSE Streaming) =====
import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class OpenAIProvider implements AIProvider {
  id: ProviderId = 'openai';
  name = 'OpenAI';
  protected apiKey: string;
  protected baseUrl: string;
  protected model: string;

  constructor(opts: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = opts.model || 'gpt-4o-mini';
  }

  protected headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected body(req: ChatRequest): Record<string, unknown> {
    return {
      model: req.model || this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: false,
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.body(req)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI ${res.status}: ${text}`);
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model || req.model || this.model,
      provider: this.id,
      tokensUsed: data.usage?.total_tokens,
      durationMs: Date.now() - start,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const body = { ...this.body(req), stream: true };
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      yield { delta: '', done: true, error: `OpenAI ${res.status}: ${text}` };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          yield { delta: '', done: true, provider: this.id };
          return;
        }
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content ?? '';
          if (delta) yield { delta, provider: this.id };
        } catch {
          // ignore parse errors
        }
      }
    }
    yield { delta: '', done: true, provider: this.id };
  }

  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const start = Date.now();
    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
      });
      return {
        ok: true,
        message: `تم الاتصال بنجاح بـ ${this.name}`,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: `فشل: ${err?.message || 'خطأ'}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
