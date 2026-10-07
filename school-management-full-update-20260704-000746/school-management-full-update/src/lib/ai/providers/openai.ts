// ===== OpenAI Provider =====
// يستخدم fetch مباشرة، يدعم SSE streaming

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
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  } = {}) {
    this.apiKey = opts.apiKey || '';
    this.baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(
      /\/$/,
      ''
    );
    this.model = opts.model || 'gpt-4o-mini';
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected buildBody(req: ChatRequest): Record<string, any> {
    return {
      model: req.model || this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: false,
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildBody(req)),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return {
      content,
      role: 'assistant',
      model: data?.model || this.model,
      tokensUsed: data?.usage?.total_tokens,
      finishReason: data?.choices?.[0]?.finish_reason || 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const body = { ...this.buildBody(req), stream: true };
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ...this.getHeaders(), Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      // ارجع إلى وضع non-streaming
      const response = await this.chat(req);
      const tokens = response.content.match(/\S+\s*/g) || [response.content];
      for (let i = 0; i < tokens.length; i += 2) {
        yield { delta: tokens.slice(i, i + 2).join('') };
      }
      yield { delta: '', done: true, finishReason: response.finishReason };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
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
            yield { delta: '', done: true, finishReason: 'stop' };
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || '';
            const finish = json?.choices?.[0]?.finish_reason;
            if (delta) yield { delta };
            if (finish) yield { delta: '', done: true, finishReason: finish };
          } catch {
            // تجاهل الأخطاء في تحليل الأسطر الجزئية
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { delta: '', done: true, finishReason: 'stop' };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.apiKey) {
      return { ok: false, message: 'مفتاح API مطلوب' };
    }
    try {
      const res = await this.chat({
        messages: [
          { role: 'user', content: 'اختبار: أجب بكلمة "OK" فقط' },
        ],
        maxTokens: 10,
      });
      return {
        ok: !!res.content,
        message: res.content
          ? `الاتصال ناجح (${this.model})`
          : 'استجابة فارغة',
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'فشل الاتصال بـ OpenAI',
      };
    }
  }
}
