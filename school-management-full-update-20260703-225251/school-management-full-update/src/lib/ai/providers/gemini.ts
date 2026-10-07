// ===== Google Gemini Provider =====
// يستخدم REST API مع SSE streaming

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class GeminiProvider implements AIProvider {
  id: ProviderId = 'gemini';
  name = 'Google Gemini';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(opts: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  } = {}) {
    this.apiKey = opts.apiKey || '';
    this.baseUrl = (opts.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    this.model = opts.model || 'gemini-1.5-flash';
  }

  private toGeminiContents(messages: { role: string; content: string }[]) {
    // Gemini يستخدم "user" و "model" فقط
    return messages
      .filter((m) => m.role !== 'system' || true)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const body: any = {
      contents: this.toGeminiContents(
        req.messages.filter((m) => m.role !== 'system')
      ),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    const url = `${this.baseUrl}/models/${req.model || this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Gemini error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const content =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || '')
        .join('') || '';
    return {
      content,
      role: 'assistant',
      model: this.model,
      tokensUsed: data?.usageMetadata?.totalTokenCount,
      finishReason: data?.candidates?.[0]?.finishReason || 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const systemMsg = req.messages.find((m) => m.role === 'system');
    const body: any = {
      contents: this.toGeminiContents(
        req.messages.filter((m) => m.role !== 'system')
      ),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    const url = `${this.baseUrl}/models/${req.model || this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      // ارجع إلى non-streaming
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
            const delta =
              json?.candidates?.[0]?.content?.parts
                ?.map((p: any) => p.text || '')
                .join('') || '';
            const finish = json?.candidates?.[0]?.finishReason;
            if (delta) yield { delta };
            if (finish) yield { delta: '', done: true, finishReason: finish };
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
        message: err?.message || 'فشل الاتصال بـ Gemini',
      };
    }
  }
}
