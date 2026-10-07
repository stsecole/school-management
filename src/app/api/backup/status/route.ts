// ===== GET /api/backup/status =====
// معلومات شاملة عن حالة النسخ الاحتياطي
// - الإعدادات الحالية
// - آخر نسخة احتياطية
// - موعد النسخة القادمة
// - إحصائيات
// - آخر 10 سجلات

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    await requireAuth();

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

    // حساب موعد النسخة القادمة
    let nextBackupTime: Date | null = null;
    let timeUntilNextBackup: string = '';

    if (settings.autoBackupEnabled) {
      if (!settings.lastAutoBackupAt) {
        nextBackupTime = new Date();
        timeUntilNextBackup = 'الآن';
      } else {
        const lastBackup = new Date(settings.lastAutoBackupAt);
        const hoursPerFrequency: Record<string, number> = {
          'every6h': 6,
          'every12h': 12,
          'daily': 24,
          'weekly': 168,
        };
        const hours = hoursPerFrequency[settings.frequency] || 24;
        nextBackupTime = new Date(lastBackup.getTime() + hours * 60 * 60 * 1000);

        const diffMs = nextBackupTime.getTime() - Date.now();
        if (diffMs > 0) {
          const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
          const diffMinutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
          if (diffHours > 24) {
            const days = Math.floor(diffHours / 24);
            timeUntilNextBackup = `${days} يوم و ${diffHours % 24} ساعة`;
          } else if (diffHours > 0) {
            timeUntilNextBackup = `${diffHours} ساعة و ${diffMinutes} دقيقة`;
          } else {
            timeUntilNextBackup = `${diffMinutes} دقيقة`;
          }
        } else {
          timeUntilNextBackup = 'الآن (بانتظار الزيارة القادمة)';
        }
      }
    }

    // إحصائيات
    const totalBackups = await db.backupLog.count({ where: { status: 'success' } });
    const failedBackups = await db.backupLog.count({ where: { status: 'failed' } });
    const autoBackups = await db.backupLog.count({ where: { type: 'auto', status: 'success' } });
    const manualBackups = await db.backupLog.count({ where: { type: 'manual', status: 'success' } });
    const restoreCount = await db.backupLog.count({ where: { type: 'restore', status: 'success' } });

    // آخر 10 سجلات
    const recentLogs = await db.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // حجم النسخ الاحتياطية على القرص
    const backupDir = path.join(process.cwd(), settings.backupLocation || 'download/backups');
    let diskSize = 0;
    let filesCount = 0;
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(f => (f.startsWith('backup-') || f.startsWith('uploaded-')) && f.endsWith('.db'));
      filesCount = backupFiles.length;
      for (const f of backupFiles) {
        const stat = await fs.stat(path.join(backupDir, f));
        diskSize += stat.size;
      }
    } catch {}

    // === معلومات النسخ السحابي ===
    const [providerRow, cloudFreqRow, lastCloudSyncRow, lastCloudStatusRow, lastCloudErrorRow] = await Promise.all([
      db.setting.findUnique({ where: { key: 'cloud_backup_provider' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_frequency' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_last_sync' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_last_status' } }),
      db.setting.findUnique({ where: { key: 'cloud_backup_last_error' } }),
    ]);

    const cloudProvider = providerRow?.value || 'none';
    const cloudFreq = cloudFreqRow?.value || 'manual';
    const lastCloudSync = lastCloudSyncRow?.value ? new Date(lastCloudSyncRow.value) : null;
    const lastCloudStatus = lastCloudStatusRow?.value || 'never';
    const lastCloudError = lastCloudErrorRow?.value || '';

    // حساب موعد النسخ السحابي القادم
    let nextCloudBackupTime: Date | null = null;
    let timeUntilNextCloudBackup: string = '';
    if (cloudProvider !== 'none' && cloudFreq !== 'manual' && lastCloudSync) {
      const cloudHoursPerFreq: Record<string, number> = {
        'every6h': 6,
        'every12h': 12,
        'daily': 24,
        'weekly': 168,
      };
      const hours = cloudHoursPerFreq[cloudFreq] || 24;
      nextCloudBackupTime = new Date(lastCloudSync.getTime() + hours * 60 * 60 * 1000);
      const diffMs = nextCloudBackupTime.getTime() - Date.now();
      if (diffMs > 0) {
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        const diffMinutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        if (diffHours > 24) {
          const days = Math.floor(diffHours / 24);
          timeUntilNextCloudBackup = `${days} يوم و ${diffHours % 24} ساعة`;
        } else if (diffHours > 0) {
          timeUntilNextCloudBackup = `${diffHours} ساعة و ${diffMinutes} دقيقة`;
        } else {
          timeUntilNextCloudBackup = `${diffMinutes} دقيقة`;
        }
      } else {
        timeUntilNextCloudBackup = 'الآن (بانتظار الزيارة القادمة)';
      }
    }

    return NextResponse.json({
      settings: {
        autoBackupEnabled: settings.autoBackupEnabled,
        frequency: settings.frequency,
        scheduledTime: settings.scheduledTime,
        maxBackups: settings.maxBackups,
        notifyOnAutoBackup: settings.notifyOnAutoBackup,
        notifyOnBackupFailure: settings.notifyOnBackupFailure,
        backupLocation: settings.backupLocation,
        compressBackups: settings.compressBackups,
        includeUploads: settings.includeUploads,
        lastAutoBackupAt: settings.lastAutoBackupAt,
        lastManualBackupAt: settings.lastManualBackupAt,
        lastRestoreAt: settings.lastRestoreAt,
      },
      nextBackupTime,
      timeUntilNextBackup,
      stats: {
        totalBackups,
        failedBackups,
        autoBackups,
        manualBackups,
        restoreCount,
        diskSizeMB: (diskSize / 1024 / 1024).toFixed(2),
        filesCount,
      },
      cloud: {
        provider: cloudProvider,
        frequency: cloudFreq,
        lastSync: lastCloudSync,
        lastStatus: lastCloudStatus,
        lastError: lastCloudError,
        nextCloudBackupTime,
        timeUntilNextCloudBackup,
      },
      recentLogs,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/backup/status error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
