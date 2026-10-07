// ===== DeepSeek Provider =====
// يوسّع OpenAIProvider لأن DeepSeek متوافق مع OpenAI API

import { OpenAIProvider } from './openai';
import type { ProviderId } from '../types';

export class DeepSeekProvider extends OpenAIProvider {
  id: ProviderId = 'deepseek';
  name = 'DeepSeek';

  constructor(opts: { apiKey?: string; model?: string; baseUrl?: string } = {}) {
    super({
      apiKey: opts.apiKey,
      model: opts.model || 'deepseek-chat',
      baseUrl: (opts.baseUrl || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    });
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
        message: err?.message || 'فشل الاتصال بـ DeepSeek',
      };
    }
  }
}
