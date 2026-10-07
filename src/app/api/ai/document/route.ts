// ===== POST /api/ai/document =====
// { type, context } → generate certificate/summons/contract/minutes/correspondence/email/announcement

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chat } from '@/lib/ai/provider';

const DOCUMENT_TYPES: Record<
  string,
  { label: string; prompt: string; placeholders: string[] }
> = {
  certificate: {
    label: 'شهادة',
    prompt:
      'اكتب شهادة مدرسية رسمية (شهادة تسجيل / شهادة نجاح) باللغة العربية، بصياغة قانونية ومختومة. ضع حقول مثل: اسم المؤسسة، اسم الطالب، تاريخ الميلاد، السنة الدراسية، التاريخ.',
    placeholders: ['studentName', 'type', 'date'],
  },
  summons: {
    label: 'استدعاء',
    prompt:
      'اكتب استدعاء رسمي لولي أمر الطالب أو الطالب للحضور إلى الإدارة. اذكر السبب والتاريخ والوقت المطلوب.',
    placeholders: ['studentName', 'reason', 'date', 'time'],
  },
  contract: {
    label: 'عقد',
    prompt:
      'اكتب عقد عمل/تدريس بين المؤسسة وأستاذ. اذكر: الأطراف، المدة، الراتب، المهام، التوقيع.',
    placeholders: ['teacherName', 'subject', 'startDate', 'endDate', 'salary'],
  },
  minutes: {
    label: 'محضر اجتماع',
    prompt:
      'اكتب محضر اجتماع رسمي باللغة العربية. اذكر: التاريخ، الحضور، جدول الأعمال، المناقشات، القرارات.',
    placeholders: ['date', 'attendees', 'agenda', 'decisions'],
  },
  correspondence: {
    label: 'مراسلة إدارية',
    prompt: 'اكتب مراسلة إدارية رسمية (خطاب) موجهة إلى جهة معينة.',
    placeholders: ['recipient', 'subject', 'body'],
  },
  email: {
    label: 'بريد إلكتروني',
    prompt: 'اكتب بريداً إلكترونياً احترافياً باللغة العربية.',
    placeholders: ['to', 'subject', 'body'],
  },
  announcement: {
    label: 'إعلان',
    prompt: 'اكتب إعلاناً رسمياً للطلاب وأولياء الأمور. اجعله جذاباً وواضحاً.',
    placeholders: ['title', 'body', 'date'],
  },
};

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { type, context } = body;
  if (!type || !DOCUMENT_TYPES[type]) {
    return NextResponse.json(
      { error: 'نوع مستند غير صالح. الأنواع المدعومة: ' + Object.keys(DOCUMENT_TYPES).join(', ') },
      { status: 400 }
    );
  }
  const def = DOCUMENT_TYPES[type];
  const ctxStr = context
    ? `\n\n=== معلومات السياق المقدمة ===\n${JSON.stringify(context, null, 2)}`
    : '';

  const { response } = await chat({
    messages: [
      {
        role: 'system',
        content: `أنت كاتب محترف للمستندات الإدارية العربية في المؤسسات التعليمية. اكتب المستند بصيغة Markdown نظيفة. المستخدم: ${user.name}. التاريخ الحالي: ${new Date().toISOString().split('T')[0]}.`,
      },
      {
        role: 'user',
        content: `${def.prompt}${ctxStr}\n\nاكتب المستند الآن:`,
      },
    ],
    temperature: 0.6,
    maxTokens: 2500,
  });

  return NextResponse.json({
    ok: true,
    type,
    label: def.label,
    content: response.content,
    tokensUsed: response.tokensUsed,
  });
}
