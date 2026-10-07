// ===== POST /api/backup/cloud/test =====
// يختبر الإعدادات بدون إرسال قاعدة البيانات الفعلية (للتحقق من الاتصال)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function getGoogleAccessToken(serviceAccountJson: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(toSign);
  let privateKey: string = serviceAccountJson.private_key;
  if (typeof privateKey !== 'string') {
    throw new Error('private_key ليس نصاً صحيحاً');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  privateKey = privateKey.replace(/\\\\n/g, '\n');
  const pemMarker = String.fromCharCode(45,45,45,45,45,66,69,71,73,78,32,80,82,73,86,65,84,69,32,75,69,89,45,45,45,45,45);
  if (!privateKey.includes(pemMarker)) {
    throw new Error('private_key لا يحتوي على PEM header الصحيح');
  }
  const signature = sign.sign(privateKey, 'base64url');
  const jwt = `${toSign}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const errMsg = data.error_description || data.error || JSON.stringify(data);
    if (data.error === 'invalid_grant' && errMsg.includes('Invalid JWT Signature')) {
      throw new Error(`Invalid JWT Signature — المفتاح الخاص تالف. أعد تنزيل JSON من Google Cloud Console.`);
    }
    throw new Error(`Google auth failed: ${errMsg}`);
  }
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const provider = body.provider || 'none';
    const token = body.token || '';
    const chatId = body.chatId || '';
    const webhookUrl = body.webhookUrl || '';
    const gdriveSa = body.gdriveSa || '';
    const gdriveFolderId = body.gdriveFolderId || '';

    if (provider === 'telegram') {
      if (!token || !chatId) {
        return NextResponse.json({ ok: false, error: 'نقص في الإعدادات: token أو chat_id' }, { status: 400 });
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ اختبار النسخ الاحتياطي السحابي - ${new Date().toLocaleString('en-GB')}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return NextResponse.json({
          ok: false,
          error: `Telegram error: ${data.description || res.statusText}`,
        }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: 'تم إرسال رسالة اختبار إلى Telegram بنجاح' });
    }

    if (provider === 'webhook') {
      if (!webhookUrl) {
        return NextResponse.json({ ok: false, error: 'Webhook URL غير مُكوَّن' }, { status: 400 });
      }
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          source: 'school-management-system',
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json({
          ok: false,
          error: `Webhook error ${res.status}: ${text || res.statusText}`,
        }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: 'تم الاتصال بالـ Webhook بنجاح' });
    }

    if (provider === 'googledrive') {
      if (!gdriveSa) {
        return NextResponse.json({ ok: false, error: 'Service Account JSON غير مُكوَّن' }, { status: 400 });
      }
      let saJson: any;
      try {
        saJson = JSON.parse(gdriveSa);
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'صيغة JSON غير صحيحة: ' + e.message }, { status: 400 });
      }
      if (!saJson.client_email || !saJson.private_key) {
        return NextResponse.json({ ok: false, error: 'JSON غير مكتمل (يجب أن يحتوي على client_email و private_key)' }, { status: 400 });
      }
      let accessToken: string;
      try {
        accessToken = await getGoogleAccessToken(saJson);
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'فشل الاتصال بـ Google: ' + e.message }, { status: 400 });
      }
      let folderInfo = '';
      if (gdriveFolderId) {
        try {
          const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${gdriveFolderId}?fields=id,name,mimeType`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (folderRes.ok) {
            const folderData = await folderRes.json();
            folderInfo = ` (المجلد: "${folderData.name}")`;
            if (folderData.mimeType !== 'application/vnd.google-apps.folder') {
              return NextResponse.json({ ok: false, error: 'المعرّف ليس مجلداً' }, { status: 400 });
            }
          } else {
            const errData = await folderRes.json().catch(() => ({}));
            const errorCode = errData.error?.errors?.[0]?.reason || '';
            let hint = '';
            if (errorCode === 'notFound' || errData.error?.code === 404) {
              hint = `\n\n🔧 الحل:\n1. افتح Google Drive في المتصفح\n2. اضغط يميناً على المجلد → "مشاركة"\n3. الصق هذا البريد: ${saJson.client_email}\n4. اختر "محرر"\n5. اضغط "إرسال"`;
            } else if (errData.error?.code === 403) {
              hint = `\n\n🔧 الحل: تأكد من مشاركة المجلد مع: ${saJson.client_email}`;
            }
            return NextResponse.json({
              ok: false,
              error: `تعذر الوصول للمجلد: ${errData.error?.message || ''}${hint}`,
              clientEmail: saJson.client_email,
            }, { status: 400 });
          }
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: 'خطأ في فحص المجلد: ' + e.message }, { status: 400 });
        }
      }
      return NextResponse.json({
        ok: true,
        message: `تم الاتصال بـ Google Drive بنجاح${folderInfo}. البريد: ${saJson.client_email}`,
      });
    }

    return NextResponse.json({ ok: false, error: 'مزود غير مدعوم' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('POST /api/backup/cloud/test error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
