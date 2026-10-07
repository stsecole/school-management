// ===== Pollinations Provider =====
import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class PollinationsProvider implements AIProvider {
  id: ProviderId = 'local';
  name = 'Pollinations';
  private model: string;

  constructor(opts: { model?: string } = {}) {
    this.model = opts.model || 'openai';
  }

  private buildPrompt(messages: { role: string; content: string }[]): string {
    return messages
      .map((m) => {
        if (m.role === 'system') return "[التعليمات]: " + m.content;
        if (m.role === 'assistant') return "[المساعد]: " + m.content;
        return "[المستخدم]: " + m.content;
      })
      .join("\n\n") + "\n\n[المساعد]:";
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const prompt = this.buildPrompt(req.messages);
    const url = "https://text.pollinations.ai/" + encodeURIComponent(prompt);
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'text/plain' } });
    if (!res.ok) {
      throw new Error("Pollinations error " + res.status);
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
    const tokens = text.match(/\S+\s*/g) || [text];
    for (let i = 0; i < tokens.length; i += 2) {
      yield { delta: tokens.slice(i, i + 2).join('') };
      await new Promise((r) => setTimeout(r, 10));
    }
    yield { delta: '', done: true, finishReason: 'stop' };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://text.pollinations.ai/ping', { method: 'GET' });
      if (res.ok) return { ok: true, message: 'OK' };
      return { ok: false, message: 'Error ' + res.status };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed' };
    }
  }
}