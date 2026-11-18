// ===== الموديلات الافتراضية الحالية للمزودين + الإصلاح التلقائي للموديلات الموقوفة =====
// الخلفية: كان التطبيق يستخدم موديلات افتراضية توقفها المزودون:
//  - gemini-1.5-flash: توقف نهائياً في 24 سبتمبر 2025 (البديل الرسمي: gemini-2.0-flash)
//  - llama-3.1-8b-instant على Groq: أُعلن إيقافه في 17 يونيو 2026 (البديل: openai/gpt-oss-20b)
//  - llama-3.3-70b-versatile على Groq: أُوقف نهائياً في 16 أغسطس 2026 (البديل الرسمي: openai/gpt-oss-120b)
// أي نسخة قديمة من هذه الموديلات محفوظة في قاعدة البيانات تُترجم تلقائياً عبر fixModel()

export const CURRENT_DEFAULT_MODELS: Record<string, string> = {
  groq: 'openai/gpt-oss-120b',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
};

/** خرائط ترجمة الموديلات الموقوفة إلى البديل الحالي */
const MODEL_FIX_MAP: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-2.0-flash',
  'gemini-1.5-flash-8b': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-2.0-flash',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
};

/**
 * تصحيح الموديل المحفوظ إن كان موقوفاً من المزود.
 * يعيد الموديل نفسه إن كان سليماً، والبديل الحديث إن كان موقوفاً.
 */
export function fixModel(provider: string, model: string): string {
  const fixed = MODEL_FIX_MAP[model];
  if (fixed) return fixed;
  // موديل فارغ → الافتراضي الحالي للمزود
  if (!model || !model.trim()) return CURRENT_DEFAULT_MODELS[provider] || CURRENT_DEFAULT_MODELS.groq;
  return model;
}

/** نصائح عربية قابلة للتنفيذ حسب رمز خطأ المزود */
export function providerErrorHint(message: string): string {
  const m = message || '';
  if (m.includes('401') || m.toLowerCase().includes('unauthorized') || m.toLowerCase().includes('invalid api key')) {
    return 'المفتاح (API Key) غير صحيح أو منتهي. الحل: أنشئ مفتاحاً جديداً من موقع المزود ثم فعّل المزود من جديد من صفحة "إعدادات AI".';
  }
  if (m.includes('404') || m.toLowerCase().includes('model_not_found') || m.toLowerCase().includes('not found')) {
    return 'الموديل غير متوفر (قديم وموقوف). الحل: أعد تفعيل المزود من صفحة "إعدادات AI" — سيتم حفظ موديل حديث تلقائياً.';
  }
  if (m.includes('429') || m.toLowerCase().includes('rate limit') || m.toLowerCase().includes('quota')) {
    return 'تم تجاوز حد الاستخدام المجاني مؤقتاً. الحل: انتظر دقيقة وأعد المحاولة، أو استخدم مزوداً آخر (Groq مجاني وسريع).';
  }
  if (m.includes('Failed to fetch') || m.includes('fetch failed') || m.includes('network')) {
    return 'تعذر الاتصال بالإنترنت من الخادم. الحل: تحقق من اتصال الخادم بالشبكة وأعد المحاولة.';
  }
  return '';
}
