// ===== POST /api/backup/cloud/restore =====
// يسترجع نسخة من Google Drive ويستبدل قاعدة البيانات الحالية بها
// Body: { fileId: string }
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  if (typeof privateKey !== 'string') throw new Error('private_key invalid');
  privateKey = privateKey.replace(/\\\\n/g, '\n');
  privateKey = privateKey.replace(/\\n/g, '\n');
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
    throw new Error(`Google auth failed: ${data.error_description || data.error || JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function updateRestoreStatus(status: 'success' | 'error', error: string = '') {
  const now = new Date().toISOString();
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_sync' },
    update: { value: now },
    create: { key: 'cloud_backup_last_sync', value: now },
  }).catch(() => {});
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_status' },
    update: { value: status },
    create: { key: 'cloud_backup_last_status', value: status },
  }).catch(() => {});
  await db.setting.upsert({
    where: { key: 'cloud_backup_last_error' },
    update: { value: error },
    create: { key: 'cloud_backup_last_error', value: error },
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId مطلوب' }, { status: 400 });
    }

    const [providerRow, saRow] = await Promise.all([
      db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_service_account' } }),
    ]);

    if (providerRow?.value !== 'googledrive' || !saRow?.value) {
      return NextResponse.json({ error: 'Google Drive غير مُكوَّن' }, { status: 400 });
    }

    let sa: any;
    try { sa = JSON.parse(saRow.value); } catch {
      return NextResponse.json({ error: 'صيغة Service Account JSON غير صحيحة' }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken(sa);

    // Get file metadata
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      await updateRestoreStatus('error', `File not found: ${err.error?.message || ''}`);
      return NextResponse.json({
        error: `تعذر الوصول للملف في Google Drive: ${err.error?.message || metaRes.statusText}`,
      }, { status: 404 });
    }
    const meta = await metaRes.json();
    const filename = meta.name || `cloud-${fileId}.db`;
    const fileSize = parseInt(meta.size || '0', 10);

    // Download file content
    const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!dlRes.ok) {
      await updateRestoreStatus('error', `Download failed: ${dlRes.statusText}`);
      return NextResponse.json({ error: `تعذر تنزيل الملف: ${dlRes.statusText}` }, { status: 500 });
    }

    const arrayBuffer = await dlRes.arrayBuffer();
    const cloudBuffer = Buffer.from(arrayBuffer);

    // === Safety: backup current DB first ===
    const targetPath = path.join(process.cwd(), 'db', 'custom.db');
    const safetyDir = path.join(process.cwd(), 'download', 'backups');
    await fs.mkdir(safetyDir, { recursive: true });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const safetyTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safetyFilename = `backup-${safetyTimestamp}.db`;

    try {
      const currentData = await fs.readFile(targetPath);
      await fs.writeFile(path.join(safetyDir, safetyFilename), currentData);
    } catch (e) {
      // target doesn't exist — proceed without safety backup
    }

    // === Replace current DB with cloud version ===
    try {
      await fs.writeFile(targetPath, cloudBuffer);
    } catch (writeErr: any) {
      await updateRestoreStatus('error', `Write failed: ${writeErr.message}`);
      return NextResponse.json({
        error: 'تعذر الكتابة فوق قاعدة البيانات الحالية. قد تكون قيد الاستخدام. أوقف التطبيق (npm run dev) ثم أعد المحاولة.',
        details: writeErr.message,
      }, { status: 500 });
    }

    await updateRestoreStatus('success');
    return NextResponse.json({
      ok: true,
      message: `تمت استعادة النسخة السحابية: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`,
      filename,
      size: fileSize,
      safetyBackup: safetyFilename,
      warning: 'يجب إعادة تشغيل التطبيق (Ctrl+C ثم npm run dev) ليتم تحميل البيانات الجديدة',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('POST /api/backup/cloud/restore error:', error);
    await updateRestoreStatus('error', error.message).catch(() => {});
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
