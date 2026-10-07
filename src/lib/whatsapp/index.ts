/**
 * طبقة الواتساب — تدعم 3 طرق:
 * 1. wa.me links (مجاني، يدوي)
 * 2. CallMeBot API (مجاني، تلقائي)
 * 3. Green API (مجاني 200 رسالة/يوم، تلقائي)
 */

import { db } from '@/lib/db';

export type WhatsAppProvider = 'wame' | 'callmebot' | 'greenapi';

export interface WhatsAppSettings {
  provider: WhatsAppProvider;
  // CallMeBot
  callmebotApiKey: string;
  // Green API
  greenapiIdInstance: string;
  greenapiApiTokenInstance: string;
  // عام
  senderName: string;
  defaultCountryCode: string; // "213" للجزائر
}

export const DEFAULT_SETTINGS: WhatsAppSettings = {
  provider: 'wame',
  callmebotApiKey: '',
  greenapiIdInstance: '',
  greenapiApiTokenInstance: '',
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
    provider: (map['provider'] as WhatsAppProvider) || 'wame',
    callmebotApiKey: map['callmebot_apikey'] || '',
    greenapiIdInstance: map['greenapi_id_instance'] || '',
    greenapiApiTokenInstance: map['greenapi_api_token'] || '',
    senderName: map['sender_name'] || 'مدرسة السلامة',
    defaultCountryCode: map['default_country_code'] || '213',
  };
}

/**
 * حفظ الإعدادات
 */
export async function saveSettings(settings: Partial<WhatsAppSettings>): Promise<void> {
  const entries: [string, string][] = [];
  if (settings.provider !== undefined) entries.push(['provider', settings.provider]);
  if (settings.callmebotApiKey !== undefined) entries.push(['callmebot_apikey', settings.callmebotApiKey]);
  if (settings.greenapiIdInstance !== undefined) entries.push(['greenapi_id_instance', settings.greenapiIdInstance]);
  if (settings.greenapiApiTokenInstance !== undefined) entries.push(['greenapi_api_token', settings.greenapiApiTokenInstance]);
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
 * تنظيف رقم الهاتف (تحويل للصيغة الدولية)
 * "0551234567" → "213551234567"
 * "+213551234567" → "213551234567"
 */
export function normalizePhone(phone: string, countryCode = '213'): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  // إزالة + في البداية
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
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
 * توليد رابط wa.me
 */
export function generateWaMeLink(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * إرسال عبر CallMeBot
 */
async function sendCallMeBot(phone: string, message: string, apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizePhone(phone);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${normalized}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    if (res.ok && !text.toLowerCase().includes('error')) {
      return { ok: true };
    }
    return { ok: false, error: text.slice(0, 200) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * إرسال عبر Green API
 */
async function sendGreenApi(
  phone: string,
  message: string,
  idInstance: string,
  apiTokenInstance: string
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizePhone(phone);
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: `${normalized}@c.us`,
        message: message,
      }),
    });
    const data = await res.json();
    if (res.ok && data.idMessage) {
      return { ok: true };
    }
    return { ok: false, error: data.description || JSON.stringify(data) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * إرسال رسالة واتساب (الإعداد العام)
 * يُرجع: { ok, link?, error? }
 * - إن كان wa.me: ok=true, link=الرابط
 * - إن كان callmebot/greenapi: ok=true/false, لا link
 */
export async function sendMessage(
  phone: string,
  message: string,
  options?: { templateName?: string; sentBy?: string; recipientName?: string }
): Promise<{ ok: boolean; link?: string; error?: string }> {
  const settings = await getSettings();
  const recipientName = options?.recipientName || '';

  let status: string = 'failed';
  let errorMessage: string | null = null;
  let link: string | undefined;

  if (settings.provider === 'wame') {
    link = generateWaMeLink(phone, message);
    status = 'link_generated';
  } else if (settings.provider === 'callmebot') {
    if (!settings.callmebotApiKey) {
      return { ok: false, error: 'CallMeBot API Key غير مضبوط في الإعدادات' };
    }
    const result = await sendCallMeBot(phone, message, settings.callmebotApiKey);
    status = result.ok ? 'sent' : 'failed';
    errorMessage = result.error || null;
    if (!result.ok) return { ok: false, error: result.error };
  } else if (settings.provider === 'greenapi') {
    if (!settings.greenapiIdInstance || !settings.greenapiApiTokenInstance) {
      return { ok: false, error: 'Green API credentials غير مضبوطة في الإعدادات' };
    }
    const result = await sendGreenApi(
      phone,
      message,
      settings.greenapiIdInstance,
      settings.greenapiApiTokenInstance
    );
    status = result.ok ? 'sent' : 'failed';
    errorMessage = result.error || null;
    if (!result.ok) return { ok: false, error: result.error };
  }

  // سجّل الرسالة
  try {
    await db.whatsAppLog.create({
      data: {
        recipientName,
        recipientPhone: phone,
        message,
        templateName: options?.templateName || null,
        status,
        provider: settings.provider,
        errorMessage,
        sentBy: options?.sentBy || null,
      },
    });
  } catch (e) {
    console.error('Failed to log WhatsApp message:', e);
  }

  return { ok: true, link };
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
