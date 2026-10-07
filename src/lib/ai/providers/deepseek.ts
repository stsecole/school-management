// ===== مزود DeepSeek (متوافق مع OpenAI) =====
import { OpenAIProvider } from './openai';

export class DeepSeekProvider extends OpenAIProvider {
  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl || 'https://api.deepseek.com/v1',
      model: opts.model || 'deepseek-chat',
    });
    this.id = 'deepseek';
    this.name = 'DeepSeek';
  }
}
