// ===== مزود محلي (Fallback دون اتصال بالإنترنت) =====
import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class LocalProvider implements AIProvider {
  id: ProviderId = 'local';
  name = 'محلي';

  /** ردود مبرمجة لأسئلة شائعة */
  private responses: { keywords: string[]; reply: string }[] = [
    {
      keywords: ['مرحبا', 'السلام', 'صباح', 'مساء', 'hello', 'hi', 'bonjour'],
      reply:
        'مرحباً بك! أنا المساعد الذكي المحلي. أعتذر، الاتصال بالخدمات السحابية غير متاح حالياً. يمكنك استخدام الإعدادات لتكوين مزود آخر.',
    },
    {
      keywords: ['طالب', 'students', 'عدد'],
      reply:
        'لعرض عدد الطلاب، يرجى الذهاب إلى قسم "الطلاب" في القائمة الجانبية. المساعد المحلي لا يمكنه الوصول إلى قاعدة البيانات مباشرة.',
    },
    {
      keywords: ['شكرا', 'thanks', 'merci'],
      reply: 'العفو! سعيد بمساعدتك.',
    },
  ];

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const lastMsg = req.messages[req.messages.length - 1]?.content || '';
    const lower = lastMsg.toLowerCase();
    let reply =
      '⚠️ الوضع المحلي مفعّل - لا يمكنني الوصول إلى نماذج الذكاء الاصطناعي عبر الإنترنت. يرجى تفعيل مزود (Z.AI، OpenAI، إلخ) من الإعدادات. سؤالك: ' +
      lastMsg.slice(0, 200);
    for (const r of this.responses) {
      if (r.keywords.some((k) => lower.includes(k.toLowerCase()))) {
        reply = r.reply;
        break;
      }
    }
    return {
      content: reply,
      model: 'local-fallback',
      provider: 'local',
      durationMs: Date.now() - start,
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const res = await this.chat(req);
    // محاكاة تدفق متقطع
    const words = res.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield { delta: (i === 0 ? '' : ' ') + words[i], provider: 'local' };
      await new Promise((r) => setTimeout(r, 20));
    }
    yield { delta: '', done: true, provider: 'local' };
  }

  async testConnection(): Promise<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  }> {
    return { ok: true, message: 'المزود المحلي جاهز دائماً', latencyMs: 0 };
  }
}
