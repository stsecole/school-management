// ===== مزود Anthropic Claude (Messages API مع Streaming) =====
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
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.model = opts.model || 'claude-3-5-sonnet-20241022';
  }

  /** تحويل الرسائل إلى صيغة Claude: system منفصل + messages بدون system */
  private toClaude(messages: { role: string; content: string }[]) {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const convo = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    return { system: system || undefined, messages: convo };
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const model = req.model || this.model;
    const url = `${this.baseUrl}/messages`;
    const payload = {
      model,
      ...this.toClaude(req.messages),
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      stream: false,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content =
      data.content?.map((c: any) => c.text).join('') ?? '';
    return {
      content,
      model,
      provider: 'claude',
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      durationMs: Date.now() - start,
      finishReason: data.stop_reason,
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const model = req.model || this.model;
    const url = `${this.baseUrl}/messages`;
    const payload = {
      model,
      ...this.toClaude(req.messages),
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      stream: true,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      yield { delta: '', done: true, error: `Claude ${res.status}: ${text}` };
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
        if (!trimmed.startsWith('data:')) continue;
        const payloadStr = trimmed.slice(5).trim();
        if (!payloadStr) continue;
        try {
          const json = JSON.parse(payloadStr);
          if (json.type === 'content_block_delta') {
            const delta = json.delta?.text ?? '';
            if (delta) yield { delta, provider: 'claude' };
          } else if (json.type === 'message_stop') {
            yield { delta: '', done: true, provider: 'claude' };
            return;
          }
        } catch {
          // ignore
        }
      }
    }
    yield { delta: '', done: true, provider: 'claude' };
  }

  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const start = Date.now();
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 8,
      });
      return {
        ok: true,
        message: `تم الاتصال بنجاح بـ Claude`,
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
