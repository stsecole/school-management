// ===== POST /api/backup/auto =====
// (يستدعى تلقائياً أو يدوياً للتحقق من موعد النسخ التلقائي)
// - يتحقق من الإعدادات المحلية والسحابية
// - ينشئ نسخة محلية تلقائية إذا حان الوقت
// - يرسل نسخة سحابية تلقائية إذا حان وقتها (Telegram/Google Drive/Webhook)

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// دالة مساعدة: حساب الفرق بالساعات بين تاريخين
function hoursSince(date: Date | null): number {
  if (!date) return Infinity;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

// دالة مساعدة: التحقق مما إذا كان الوقت الحالي مطابقاً للوقت المجدول
function isTimeToBackup(scheduledTime: string, frequency: string, lastBackup: Date | null): boolean {
  const now = new Date();
  const [targetHour, targetMinute] = scheduledTime.split(':').map(Number);

  if (!lastBackup) return true;

  switch (frequency) {
    case 'every6h':
      return hoursSince(lastBackup) >= 6;
    case 'every12h':
      return hoursSince(lastBackup) >= 12;
    case 'weekly':
      return hoursSince(lastBackup) >= 168;
    case 'daily':
    default:
      if (hoursSince(lastBackup) >= 24) return true;
      const lastBackupDate = new Date(lastBackup);
      const isSameDay = now.getFullYear() === lastBackupDate.getFullYear() &&
                       now.getMonth() === lastBackupDate.getMonth() &&
                       now.getDate() === lastBackupDate.getDate();
      if (isSameDay) return false;
      return now.getHours() >= targetHour && now.getMinutes() >= targetMinute;
  }
}

// دالة مساعدة: تنظيف النسخ القديمة
async function cleanOldBackups(backupDir: string, maxBackups: number) {
  const files = await fs.readdir(backupDir);
  const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.db'));
  backupFiles.sort().reverse();
  const toDelete = backupFiles.slice(maxBackups);
  let deletedCount = 0;
  for (const f of toDelete) {
    try {
      await fs.unlink(path.join(backupDir, f));
      deletedCount++;
    } catch {}
  }
  return deletedCount;
}

// ===== دوال النسخ السحابي =====

async function updateCloudSyncStatus(status: 'success' | 'error', error: string = '') {
  const now = new Date().toISOString();
  try {
    await db.setting.upsert({ where: { key: 'cloud_backup_last_sync' }, update: { value: now }, create: { key: 'cloud_backup_last_sync', value: now } });
    await db.setting.upsert({ where: { key: 'cloud_backup_last_status' }, update: { value: status }, create: { key: 'cloud_backup_last_status', value: status } });
    await db.setting.upsert({ where: { key: 'cloud_backup_last_error' }, update: { value: error }, create: { key: 'cloud_backup_last_error', value: error } });
  } catch {}
}

async function sendToTelegram(token: string, chatId: string, dbBuffer: Buffer, filename: string, branchLabel: string = 'main'): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', `🌐 نسخة احتياطية تلقائية\n📁 الفرع: ${branchLabel}\n📅 ${new Date().toLocaleString('en-GB')}\n📦 ${(dbBuffer.length / 1024).toFixed(1)} KB`);
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
  formData.append('source', 'school-management-system-auto');
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook error ${res.status}: ${text}`);
  }
}

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
  let privateKey: string = serviceAccountJson.private_key;
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
  const pemMarker = String.fromCharCode(45,45,45,45,45,66,69,71,73,78,32,80,82,73,86,65,84,69,32,75,69,89,45,45,45,45,45);
  if (!privateKey.includes(pemMarker)) {
    throw new Error('private_key لا يحتوي على PEM header الصحيح');
  }
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(toSign);
  const signature = sign.sign(privateKey, 'base64url');
  const jwt = `${toSign}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Google auth failed: ${data.error_description || data.error || 'unknown'}`);
  }
  return data.access_token;
}

async function uploadToGoogleDrive(accessToken: string, dbBuffer: Buffer, filename: string, folderId?: string): Promise<string> {
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
    throw new Error(`Drive upload failed: ${data.error?.message || 'unknown'}`);
  }
  return data.id as string;
}

// ===== تنفيذ النسخ السحابي التلقائي =====
async function performCloudBackup(): Promise<{ ok: boolean; message: string; provider?: string }> {
  // قراءة الإعدادات السحابية
  const [providerRow, tokenRow, chatIdRow, webhookRow, gdriveRow, gdriveFolderRow, freqRow, lastSyncRow] = await Promise.all([
    db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_telegram_token' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_telegram_chat_id' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_webhook_url' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_service_account' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_googledrive_folder_id' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_frequency' } }),
    db.setting.findUnique({ where: { key: 'cloud_backup_last_sync' } }),
  ]);

  const provider = providerRow?.value || 'none';
  const cloudFreq = freqRow?.value || 'manual';

  // إذا لم يكن هناك مزود مُكوّن، تخطي
  if (provider === 'none') {
    return { ok: false, message: 'لا يوجد مزود سحابي مُكوّن' };
  }

  // إذا كان التكرار "manual"، لا تنسخ تلقائياً
  if (cloudFreq === 'manual') {
    return { ok: false, message: 'النسخ السحابي اليدوي فقط' };
  }

  // تحقق هل حان وقت النسخ السحابي؟
  const lastSync = lastSyncRow?.value ? new Date(lastSyncRow.value) : null;
  const cloudHoursPerFreq: Record<string, number> = {
    'every6h': 6,
    'every12h': 12,
    'daily': 24,
    'weekly': 168,
  };
  const hoursNeeded = cloudHoursPerFreq[cloudFreq] || 24;
  if (lastSync && hoursSince(lastSync) < hoursNeeded) {
    return { ok: false, message: `لم يحين وقت النسخ السحابي (${hoursSince(lastSync).toFixed(1)}/${hoursNeeded} ساعة)` };
  }

  // تنفيذ النسخ السحابي
  const token = tokenRow?.value || '';
  const chatId = chatIdRow?.value || '';
  const webhookUrl = webhookRow?.value || '';
  const gdriveSa = gdriveRow?.value || '';
  const gdriveFolderId = gdriveFolderRow?.value || '';

  // قراءة ملف قاعدة البيانات
  const dbPath = path.join(process.cwd(), 'db', 'custom.db');
  let dbBuffer: Buffer;
  try {
    dbBuffer = await fs.readFile(dbPath);
  } catch (e: any) {
    throw new Error('قاعدة البيانات غير موجودة: ' + e.message);
  }

  // اسم الملف مع تسمية الفرع
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  let branchLabel = 'main';
  try {
    const activeBranchId = await getBranchIdForNewRecord();
    if (activeBranchId) {
      const branch = await db.branch.findUnique({
        where: { id: activeBranchId },
        select: { name: true, code: true, receiptPrefix: true },
      });
      if (branch) {
        const safeName = (branch.name || '').replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F_-]/g, '').slice(0, 30);
        const safePrefix = (branch.receiptPrefix || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 5);
        if (safePrefix && safeName) branchLabel = `${safePrefix}-${safeName}`;
        else if (safeName) branchLabel = safeName;
        else if (safePrefix) branchLabel = safePrefix;
        else if (branch.code) branchLabel = branch.code;
      }
    }
  } catch {}

  const filename = `backup-cloud-${branchLabel}-${timestamp}.db`;
  let providerLabel = '';

  try {
    if (provider === 'telegram') {
      if (!token || !chatId) throw new Error('نقص في إعدادات Telegram');
      providerLabel = 'Telegram';
      await sendToTelegram(token, chatId, dbBuffer, filename, branchLabel);
    } else if (provider === 'webhook') {
      if (!webhookUrl) throw new Error('Webhook URL غير مُكوَّن');
      providerLabel = 'Webhook';
      await sendToWebhook(webhookUrl, dbBuffer, filename);
    } else if (provider === 'googledrive') {
      if (!gdriveSa) throw new Error('Service Account JSON غير مُكوَّن');
      providerLabel = 'Google Drive';
      let saJson: any;
      try {
        saJson = JSON.parse(gdriveSa);
      } catch (e: any) {
        throw new Error('صيغة Service Account JSON غير صحيحة');
      }
      const accessToken = await getGoogleAccessToken(saJson);
      await uploadToGoogleDrive(accessToken, dbBuffer, filename, gdriveFolderId || undefined);
    }

    await updateCloudSyncStatus('success');
    return { ok: true, message: `تم النسخ السحابي التلقائي إلى ${providerLabel}`, provider: providerLabel };
  } catch (err: any) {
    await updateCloudSyncStatus('error', err.message);

    // إشعار عند فشل النسخ السحابي
    try {
      const settings = await db.backupSettings.findFirst();
      if (settings?.notifyOnBackupFailure) {
        await db.notification.create({
          data: {
            title: 'فشل النسخ السحابي التلقائي',
            message: `حدث خطأ أثناء النسخ السحابي: ${err.message}`,
            type: 'warning',
            category: 'system',
            link: 'backup',
            isRead: false,
          },
        });
      }
    } catch {}

    return { ok: false, message: `فشل النسخ السحابي: ${err.message}` };
  }
}

// دالة مساعدة: التحقق من وجود قاعدة البيانات وإنشائها إذا لم تكن موجودة
async function ensureDatabaseExists(): Promise<{ exists: boolean; created: boolean; path: string; error?: string }> {
  const dbPath = path.join(process.cwd(), 'db', 'custom.db');
  const dbDir = path.dirname(dbPath);

  try {
    // التأكد من وجود مجلد db
    await fs.mkdir(dbDir, { recursive: true });

    // التحقق من وجود الملف
    try {
      await fs.access(dbPath);
      return { exists: true, created: false, path: dbPath };
    } catch {
      // الملف غير موجود - نحاول إنشاءه عبر Prisma
      console.log('Database file not found, attempting to create via prisma db push...');

      try {
        // محاولة إنشاء قاعدة بيانات جديدة فارغة (SQLite header)
        const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1');
        const emptyDb = Buffer.alloc(4096);
        SQLITE_HEADER.copy(emptyDb, 0);
        // Page size = 4096 (offset 16-17)
        emptyDb.writeUInt16BE(4096, 16);
        // File format write/read version = 1 (offset 18-19)
        emptyDb.writeUInt8(1, 18);
        emptyDb.writeUInt8(1, 19);
        // Reserved space = 0 (offset 20)
        emptyDb.writeUInt8(0, 20);
        // Database size in pages = 1 (offset 28-31)
        emptyDb.writeUInt32BE(1, 28);
        // Schema cookie = 1 (offset 40-43)
        emptyDb.writeUInt32BE(1, 40);
        // Schema format = 4 (offset 44-47)
        emptyDb.writeUInt32BE(4, 44);
        // Default page cache size = 0 (offset 48-51)
        emptyDb.writeUInt32BE(0, 48);
        // Text encoding = 1 (UTF-8) (offset 56-59)
        emptyDb.writeUInt32BE(1, 56);
        // User version = 0 (offset 60-63)
        emptyDb.writeUInt32BE(0, 60);
        // Incremental vacuum = 0 (offset 64-67)
        emptyDb.writeUInt32BE(0, 64);
        // Application ID = 0 (offset 68-71)
        emptyDb.writeUInt32BE(0, 68);
        // Version-valid-for = 1 (offset 92-95)
        emptyDb.writeUInt32BE(1, 92);
        // SQLite version number (offset 96-99)
        emptyDb.writeUInt32BE(3045000, 96);

        await fs.writeFile(dbPath, emptyDb);
        console.log('Created empty SQLite database file');

        // تشغيل prisma db push لإنشاء الجداول
        const { execSync } = await import('child_process');
        try {
          execSync('npx prisma db push --skip-generate', {
            cwd: process.cwd(),
            stdio: 'pipe',
            timeout: 30000,
          });
          console.log('Prisma db push completed - tables created');
          return { exists: true, created: true, path: dbPath };
        } catch (pushErr: any) {
          console.error('prisma db push failed:', pushErr.message);
          return {
            exists: false,
            created: false,
            path: dbPath,
            error: `تم إنشاء ملف قاعدة البيانات لكن فشل إنشاء الجداول. شغّل يدوياً: npx prisma db push`
          };
        }
      } catch (createErr: any) {
        return {
          exists: false,
          created: false,
          path: dbPath,
          error: `تعذر إنشاء قاعدة البيانات: ${createErr.message}. شغّل يدوياً: npx prisma db push`
        };
      }
    }
  } catch (err: any) {
    return {
      exists: false,
      created: false,
      path: dbPath,
      error: `خطأ في الوصول لمجلد قاعدة البيانات: ${err.message}`
    };
  }
}

// ===== نقطة الدخول الرئيسية =====
export async function POST() {
  const startTime = Date.now();
  let logEntry: any = null;
  let localResult: any = null;
  let cloudResult: any = null;

  try {
    let settings = await db.backupSettings.findFirst();
    if (!settings) {
      settings = await db.backupSettings.create({
        data: {
          autoBackupEnabled: true,
          frequency: 'daily',
          scheduledTime: '02:00',
          maxBackups: 30,
        },
      });
    }

    // === 0. التحقق من وجود قاعدة البيانات وإنشائها إذا لم تكن موجودة ===
    const dbCheck = await ensureDatabaseExists();
    if (!dbCheck.exists) {
      return NextResponse.json({
        ok: false,
        error: dbCheck.error || 'قاعدة البيانات غير موجودة',
        solution: 'شغّل الأمر التالي في Terminal: npx prisma db push',
        dbPath: dbCheck.path,
      }, { status: 500 });
    }

    // === 1. النسخ المحلي التلقائي ===
    if (settings.autoBackupEnabled && isTimeToBackup(settings.scheduledTime, settings.frequency, settings.lastAutoBackupAt)) {
      const sourcePath = dbCheck.path;
      const backupDir = path.join(process.cwd(), settings.backupLocation || 'download/backups');
      await fs.mkdir(backupDir, { recursive: true });

      // WAL checkpoint
      try {
        await db.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;
      } catch (e) {
        console.log('WAL checkpoint failed:', e);
      }
      await new Promise(resolve => setTimeout(resolve, 300));

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `backup-${timestamp}.db`;
      const destPath = path.join(backupDir, filename);

      logEntry = await db.backupLog.create({
        data: { type: 'auto', filename, size: 0, status: 'in_progress' },
      });

      const data = await fs.readFile(sourcePath);
      await fs.writeFile(destPath, data);
      const size = (await fs.stat(destPath)).size;

      await db.backupLog.update({
        where: { id: logEntry.id },
        data: { size, status: 'success' },
      });

      await db.backupSettings.update({
        where: { id: settings.id },
        data: { lastAutoBackupAt: now },
      });

      const deletedOld = await cleanOldBackups(backupDir, settings.maxBackups);

      // حذف سجلات BackupLog القديمة (90 يوماً)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      await db.backupLog.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } });

      localResult = {
        ok: true,
        filename,
        size,
        deletedOld,
      };

      // إشعار النسخ المحلي الناجح
      if (settings.notifyOnAutoBackup) {
        try {
          await db.notification.create({
            data: {
              title: 'نسخ احتياطي تلقائي',
              message: `تم إنشاء نسخة محلية تلقائية: ${filename} (${(size / 1024).toFixed(1)} KB)`,
              type: 'success',
              category: 'system',
              link: 'backup',
              isRead: false,
            },
          });
        } catch {}
      }
    }

    // === 2. النسخ السحابي التلقائي ===
    try {
      cloudResult = await performCloudBackup();
    } catch (err: any) {
      cloudResult = { ok: false, message: err.message };
    }

    const duration = Date.now() - startTime;

    // إذا لم يكن هناك نسخ محلي ولا سحابي
    if (!localResult && !cloudResult?.ok) {
      return NextResponse.json({
        skipped: true,
        reason: 'لم يحين وقت أي نسخة',
        local: localResult,
        cloud: cloudResult,
      });
    }

    return NextResponse.json({
      ok: true,
      local: localResult,
      cloud: cloudResult,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('POST /api/backup/auto error:', error);

    if (logEntry) {
      try {
        await db.backupLog.update({
          where: { id: logEntry.id },
          data: { status: 'failed', errorMessage: error.message || 'خطأ غير معروف' },
        });
      } catch {}
    }

    try {
      const settings = await db.backupSettings.findFirst();
      if (settings?.notifyOnBackupFailure) {
        await db.notification.create({
          data: {
            title: 'فشل النسخ التلقائي',
            message: `حدث خطأ: ${error.message || 'خطأ غير معروف'}`,
            type: 'warning',
            category: 'system',
            link: 'backup',
            isRead: false,
          },
        });
      }
    } catch {}

    return NextResponse.json({
      ok: false,
      error: error.message || 'حدث خطأ أثناء النسخ التلقائي',
    }, { status: 500 });
  }
}

// GET - معلومات حالة النسخ التلقائي (محلي + سحابي)
export async function GET() {
  try {
    const settings = await db.backupSettings.findFirst();
    if (!settings) {
      return NextResponse.json({
        autoBackupEnabled: false,
        message: 'لم تتم تهيئة النسخ التلقائي بعد',
      });
    }

    // معلومات النسخ المحلي
    let nextLocalBackupTime: Date | null = null;
    if (settings.autoBackupEnabled && settings.lastAutoBackupAt) {
      const lastBackup = new Date(settings.lastAutoBackupAt);
      const hoursPerFrequency: Record<string, number> = {
        'every6h': 6,
        'every12h': 12,
        'daily': 24,
        'weekly': 168,
      };
      const hours = hoursPerFrequency[settings.frequency] || 24;
      nextLocalBackupTime = new Date(lastBackup.getTime() + hours * 60 * 60 * 1000);
    }

    // معلومات النسخ السحابي
    const [providerRow, cloudFreqRow, lastCloudSyncRow] = await Promise.all([
      db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_frequency' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_last_sync' } }),
    ]);

    let nextCloudBackupTime: Date | null = null;
    const cloudProvider = providerRow?.value || 'none';
    const cloudFreq = cloudFreqRow?.value || 'manual';
    const lastCloudSync = lastCloudSyncRow?.value ? new Date(lastCloudSyncRow.value) : null;

    if (cloudProvider !== 'none' && cloudFreq !== 'manual' && lastCloudSync) {
      const cloudHoursPerFreq: Record<string, number> = {
        'every6h': 6,
        'every12h': 12,
        'daily': 24,
        'weekly': 168,
      };
      const hours = cloudHoursPerFreq[cloudFreq] || 24;
      nextCloudBackupTime = new Date(lastCloudSync.getTime() + hours * 60 * 60 * 1000);
    }

    // آخر 5 عمليات
    const recentLogs = await db.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      settings: {
        autoBackupEnabled: settings.autoBackupEnabled,
        frequency: settings.frequency,
        scheduledTime: settings.scheduledTime,
        maxBackups: settings.maxBackups,
        lastAutoBackupAt: settings.lastAutoBackupAt,
        nextLocalBackupTime,
      },
      cloud: {
        provider: cloudProvider,
        frequency: cloudFreq,
        lastSync: lastCloudSync,
        nextCloudBackupTime,
      },
      recentLogs,
    });
  } catch (error: any) {
    console.error('GET /api/backup/auto error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
