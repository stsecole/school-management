// ===== Local Provider =====
// مزود احتياطي محلي يعمل دون اتصال بالإنترنت

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from '../types';

export class LocalProvider implements AIProvider {
  id: ProviderId = 'local';
  name = 'محلي (دون اتصال)';

  /**
   * مولّد إجابات بسيط يعتمد على كلمات مفتاحية.
   * ليس ذكاءً اصطناعياً حقيقياً، لكنه يوفر استجابة مفيدة عند فشل كل المزودات.
   */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const lastUserMsg = [...req.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const text = lastUserMsg?.content || '';
    const content = this.generateResponse(text);
    return {
      content,
      role: 'assistant',
      model: 'local-fallback',
      tokensUsed: Math.ceil(content.length / 4),
      finishReason: 'stop',
    };
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const response = await this.chat(req);
    const tokens = response.content.match(/\S+\s*/g) || [response.content];
    for (let i = 0; i < tokens.length; i += 2) {
      yield { delta: tokens.slice(i, i + 2).join('') };
      await new Promise((r) => setTimeout(r, 10));
    }
    yield { delta: '', done: true, finishReason: 'stop' };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'المزود المحلي جاهز دائماً' };
  }

  private generateResponse(input: string): string {
    const lower = input.toLowerCase();

    if (/(مرحبا|السلام|اهلا|أهلا|صباح|مساء|hello|hi|bonjour|salut)/i.test(input)) {
      return 'مرحباً! أنا المساعد المحلي للمؤسسة. يمكنني مساعدتك في الاستعلام عن الطلاب والمدفوعات والحضور والتقارير. اكتب سؤالك بالعربية. \n\n> ملاحظة: المزود المحلي لا يدعم الذكاء الاصطناعي الكامل. للحصول على إجابات أفضل، فعّل أحد المزودات من الإعدادات.';
    }

    if (/(كم|عدد|إحصائ|stats?|count)/i.test(input)) {
      return 'للحصول على إحصائيات دقيقة، استخدم الأوامر التالية:\n- "كم عدد الطلاب؟"\n- "عدد الأساتذة"\n- "الحضور اليوم"\n- "المداخيل هذا الأسبوع"\n\nسيقوم النظام بتشغيل الأداة المناسبة وجلب البيانات الفعلية من قاعدة البيانات.';
    }

    if (/(طالب|students?|étudiant)/i.test(input)) {
      return 'يمكنني مساعدتك في الاستعلام عن الطلاب. جرّب:\n- "اعرض الطلاب المتأخرين في الدفع"\n- "الطلاب الجدد هذا الشهر"\n- "توزيع الطلاب حسب القسم"';
    }

    if (/(دفع|مال|مداخيل|finance|payment|argent)/i.test(input)) {
      return 'للاستعلامات المالية جرّب:\n- "المداخيل هذا الأسبوع"\n- "الأقساط المتأخرة"\n- "ربح الشهر"\n\nملاحظة: البيانات المالية تتطلب صلاحيات مدير.';
    }

    if (/(تقرير|report|rapport)/i.test(input)) {
      return 'لإنشاء تقارير:\n- "تقرير الحضور"\n- "تقرير الأساتذة"\n- "تقرير التسجيلات"\n- "مقارنة بين الشهور"';
    }

    return `لم أفهم سؤالك تماماً. يمكنني مساعدتك في:\n\n1. **الإحصائيات**: "كم عدد الطلاب؟"، "الحضور اليوم"\n2. **المالية**: "المداخيل هذا الأسبوع"، "الأقساط المتأخرة"\n3. **التقارير**: "تقرير الحضور"، "مقارنة بين الشهور"\n4. **الإجراءات**: "أنشئ تخصصاً"، "أرسل إشعاراً"\n\n> أنت تعمل مع المزود المحلي. للحصول على إجابات أكثر ذكاءً، فعّل Z.AI أو مزود آخر من الإعدادات.`;
  }
}
