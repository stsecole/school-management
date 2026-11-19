/**
 * طبقة الواتساب — WhatsApp Cloud API الرسمية (Meta)
 * كل الطرق القديمة (wa.me / CallMeBot / Green API) أُزيلت نهائياً.
 *
 * المطلوب من Meta:
 *  - حساب أعمال + تطبيق على developers.facebook.com مع منتج WhatsApp
 *  - Phone Number ID (معرّف رقم واتساب للأعمال)
 *  - Access Token دائم (من System User في Meta Business Settings بصلاحية whatsapp_business_messaging)
 */

import { db } from '@/lib/db';

// إصدار Graph API — ثابت ومستقر
const GRAPH_VERSION = 'v22.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type WhatsAppProvider = 'cloud-api';

export interface WhatsAppSettings {
  provider: WhatsAppProvider;
  // Meta Cloud API
  accessToken: string;      // توكن دائم من System User
  phoneNumberId: string;    // Phone Number ID
  wabaId: string;           // WhatsApp Business Account ID (اختياري)
  // عام
  senderName: string;
  defaultCountryCode: string; // "213" للجزائر
}

export const DEFAULT_SETTINGS: WhatsAppSettings = {
  provider: 'cloud-api',
  accessToken: '',
  phoneNumberId: '',
  wabaId: '',
  senderName: 'مدرسة السلامة',
  defaultCountryCode: '213',
};

/**
 * قراءة الإعدادات من قاعدة البيانات
 */
export async function getSettings(): Promise<WhatsAppSettings> {
  const rows = await db.whatsAppSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    provider: 'cloud-api',
    accessToken: map['access_token'] || '',
    phoneNumberId: map['phone_number_id'] || '',
    wabaId: map['waba_id'] || '',
    senderName: map['sender_name'] || 'مدرسة السلامة',
    defaultCountryCode: map['default_country_code'] || '213',
  };
}

/**
 * حفظ الإعدادات
 */
export async function saveSettings(settings: Partial<WhatsAppSettings>): Promise<void> {
  const entries: [string, string][] = [];
  if (settings.accessToken !== undefined) entries.push(['access_token', settings.accessToken]);
  if (settings.phoneNumberId !== undefined) entries.push(['phone_number_id', settings.phoneNumberId]);
  if (settings.wabaId !== undefined) entries.push(['waba_id', settings.wabaId]);
  if (settings.senderName !== undefined) entries.push(['sender_name', settings.senderName]);
  if (settings.defaultCountryCode !== undefined) entries.push(['default_country_code', settings.defaultCountryCode]);

  for (const [key, value] of entries) {
    await db.whatsAppSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

/**
 * تنظيف رقم الهاتف (تحويل للصيغة الدولية بدون +)
 * "0551234567" → "213551234567"
 * "+213551234567" → "213551234567"
 * "00213551234567" → "213551234567"
 */
export function normalizePhone(phone: string, countryCode = '213'): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  // إزالة + في البداية
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  // إزالة بادئة 00 الدولية (مثل 00213)
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  // تحويل 0XX إلى countryCode+XX
  if (cleaned.startsWith('0')) {
    cleaned = countryCode + cleaned.slice(1);
  }
  // إن لم يبدأ بـ countryCode، أضفه
  if (!cleaned.startsWith(countryCode) && cleaned.length <= 9) {
    cleaned = countryCode + cleaned;
  }
  return cleaned;
}

/**
 * ترجمة أخطاء Cloud API الشائعة إلى العربية مع الحل
 */
function cloudApiErrorHint(err: any): string {
  const code = Number(err?.code) || 0;
  const subcode = Number(err?.error_subcode) || 0;
  const type = String(err?.type || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();

  if (code === 190) {
    return 'التوكن (Access Token) غير صالح أو منتهي. الحل: من Meta Business Settings → Users → System Users، أنشئ توكن دائماً (نوع: permanent) بصلاحيات whatsapp_business_messaging و whatsapp_business_management، ثم حدّثه في الإعدادات.';
  }
  if (code === 131047 || subcode === 2494055 || message.includes('re-engagement')) {
    return 'لا يمكن إرسال رسالة نصية حرة خارج نافذة 24 ساعة. قاعدة Meta: المستلم يجب أن يرسل لك رسالة أولاً (أي رسالة) لفتح نافذة 24 ساعة، أو استخدم قالباً معتمداً من Meta (Template). الحل السريع: اطلب من أولياء الأمور حفظ رقم المدرسة وإرسال أي رسالة مثل "مرحبا" مرة واحدة.';
  }
  if (code === 131030 || message.includes('not a whatsapp') || message.includes('recipient phone number not in allowed list')) {
    return 'الرقم غير مسجل على واتساب أو ليس ضمن أرقام الاختبار المسموحة. إذا كنت في وضع التطوير (Development)، أضف أرقام المستلمين في: App Dashboard → WhatsApp → To (Recipient phone numbers). للإرسال لأي رقم يجب نشر التطبيق (App Review).';
  }
  if (code === 130429 || code === 80007 || message.includes('rate limit') || message.includes('throttl')) {
    return 'تم تجاوز حد الإرسال مؤقتاً (Rate Limit). الحل: قلّل عدد الرسائل في الدفعة الواحدة (الحد يعتمد على مستوى جودة الرقم)، أو انتظر دقيقة وأعد المحاولة.';
  }
  if (code === 100 || message.includes('phone_number_id') || message.includes('unsupported')) {
    return 'Phone Number ID غير صحيح أو طلب غير مدعوم. الحل: من App Dashboard → WhatsApp → API Setup، انسخ Phone number ID بالضبط والصقه في الإعدادات.';
  }
  if (code === 10 || type.includes('permission') || message.includes('permission')) {
    return 'التوكن لا يملك الصلاحيات الكافية. الحل: تأكد أن التوكن من System User (وليس توكن تطبيق مؤقت) ويملك صلاحية whatsapp_business_messaging.';
  }
  if (code === 131026 || message.includes('undeliverable')) {
    return 'الرسالة غير قابلة للتوصيل. تأكد من صحة رقم المستلم وأنه يستخدم واتساب فعلاً.';
  }
  if (message.includes('recipient') && (message.includes('invalid') || message.includes('malformed'))) {
    return 'رقم المستلم بصيغة خاطئة. يجب أن يكون بالصيغة الدولية الكاملة بدون + وبدون 0 في البداية (مثال: 213551234567).';
  }
  return '';
}

/**
 * إرسال رسالة نصية عبر WhatsApp Cloud API
 */
async function sendCloudApi(
  phone: string,
  message: string,
  settings: WhatsAppSettings
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const normalized = normalizePhone(phone, settings.defaultCountryCode);
  const url = `${GRAPH_URL}/${settings.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = data?.error || {};
      const hint = cloudApiErrorHint(err);
      const raw = `Meta Cloud API ${res.status}: ${err.message || JSON.stringify(data).slice(0, 150)} (code: ${err.code || '—'})`;
      return { ok: false, error: `${raw}${hint ? '\n🔧 الحل: ' + hint : ''}` };
    }

    const messageId = data?.messages?.[0]?.id;
    if (!messageId) {
      return { ok: false, error: 'استجابة غير متوقعة من Meta (بدون معرّف رسالة): ' + JSON.stringify(data).slice(0, 150) };
    }
    return { ok: true, messageId };
  } catch (e: any) {
    return { ok: false, error: 'تعذر الاتصال بخوادم Meta: ' + (e.message || '') };
  }
}

/**
 * اختبار إعدادات Cloud API — يجلب بيانات رقم واتساب للأعمال
 * يُستخدم من زر "اختبار الاتصال" في الإعدادات
 */
export async function testCloudApiSettings(
  settings?: WhatsAppSettings
): Promise<{ ok: boolean; message: string; phone?: string }> {
  const s = settings || (await getSettings());
  if (!s.accessToken || !s.phoneNumberId) {
    return {
      ok: false,
      message: 'الإعدادات ناقصة: أدخل Access Token و Phone Number ID ثم احفظ قبل الاختبار.',
    };
  }
  try {
    const res = await fetch(
      `${GRAPH_URL}/${s.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(s.accessToken)}`
    );
    const data = await res.json();
    if (!res.ok) {
      const err = data?.error || {};
      const hint = cloudApiErrorHint(err);
      return {
        ok: false,
        message: `فشل الاتصال بـ Meta (${res.status}): ${err.message || 'خطأ غير معروف'}${hint ? '\n🔧 الحل: ' + hint : ''}`,
      };
    }
    return {
      ok: true,
      message: `تم الاتصال بنجاح — الرقم: ${data.display_phone_number || '—'} (${data.verified_name || 'بدون اسم'}${data.quality_rating ? ' • جودة: ' + data.quality_rating : ''})`,
      phone: data.display_phone_number,
    };
  } catch (e: any) {
    return { ok: false, message: 'تعذر الاتصال بخوادم Meta: ' + (e.message || '') };
  }
}

/**
 * إرسال رسالة واتساب (الإعداد العام)
 * يُرجع: { ok, messageId?, error? }
 */
export async function sendMessage(
  phone: string,
  message: string,
  options?: { templateName?: string; sentBy?: string; recipientName?: string }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const settings = await getSettings();
  const recipientName = options?.recipientName || '';

  let status: string = 'failed';
  let errorMessage: string | null = null;
  let messageId: string | undefined;

  if (!settings.accessToken || !settings.phoneNumberId) {
    errorMessage = 'WhatsApp Cloud API غير مضبوط. الحل: افتح قسم الواتساب ← الإعدادات، أدخل Access Token و Phone Number ID من Meta، ثم احفظ.';
  } else {
    const result = await sendCloudApi(phone, message, settings);
    status = result.ok ? 'sent' : 'failed';
    errorMessage = result.error || null;
    messageId = result.messageId;
  }

  // سجّل الرسالة (ناجحة وفاشلة — لكي يظهر الفشل في السجل ويمكن تشخيصه من الواجهة)
  try {
    await db.whatsAppLog.create({
      data: {
        recipientName,
        recipientPhone: phone,
        message,
        templateName: options?.templateName || null,
        status,
        provider: 'cloud-api',
        errorMessage,
        sentBy: options?.sentBy || null,
      },
    });
  } catch (e) {
    console.error('Failed to log WhatsApp message:', e);
  }

  if (status === 'failed') {
    return { ok: false, error: errorMessage || 'فشل إرسال الرسالة' };
  }
  return { ok: true, messageId };
}

/**
 * استبدال المتغيرات في القالب
 * المتغيرات المتاحة: {name}, {amount}, {date}, {department}, {month}, {senderName}
 */
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * القوالب الافتراضية
 */
export const DEFAULT_TEMPLATES = [
  {
    name: 'تذكير قسط متأخر',
    type: 'installment_reminder',
    subject: 'تذكير بالقسط',
    body: 'السلام عليكم {name}،\n\nنذكّركم بأن القسط الشهري بقيمة {amount} دج مستحق الدفع.\n\nيرجى التوجّه إلى مصلحة المحاسبة لتسوية الوضعية.\n\nشكراً لتعاونكم.\n{senderName}',
    variables: '["name", "amount", "senderName"]',
  },
  {
    name: 'تنبيه غياب',
    type: 'attendance_alert',
    subject: 'تنبيه غياب',
    body: 'السلام عليكم،\n\nنُعلمكم بأن الطالب {name} كان غائباً اليوم {date}.\n\nيرجى التواصل مع الإدارة لمزيد من التفاصيل.\n\n{senderName}',
    variables: '["name", "date", "senderName"]',
  },
  {
    name: 'إعلان عام',
    type: 'announcement',
    subject: 'إعلان',
    body: 'السلام عليكم،\n\n{message}\n\n{senderName}',
    variables: '["message", "senderName"]',
  },
  {
    name: 'ترحيب بتسجيل جديد',
    type: 'registration',
    subject: 'ترحيب',
    body: 'مرحباً {name}،\n\nتم تسجيلكم بنجاح في {department}.\n\nنرحّب بكم في {senderName} ونتمنّى لكم مسيرة دراسية موفّقة.\n\nللاستفسار: {senderName}',
    variables: '["name", "department", "senderName"]',
  },
  {
    name: 'متابعة عميل محتمل',
    type: 'crm',
    subject: 'متابعة',
    body: 'السلام عليكم {name}،\n\nشكراً لاهتمامكم بدوراتنا التدريبية.\n\nنسعد بتواصلكم معنا للتفاصيل.\n\n{senderName}',
    variables: '["name", "senderName"]',
  },
];
