// ===== GET /api/backup/cloud/download?fileId=xxx =====
// ينزّل ملف من Google Drive ويمرره إلى المستخدم
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
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

export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
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

    // Get file metadata first (for filename)
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return NextResponse.json({
        error: `تعذر الوصول للملف: ${err.error?.message || metaRes.statusText}`,
      }, { status: 404 });
    }
    const meta = await metaRes.json();
    const filename = meta.name || `cloud-${fileId}.db`;

    // Download the file content (alt=media)
    const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!dlRes.ok) {
      return NextResponse.json({ error: `تعذر تنزيل الملف: ${dlRes.statusText}` }, { status: 500 });
    }

    const arrayBuffer = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('GET /api/backup/cloud/download error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
