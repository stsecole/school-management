// ===== مزود Google Gemini (REST API مع Streaming) =====
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
    apiKey: string;
    baseUrl?: string;
    model?: string;
  }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (
      opts.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');
    this.model = opts.model || 'gemini-1.5-flash';
  }

  /** تحويل رسائل OpenAI إلى صيغة Gemini (contents + systemInstruction) */
  private toGemini(messages: { role: string; content: string }[]) {
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    return {
      systemInstruction: systemParts || undefined,
      contents,
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const model = req.model || this.model;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    const payload = {
      ...this.toGemini(req.messages),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content =
      data.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .join('') ?? '';
    return {
      content,
      model,
      provider: 'gemini',
      tokensUsed: data.usageMetadata?.totalTokenCount,
      durationMs: Date.now() - start,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const model = req.model || this.model;
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    const payload = {
      ...this.toGemini(req.messages),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      const text = await res.text();
      yield { delta: '', done: true, error: `Gemini ${res.status}: ${text}` };
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
          const delta =
            json.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text)
              .join('') ?? '';
          if (delta) yield { delta, provider: 'gemini' };
        } catch {
          // ignore
        }
      }
    }
    yield { delta: '', done: true, provider: 'gemini' };
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
        message: `تم الاتصال بنجاح بـ Gemini`,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const msg = err?.message || 'خطأ';
      let userMsg = msg;
      // Check for country restriction
      if (msg.includes('403') || msg.includes('forbidden') || msg.includes('not supported')) {
        userMsg = 'Gemini محظور في منطقتك (الجزائر). استخدم DeepSeek بدلاً من ذلك — احصل على مفتاح من https://platform.deepseek.com/api_keys';
      }
      return {
        ok: false,
        message: `فشل: ${userMsg}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
