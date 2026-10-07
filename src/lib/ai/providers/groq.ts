import { OpenAIProvider } from './openai';

export class GroqProvider extends OpenAIProvider {
  constructor(opts: { apiKey: string; baseUrl?: string; model?: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl || 'https://api.groq.com/openai/v1',
      model: opts.model || 'llama-3.1-8b-instant',
    });
  }
}