// ===== مزود Z.AI (المزود الافتراضي - لا يحتاج مفتاح API) =====
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

  private async getZai() {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    return await ZAI.create();
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const model = req.model || 'glm-4.6';
    try {
      const zai = await this.getZai();
      const messages = req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await (zai as any).chat.completions.create({
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
      });
      const content =
        res.choices?.[0]?.message?.content ??
        res.choices?.[0]?.delta?.content ??
        '';
      return {
        content: typeof content === 'string' ? content : String(content ?? ''),
        model,
        provider: 'zai',
        tokensUsed: res.usage?.total_tokens,
        durationMs: Date.now() - start,
        finishReason: res.choices?.[0]?.finish_reason,
      };
    } catch (err: any) {
      return {
        content: `⚠️ تعذر الاتصال بـ Z.AI: ${err?.message || 'خطأ غير معروف'}`,
        model,
        provider: 'zai',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * تدفق المحادثة - نستخدم استدعاء غير متدفق ثم نُرسل النتيجة كقطعة واحدة.
   * (ZAI SDK قد لا يدعم streaming بشكل موثوق)
   */
  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const res = await this.chat(req);
    if (res.content) {
      // تقسيم النص إلى فقرات لمحاكاة التدفق
      const chunks = res.content.match(/.{1,80}(\s|$)|.+/g) || [res.content];
      for (const chunk of chunks) {
        yield { delta: chunk, provider: 'zai' };
      }
    }
    yield {
      delta: '',
      done: true,
      provider: 'zai',
      tokensUsed: res.tokensUsed,
      finishReason: res.finishReason,
    };
  }

  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const start = Date.now();
    try {
      const res = await this.chat({
        messages: [{ role: 'user', content: 'مرحبا' }],
        maxTokens: 16,
      });
      const latencyMs = Date.now() - start;
      if (res.content && !res.content.startsWith('⚠️')) {
        return {
          ok: true,
          message: `تم الاتصال بنجاح بـ Z.AI (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return { ok: false, message: res.content, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        message: `فشل الاتصال: ${err?.message || 'خطأ'}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
