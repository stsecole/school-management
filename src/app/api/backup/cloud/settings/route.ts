// ===== GET/PUT /api/backup/cloud/settings =====
// إعدادات النسخ السحابي التلقائي
// المزودات: telegram | webhook | none
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS = [
  'cloud_backup_provider',                  // 'none' | 'telegram' | 'webhook' | 'googledrive'
  'cloud_backup_telegram_token',            // Bot token from @BotFather
  'cloud_backup_telegram_chat_id',          // Chat/Channel ID
  'cloud_backup_webhook_url',               // Webhook URL (POST multipart)
  'cloud_backup_googledrive_service_account', // JSON content of service account key
  'cloud_backup_googledrive_folder_id',     // Optional: target folder ID
  'cloud_backup_frequency',                 // 'manual' | 'daily' | 'weekly'
  'cloud_backup_last_sync',                 // ISO timestamp
  'cloud_backup_last_status',               // 'success' | 'error' | 'never'
  'cloud_backup_last_error',                // error message
];

const DEFAULTS: Record<string, string> = {
  cloud_backup_provider: 'none',
  cloud_backup_telegram_token: '',
  cloud_backup_telegram_chat_id: '',
  cloud_backup_webhook_url: '',
  cloud_backup_googledrive_service_account: '',
  cloud_backup_googledrive_folder_id: '',
  cloud_backup_frequency: 'manual',
  cloud_backup_last_sync: '',
  cloud_backup_last_status: 'never',
  cloud_backup_last_error: '',
};

export async function GET() {
  try {
    await requireDirector();
    const rows = await db.setting.findMany({ where: { key: { in: KEYS } } });
    const result: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) result[r.key] = r.value;
    // Return actual values (director-only endpoint) — no masking
    // This prevents the SA from being wiped when saving other settings
    return NextResponse.json({ settings: result });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('GET /api/backup/cloud/settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const updates: Promise<any>[] = [];
    for (const key of KEYS) {
      // Don't update last_sync/last_status/last_error via PUT — only via sync endpoint
      if (key === 'cloud_backup_last_sync' || key === 'cloud_backup_last_status' || key === 'cloud_backup_last_error') continue;
      // CRITICAL: If the key is not in the request body (undefined), skip it
      // to preserve the existing value. This prevents overwriting the saved
      // Service Account JSON or Telegram token with an empty string when
      // the user saves settings without re-entering those fields.
      if (body[key] === undefined) continue;
      const value = String(body[key]);
      updates.push(
        db.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      );
    }
    await Promise.all(updates);
    return NextResponse.json({ ok: true, message: 'تم حفظ إعدادات النسخ السحابي' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    console.error('PUT /api/backup/cloud/settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
