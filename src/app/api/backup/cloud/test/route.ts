// ===== POST /api/backup/cloud/test =====
// اختبار إعدادات المزود السحابي قبل الحفظ/المزامنة
// Telegram: تحقق من التوكن عبر getMe ثم أرسل رسالة اختبار عبر sendMessage
// Webhook: POST بسيط للتحقق من الاستجابة
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ترجمة أخطاء Telegram API الشائعة إلى رسائل عربية مع خطوات الحل */
function telegramErrorHint(status: number, description: string): string {
  const d = description || '';
  if (status === 401 || d.includes('Unauthorized')) {
    return 'التوكن غير صحيح. تأكد من نسخ التوكن كاملاً من @BotFather (بالصيغة 123456:ABC-xxx) بدون مسافات زائدة في البداية أو النهاية.';
  }
  if (d.includes('chat not found')) {
    return 'لم يتم العثور على المحادثة. الحل: (1) افتح البوت في Telegram واضغط Start وأرسل أي رسالة أولاً. (2) إذا كان chat_id يبدأ بـ -100 (قناة/مجموعة خارقة) أو @اسم قناة، تأكد من إضافة البوت كمشرف (Admin) فيها. (3) اجلب chat_id الصحيح من رابط getUpdates بعد مراسلة البوت.';
  }
  if (d.includes('bot was blocked')) {
    return 'البوت محظور من قبل المستخدم. افتح البوت واضغط "إلغاء الحظر" ثم أرسل Start.';
  }
  if (d.includes('group chat was upgraded')) {
    return 'تم تحويل المجموعة إلى مجموعة خارقة (Supergroup). اجلب chat_id الجديد من getUpdates وحدّث الإعدادات.';
  }
  if (d.includes('not enough rights') || d.includes('CHAT_ADMIN_PRIVILEGES')) {
    return 'البوت لا يملك صلاحية إرسال الرسائل. أضف البوت كمشرف في القناة/المجموعة مع تفعيل صلاحية "إرسال الرسائل" (Post Messages).';
  }
  if (d.includes('chat_id is empty')) {
    return 'chat_id فارغ أو غير صالح. أدخل معرف المحادثة (رقم موجب للمحادثة الخاصة، سالب للمجموعة، أو @اسم القناة العامة).';
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json().catch(() => ({}));
    const provider = body.provider || 'telegram';

    if (provider === 'telegram') {
      // استخدام القيم المُرسلة، والرجوع للإعدادات المحفوظة إن كانت فارغة
      let token = String(body.token || '').trim();
      let chatId = String(body.chatId || '').trim();
      if (!token || !chatId) {
        const [tRow, cRow] = await Promise.all([
          db.setting.findUnique({ where: { key: 'cloud_backup_telegram_token' } }),
          db.setting.findUnique({ where: { key: 'cloud_backup_telegram_chat_id' } }),
        ]);
        if (!token) token = (tRow?.value || '').trim();
        if (!chatId) chatId = (cRow?.value || '').trim();
      }

      if (!token) {
        return NextResponse.json({ ok: false, error: 'التوكن فارغ. أنشئ بوتاً عبر @BotFather وانسخ التوكن في الحقل المخصص.' }, { status: 400 });
      }
      if (!chatId) {
        return NextResponse.json({ ok: false, error: 'chat_id فارغ. أرسل رسالة للبوت ثم افتح https://api.telegram.org/bot<TOKEN>/getUpdates وانسخ معرف المحادثة (chat.id).' }, { status: 400 });
      }

      // الخطوة 1: التحقق من التوكن عبر getMe
      let meRes: Response;
      try {
        meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'تعذر الوصول إلى Telegram API: ' + (e.message || '') + ' — تحقق من اتصال الخادم بالإنترنت.' }, { status: 502 });
      }
      const me = await meRes.json().catch(() => null);
      if (!me?.ok) {
        const desc = me?.description || `HTTP ${meRes.status}`;
        const hint = telegramErrorHint(meRes.status, desc);
        return NextResponse.json({ ok: false, error: `فشل التحقق من التوكن: ${desc}${hint ? '\n🔧 الحل: ' + hint : ''}` }, { status: 400 });
      }

      // الخطوة 2: إرسال رسالة اختبار إلى المحادثة
      let sendRes: Response;
      try {
        sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ اختبار النسخ الاحتياطي: الاتصال يعمل بنجاح.\nسيتم إرسال نسخ قاعدة البيانات إلى هذه المحادثة عند المزامنة.',
          }),
        });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: `التوكن صحيح (البوت: ${me.result?.first_name || ''}) لكن تعذر إرسال رسالة الاختبار: ${e.message || ''}` }, { status: 502 });
      }
      const send = await sendRes.json().catch(() => null);
      if (!send?.ok) {
        const desc = send?.description || `HTTP ${sendRes.status}`;
        const hint = telegramErrorHint(sendRes.status, desc);
        return NextResponse.json({ ok: false, error: `التوكن صحيح (البوت: ${me.result?.first_name || ''}) لكن فشل الإرسال إلى chat_id=${chatId}:\n${desc}${hint ? '\n🔧 الحل: ' + hint : ''}` }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `✅ الاتصال بـ Telegram يعمل!\n🤖 البوت: ${me.result?.first_name || ''} (@${me.result?.username || ''})\n💬 تم إرسال رسالة اختبار إلى: ${chatId}\nافتح Telegram للتأكد من وصولها.`,
      });
    }

    if (provider === 'webhook') {
      const url = String(body.webhookUrl || '').trim();
      if (!url) {
        return NextResponse.json({ ok: false, error: 'Webhook URL فارغ.' }, { status: 400 });
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'school-management-system', timestamp: new Date().toISOString() }),
        });
        if (!res.ok) {
          return NextResponse.json({ ok: false, error: `Webhook استجاب برمز HTTP ${res.status} — تحقق من صحة الرابط.` }, { status: 400 });
        }
        return NextResponse.json({ ok: true, message: `✅ Webhook استجاب بنجاح (HTTP ${res.status}).` });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'تعذر الوصول إلى Webhook: ' + (e.message || '') }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: false, error: 'اختبار Google Drive غير متاح هنا — استخدم زر "مزامنة الآن" للتجربة الفعلية.' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('POST /api/backup/cloud/test error:', error);
    return NextResponse.json({ ok: false, error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
