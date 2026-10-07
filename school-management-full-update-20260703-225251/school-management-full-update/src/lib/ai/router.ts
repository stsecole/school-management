// ===== موجّه المساعد الذكي =====
// buildSystemPrompt, detectIntent (AR/FR/EN), extractActionBlock

import type { DataContext } from './context';
import { buildInstitutionSummary } from './context';
import { ACTIONS } from './tools/actions';
import { QUERY_TOOLS } from './tools/queries';

/**
 * بناء تعليمات النظام الشاملة
 */
export async function buildSystemPrompt(ctx: DataContext): Promise<string> {
  const summary = await buildInstitutionSummary(ctx);
  const queryList = QUERY_TOOLS.map(
    (q) => `- ${q.name}: ${q.description}`
  ).join('\n');
  const actionList = ACTIONS.map(
    (a) =>
      `- ${a.action} (${a.roles.join('/')}): ${a.description} — معاملات: ${a.requiredParams.join(', ')}`
  ).join('\n');

  return `أنت "مساعد مدرسة السلامة"، مساعد ذكي متخصص في إدارة المؤسسات التعليمية.

${summary}

=== قدراتك ===
يمكنك الإجابة عن الأسئلة وتنفيذ استعلامات وإجراءات على بيانات المؤسسة.

**أدوات الاستعلام المتاحة** (يجب أن تطلبها بصيغة JSON في الإجابة):
${queryList}

**الإجراءات المتاحة** (تتطلب تأكيد المستخدم):
${actionList}

=== قواعد الإجابة ===
1. أجب دائماً باللغة العربية الفصحى مع إمكانية استخدام لهجة جزائرية خفيفة عند الحاجة.
2. كن مختصراً ودقيقاً. استخدم Markdown للتنسيق (عناوين، قوائم، جداول، **bold**).
3. عند الحاجة لبيانات من قاعدة البيانات، أضف في نهاية إجابتك سطراً بالصيغة التالية:
   \`\`\`tool
   {"tool": "اسم_الأداة", "params": {...}}
   \`\`\`
4. عند اقتراح إجراء يحتاج تنفيذه، أضف:
   \`\`\`action
   {"action": "اسم_الإجراء", "params": {...}}
   \`\`\`
   مع وصف واضح لما سيحدث. لا تنفّذ الإجراء بنفسك، فقط اقترحه.
5. احترم الصلاحيات: المعلومات المالية متاحة للمدير فقط. لا تقترح إجراءات لا يملك المستخدم صلاحيتها.
6. للبيانات التي تحتاج تصوراً (رسوم بيانية/جداول)، اطلب الأداة المناسبة وسيقوم النظام بعرضها.
7. إذا كان السؤال عاماً أو محادثة، أجب مباشرة دون طلب أداة.

=== أمثلة ===
س: "كم عدد الطلاب؟"
ج: سأستعلم عن عدد الطلاب.
\`\`\`tool
{"tool": "countStudents", "params": {}}
\`\`\`

س: "أرسل تذكيراً للطلاب المتأخرين"
ج: يمكنني إنشاء إشعار تذكير. هل تؤكد؟
\`\`\`action
{"action": "create_notification", "params": {"message": "تذكير: يرجى تسوية الأقساط المتأخرة", "target": "late_payers"}}
\`\`\`

أنت الآن جاهز. ساعد المستخدم بكفاءة واحترام.`;
}

export type Intent =
  | 'query'
  | 'action'
  | 'chat'
  | 'document'
  | 'export';

/**
 * كشف نية المستخدم بناءً على النص (يدعم AR/FR/EN)
 */
export function detectIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  // كلمات الاستعلام (AR/FR/EN)
  const queryPatterns = [
    /^(كم|عدد|إحصائ|احصائ|show|count|how many|combien|nombre|liste|عرض|اعرض|احسب|ما هي|ماهي)/i,
    /(الطلاب|الأساتذة|الأقسام|الحضور|المداخيل|الأرباح|الأقساط|التسجيلات|التقارير|students?|teachers?|departments?|attendance|revenue|profit|installments?|registrations?|reports?)/i,
  ];
  for (const re of queryPatterns) {
    if (re.test(lower)) return 'query';
  }

  // كلمات الإجراءات
  const actionPatterns = [
    /^(أنشئ|أضف|احذف|عدّل|أرسل|انشئ|اضف|احذف|ارسل|create|add|delete|remove|send|notify|créer|ajouter|supprimer|envoyer)/i,
    /(تخصص جديد|قاعة|حساب|مستخدم|إشعار|notification|spécialisation|salle|compte)/i,
  ];
  for (const re of actionPatterns) {
    if (re.test(lower)) return 'action';
  }

  // كلمات المستندات
  if (
    /(شهادة|استدعاء|عقد|محضر|مراسلة|إعلان|certificate|summons|contract|minutes|announcement|attestation|convocation|contrat|annonce)/i.test(
      lower
    )
  ) {
    return 'document';
  }

  // كلمات التصدير
  if (/(صدّر|تصدير|export|exporter|pdf|excel|ملف)/i.test(lower)) {
    return 'export';
  }

  return 'chat';
}

/**
 * استخراج كتلة tool من نص الإجابة
 * ```tool
 * {"tool": "name", "params": {...}}
 * ```
 */
export function extractToolBlock(text: string): {
  tool?: string;
  params?: any;
} | null {
  const m = text.match(/```tool\s*\n([\s\S]*?)```/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/**
 * استخراج كتلة action من نص الإجابة
 */
export function extractActionBlock(text: string): {
  action: string;
  params: any;
  description?: string;
} | null {
  const m = text.match(/```action\s*\n([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1].trim());
    if (!parsed.action) return null;
    return {
      action: parsed.action,
      params: parsed.params || {},
      description: parsed.description,
    };
  } catch {
    return null;
  }
}

/**
 * إزالة كتل tool/action من النص قبل العرض
 */
export function stripToolBlocks(text: string): string {
  return text
    .replace(/```tool\s*\n[\s\S]*?```/gi, '')
    .replace(/```action\s*\n[\s\S]*?```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
