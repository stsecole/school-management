// ===== GET /api/backup/cloud/list =====
// يسرد الملفات الموجودة في المزود السحابي (يدعم Google Drive حالياً)
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

export async function GET() {
  try {
    await requireDirector();

    const [providerRow, saRow, folderIdRow] = await Promise.all([
      db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_service_account' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_folder_id' } }),
    ]);

    const provider = providerRow?.value || 'none';
    if (provider === 'none') {
      return NextResponse.json({ error: 'لا يوجد مزود مُكوَّن' }, { status: 400 });
    }
    if (provider !== 'googledrive') {
      return NextResponse.json({
        error: 'سرد الملفات متاح فقط لـ Google Drive. للاسترجاع من Telegram/Webhook، حمّل الملف يدوياً ثم استخدم "استيراد نسخة محلية".',
      }, { status: 400 });
    }

    const saJson = saRow?.value;
    if (!saJson) {
      return NextResponse.json({ error: 'Service Account غير مُكوَّن' }, { status: 400 });
    }

    let sa: any;
    try { sa = JSON.parse(saJson); } catch (e: any) {
      return NextResponse.json({ error: 'صيغة Service Account JSON غير صحيحة' }, { status: 400 });
    }

    const folderId = folderIdRow?.value || undefined;
    const accessToken = await getGoogleAccessToken(sa);

    // List files in the folder (or root if no folder)
    const q = folderId
      ? `'${folderId}' in parents and trashed = false`
      : `trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,createdTime)&orderBy=modifiedTime desc&pageSize=50`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({
        error: `Google Drive error: ${data.error?.message || 'unknown'}`,
      }, { status: 500 });
    }

    // Filter only .db files (backups)
    const files = (data.files || [])
      .filter((f: any) => f.name && f.name.endsWith('.db'))
      .map((f: any) => ({
        id: f.id,
        name: f.name,
        size: parseInt(f.size || '0', 10),
        sizeLabel: formatSize(parseInt(f.size || '0', 10)),
        modifiedTime: f.modifiedTime,
        createdTime: f.createdTime,
      }));

    return NextResponse.json({
      ok: true,
      files,
      count: files.length,
      provider: 'googledrive',
      folderId: folderId || null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('GET /api/backup/cloud/list error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
