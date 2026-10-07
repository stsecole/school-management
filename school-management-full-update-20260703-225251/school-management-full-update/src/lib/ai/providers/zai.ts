// ===== Z.AI Provider =====
// يستخدم z-ai-web-dev-sdk المُثبّت مسبقاً

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class ZaiProvider implements AIProvider {
  id: ProviderId = 'zai';
  name = 'Z.AI';
  private model: string;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    this.model = opts.model || 'glm-4.6';
  }

  private async getClient() {
    // استيراد ديناميكي لتجنب تحميل SDK على جانب العميل
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    return await ZAI.create();
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const zai = await this.getClient();
    const completion = await zai.chat.completions.create({
      model: this.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: false,
    });
    const content = completion?.choices?.[0]?.message?.content || '';
    return {
      content,
      role: 'assistant',
      model: this.model,
      tokensUsed:
        completion?.usage?.total_tokens ||
        completion?.usage?.completion_tokens ||
        Math.ceil(content.length / 4),
      finishReason: completion?.choices?.[0]?.finish_reason || 'stop',
    };
  }

  /**
   * z-ai-web-dev-sdk لا يدعم SSE streaming بشكل مباشر في كل البيئات،
   * لذلك ننفذ streaming عبر استدعاء غير متصل ثم تقسيم الإجابة إلى أجزاء.
   */
  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const response = await this.chat(req);
    const text = response.content || '';
    // قسّم النص إلى كلمات/أجزاء صغيرة لمحاكاة streaming
    const tokens = text.match(/\S+\s*/g) || [text];
    const chunkSize = 2; // كلمتان في كل chunk
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const slice = tokens.slice(i, i + chunkSize).join('');
      yield { delta: slice };
      // تأخير بسيط لإعطاء إحساس streaming
      await new Promise((r) => setTimeout(r, 15));
    }
    yield { delta: '', done: true, finishReason: response.finishReason };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await this.chat({
        messages: [
          { role: 'system', content: 'أجب بكلمة واحدة فقط: "مرحبا".' },
          { role: 'user', content: 'اختبار الاتصال' },
        ],
        maxTokens: 20,
        temperature: 0,
      });
      if (res.content && res.content.length > 0) {
        return { ok: true, message: `الاتصال ناجح (${this.model})` };
      }
      return { ok: false, message: 'استجابة فارغة من Z.AI' };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'فشل الاتصال بـ Z.AI',
      };
    }
  }
}
