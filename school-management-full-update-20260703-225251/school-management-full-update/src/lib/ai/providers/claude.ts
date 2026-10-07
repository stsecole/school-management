// ===== Anthropic Claude Provider =====
// يستخدم Messages API مع SSE streaming

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class ClaudeProvider implements AIProvider {
  id: ProviderId = 'claude';
  name = 'Anthropic Claude';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(opts: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  } = {}) {
    this.apiKey = opts.apiKey || '';
    this.baseUrl = (opts.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.model = opts.model || 'claude-3-5-sonnet-20241022';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  private buildBody(req: ChatRequest, stream = false) {
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const msgs = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    return {
      model: req.model || this.model,
      system: systemMsg?.content || undefined,
      messages: msgs,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      stream,
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(this.buildBody(req, false)),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Claude error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const content =
      data?.content?.map((c: any) => c.text || '').join('') || '';
    return {
      content,
      role: 'assistant',
      model: data?.model || this.model,
      tokensUsed: data?.usage?.input_tokens + data?.usage?.output_tokens,
      finishReason: data?.stop_reason || 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { ...this.getHeaders(), Accept: 'text/event-stream' },
      body: JSON.stringify(this.buildBody(req, true)),
    });
    if (!res.ok || !res.body) {
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
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          const lines = evt.split('\n');
          let dataLine = '';
          for (const l of lines) {
            if (l.startsWith('data:')) {
              dataLine += l.slice(5).trim();
            }
          }
          if (!dataLine) continue;
          try {
            const json = JSON.parse(dataLine);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              yield { delta: json.delta.text };
            } else if (json.type === 'message_stop') {
              yield { delta: '', done: true, finishReason: 'stop' };
              return;
            }
          } catch {
            // تجاهل
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
        messages: [{ role: 'user', content: 'اختبار: أجب بكلمة "OK" فقط' }],
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
        message: err?.message || 'فشل الاتصال بـ Claude',
      };
    }
  }
}
