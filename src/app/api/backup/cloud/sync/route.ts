// ===== POST /api/backup/cloud/sync =====
// ينسخ قاعدة البيانات الحالية إلى المزود السحابي المُكوَّن (telegram أو webhook أو googledrive)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function updateSyncStatus(status: 'success' | 'error', error: string = '') {
  const now = new Date().toISOString();
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_sync' },
    update: { value: now },
    create: { key: 'cloud_backup_last_sync', value: now },
  });
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_status' },
    update: { value: status },
    create: { key: 'cloud_backup_last_status', value: status },
  });
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_error' },
    update: { value: error },
    create: { key: 'cloud_backup_last_error', value: error },
  });
}

async function sendToTelegram(token: string, chatId: string, dbBuffer: Buffer, filename: string, branchLabel: string = 'main'): Promise<void> {
  // Telegram Bot API: sendDocument
  // Use FormData with Blob (Node 18+)
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', `🌐 نسخة احتياطية سحابية\n📁 الفرع: ${branchLabel}\n📅 ${new Date().toLocaleString('en-GB')}\n📦 ${(dbBuffer.length / 1024).toFixed(1)} KB`);
  // Create a Blob from buffer
  const blob = new Blob([dbBuffer], { type: 'application/octet-stream' });
  formData.append('document', blob, filename);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'unknown'}`);
  }
}

async function sendToWebhook(url: string, dbBuffer: Buffer, filename: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', new Blob([dbBuffer], { type: 'application/octet-stream' }), filename);
  formData.append('timestamp', new Date().toISOString());
  formData.append('source', 'school-management-system');

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook error ${res.status}: ${text}`);
  }
}

// ===== Google Drive: Service Account OAuth flow (no library needed) =====
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

  // Normalize private key: convert all forms of escaped newlines to real newlines
  let privateKey: string = serviceAccountJson.private_key;
  if (typeof privateKey !== 'string') {
    throw new Error('private_key ليس نصاً صحيحاً في ملف JSON');
  }
  // Replace literal \n (backslash + n) with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  // Also handle \\n (double-escaped)
  privateKey = privateKey.replace(/\\\\n/g, '\n');
  // Ensure the key has proper PEM format
  const pemMarker = String.fromCharCode(45,45,45,45,45,66,69,71,73,78,32,80,82,73,86,65,84,69,32,75,69,89,45,45,45,45,45);
  if (!privateKey.includes(pemMarker)) {
    throw new Error('private_key لا يحتوي على PEM header الصحيح. تأكد من نسخ ملف JSON كاملاً من Google Cloud Console.');
  }

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(toSign);
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
      throw new Error(`Invalid JWT Signature — المفتاح الخاص (private_key) غير صحيح أو تالف. الحل: أعد تنزيل ملف JSON من Google Cloud Console والصقه كاملاً. (التفاصيل: ${errMsg})`);
    }
    throw new Error(`Google auth failed: ${errMsg}`);
  }
  return data.access_token;
}

async function uploadToGoogleDrive(accessToken: string, dbBuffer: Buffer, filename: string, folderId?: string): Promise<string> {
  // Use multipart upload (Drive v3 API)
  const metadata: any = { name: filename };
  if (folderId) metadata.parents = [folderId];

  const boundary = '-------school_backup_' + Math.random().toString(36).slice(2);
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    dbBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    // Provide actionable hints based on common error reasons
    let hint = '';
    const reason = data.error?.errors?.[0]?.reason || '';
    const message = data.error?.message || '';
    if (reason === 'accessNotConfigured' || message.includes('has not been used') || message.includes('is disabled')) {
      const projectId = (message.match(/project\s+(\d+)/) || [])[1] || '';
      const enableUrl = projectId
        ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`
        : 'https://console.developers.google.com/apis/library/drive.googleapis.com';
      hint = `\n\n🔧 الحل:\n1. افتح هذا الرابط: ${enableUrl}\n2. اضغط "Enable" (تفعيل)\n3. انتظر 1-2 دقيقة\n4. ارجع للتطبيق واضغط "مزامنة الآن" مرة أخرى`;
    } else if (reason === 'forbidden' || data.error?.code === 403) {
      hint = `\n\n🔧 الحل: تأكد من مشاركة المجلد مع Service Account بصلاحية "محرر"`;
    } else if (reason === 'notFound' || data.error?.code === 404) {
      hint = `\n\n🔧 الحل: تحقق من Folder ID — تأكد من نسخه بشكل صحيح من URL المجلد`;
    } else if (message.includes('storage quota') || message.includes('Service Accounts do not have')) {
      hint = `\n\n⚠ قيود Google Drive:\nService Accounts لا تملك مساحة تخزين في الحسابات المجانية (Gmail).\n\nالحلول:\n1. استخدم Telegram بدلاً من ذلك (مجاني، بدون قيود) — من الإعدادات اختر "Telegram"\n2. أو استخدم Google Workspace (مدفوع) مع Shared Drives\n3. أو استخدم Webhook مع خادمك الخاص`;
    }
    throw new Error(`Drive upload failed: ${message}${hint}`);
  }
  return data.id as string;
}

export async function POST(request: NextRequest) {
  try {
    await requireDirector();

    // Read settings
    const [providerRow, tokenRow, chatIdRow, webhookRow, gdriveRow, gdriveFolderRow] = await Promise.all([
      db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_telegram_token' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_telegram_chat_id' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_webhook_url' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_service_account' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_folder_id' } }),
    ]);

    const provider = providerRow?.value || 'none';
    const token = tokenRow?.value || '';
    const chatId = chatIdRow?.value || '';
    const webhookUrl = webhookRow?.value || '';
    const gdriveSa = gdriveRow?.value || '';
    const gdriveFolderId = gdriveFolderRow?.value || '';

    if (provider === 'none') {
      return NextResponse.json({ error: 'لم يتم تكوين مزود النسخ السحابي' }, { status: 400 });
    }
    if (provider === 'telegram') {
      if (!token || !chatId) {
        return NextResponse.json({ error: 'نقص في إعدادات Telegram (token أو chat_id)' }, { status: 400 });
      }
    }
    if (provider === 'webhook') {
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Webhook URL غير مُكوَّن' }, { status: 400 });
      }
    }
    if (provider === 'googledrive') {
      if (!gdriveSa) {
        return NextResponse.json({ error: 'Service Account JSON غير مُكوَّن' }, { status: 400 });
      }
    }

    // Read DB file
    const dbPath = path.join(process.cwd(), 'db', 'custom.db');
    let dbBuffer: Buffer;
    try {
      dbBuffer = await fs.readFile(dbPath);
    } catch (e: any) {
      throw new Error('قاعدة البيانات غير موجودة: ' + e.message);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // Get active branch name to include in filename (helps distinguish backups from different branches in Telegram)
    let branchLabel = 'main';
    try {
      const activeBranchId = await getBranchIdForNewRecord();
      if (activeBranchId) {
        const branch = await db.branch.findUnique({
          where: { id: activeBranchId },
          select: { name: true, code: true, receiptPrefix: true },
        });
        if (branch) {
          // Sanitize branch name for filename (remove special chars)
          const safeName = (branch.name || '').replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F_-]/g, '').slice(0, 30);
          const safePrefix = (branch.receiptPrefix || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 5);
          if (safePrefix && safeName) {
            branchLabel = `${safePrefix}-${safeName}`;
          } else if (safeName) {
            branchLabel = safeName;
          } else if (safePrefix) {
            branchLabel = safePrefix;
          } else if (branch.code) {
            branchLabel = branch.code;
          }
        }
      }
    } catch (e) {
      // If branch lookup fails, use default 'main' label
    }

    const filename = `backup-cloud-${branchLabel}-${timestamp}.db`;

    // Send to provider
    let providerLabel = '';
    try {
      if (provider === 'telegram') {
        providerLabel = 'Telegram';
        await sendToTelegram(token, chatId, dbBuffer, filename, branchLabel);
      } else if (provider === 'webhook') {
        providerLabel = 'Webhook';
        await sendToWebhook(webhookUrl, dbBuffer, filename);
      } else if (provider === 'googledrive') {
        providerLabel = 'Google Drive';
        // Parse service account JSON
        let saJson: any;
        try {
          saJson = JSON.parse(gdriveSa);
        } catch (e: any) {
          throw new Error('صيغة Service Account JSON غير صحيحة: ' + e.message + '. يرجى إعادة لصق ملف JSON كاملاً في الإعدادات.');
        }
        if (!saJson.client_email || !saJson.private_key) {
          throw new Error('Service Account JSON غير مكتمل أو فارغ. يرجى إعادة لصق ملف JSON كاملاً في الإعدادات (يحتوي على client_email و private_key).');
        }
        if (saJson.private_key.length < 100) {
          throw new Error('private_key قصير جداً أو فارغ. يرجى إعادة لصق ملف JSON كاملاً في الإعدادات.');
        }
        const accessToken = await getGoogleAccessToken(saJson);
        const fileId = await uploadToGoogleDrive(accessToken, dbBuffer, filename, gdriveFolderId || undefined);
        providerLabel += ` (File ID: ${fileId})`;
      }
    } catch (sendErr: any) {
      await updateSyncStatus('error', sendErr.message);
      return NextResponse.json({
        ok: false,
        error: `فشل الإرسال إلى ${providerLabel}: ${sendErr.message}`,
      }, { status: 500 });
    }

    await updateSyncStatus('success');
    return NextResponse.json({
      ok: true,
      message: `تم إرسال النسخة إلى ${providerLabel}\n📁 الفرع: ${branchLabel}\n📦 ${filename} (${(dbBuffer.length / 1024).toFixed(1)} KB)`,
      filename,
      size: dbBuffer.length,
      provider: providerLabel,
      branchLabel,
      syncedAt: now.toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('POST /api/backup/cloud/sync error:', error);
    await updateSyncStatus('error', error.message || 'unknown error').catch(() => {});
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
