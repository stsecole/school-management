// ===== Pollinations Provider =====
// مزود مجاني تماماً، بدون مفتاح API، يعمل من أي مكان
// يستخدم https://text.pollinations.ai

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class PollinationsProvider implements AIProvider {
  id: ProviderId = 'local'; // نعيد استخدام id 'local' لكنه يعمل كـ pollinations
  name = 'Pollinations (مجاني)';
  private model: string;

  constructor(opts: { model?: string } = {}) {
    this.model = opts.model || 'openai';
  }

  /**
   * يحوّل رسائل chat إلى prompt نصي واحد لـ Pollinations
   */
  private buildPrompt(messages: { role: string; content: string }[]): string {
    return messages
      .map((m) => {
        if (m.role === 'system') return `[التعليمات]: ${m.content}`;
        if (m.role === 'assistant') return `[المساعد]: ${m.content}`;
        return `[المستخدم]: ${m.content}`;
      })
      .join('\n\n') + '\n\n[المساعد]:';
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const prompt = this.buildPrompt(req.messages);
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
    });

    if (!res.ok) {
      throw new Error(`Pollinations error ${res.status}: ${await res.text()}`);
    }

    const content = (await res.text()).trim();
    return {
      content,
      role: 'assistant',
      model: 'pollinations',
      tokensUsed: Math.ceil(content.length / 4),
      finishReason: 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const response = await this.chat(req);
    const text = response.content || '';
    // قسّم النص إلى كلمات لمحاكاة streaming
    const tokens = text.match(/\S+\s*/g) || [text];
    for (let i = 0; i < tokens.length; i += 2) {
      yield { delta: tokens.slice(i, i + 2).join('') };
      await new Promise((r) => setTimeout(r, 10));
    }
    yield { delta: '', done: true, finishReason: 'stop' };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://text.pollinations.ai/ping', {
        method: 'GET',
      });
      if (res.ok) {
        return { ok: true, message: 'الاتصال ناجح مع Pollinations' };
      }
      return { ok: false, message: `Pollinations status: ${res.status}` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'فشل الاتصال' };
    }
  }
}
