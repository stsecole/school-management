// ===== GET/PUT /api/backup/settings =====
// (المدير فقط) - إدارة إعدادات النسخ الاحتياطي

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

// GET - جلب الإعدادات الحالية (ينشئ إعدادات افتراضية إذا لم تكن موجودة)
export async function GET() {
  try {
    await requireDirector();

    let settings = await db.backupSettings.findFirst();
    if (!settings) {
      // إنشاء إعدادات افتراضية
      settings = await db.backupSettings.create({
        data: {
          autoBackupEnabled: true,
          frequency: 'daily',
          scheduledTime: '02:00',
          maxBackups: 30,
          notifyOnAutoBackup: false,
          notifyOnBackupFailure: true,
          backupLocation: 'download/backups',
          compressBackups: false,
          includeUploads: false,
        },
      });
    }

    // إحصائيات النسخ الاحتياطية
    const totalBackups = await db.backupLog.count({ where: { status: 'success' } });
    const failedBackups = await db.backupLog.count({ where: { status: 'failed' } });
    const autoBackups = await db.backupLog.count({ where: { type: 'auto', status: 'success' } });
    const manualBackups = await db.backupLog.count({ where: { type: 'manual', status: 'success' } });
    const restoreCount = await db.backupLog.count({ where: { type: 'restore', status: 'success' } });

    return NextResponse.json({
      settings,
      stats: {
        totalBackups,
        failedBackups,
        autoBackups,
        manualBackups,
        restoreCount,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/backup/settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT - تحديث الإعدادات
export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    // التحقق من صحة القيم
    const validFrequencies = ['daily', 'every12h', 'every6h', 'weekly'];
    if (body.frequency && !validFrequencies.includes(body.frequency)) {
      return NextResponse.json({ error: 'تكرار غير صالح' }, { status: 400 });
    }

    // التحقق من صحة الوقت (HH:MM)
    if (body.scheduledTime && !/^\d{2}:\d{2}$/.test(body.scheduledTime)) {
      return NextResponse.json({ error: 'صيغة الوقت غير صالحة (استخدم HH:MM)' }, { status: 400 });
    }

    // التحقق من maxBackups
    if (body.maxBackups !== undefined) {
      const max = parseInt(body.maxBackups);
      if (isNaN(max) || max < 1 || max > 365) {
        return NextResponse.json({ error: 'عدد النسخ يجب أن يكون بين 1 و 365' }, { status: 400 });
      }
      body.maxBackups = max;
    }

    let settings = await db.backupSettings.findFirst();
    if (!settings) {
      // إنشاء إعدادات جديدة بالقيم المرسلة
      settings = await db.backupSettings.create({
        data: {
          autoBackupEnabled: body.autoBackupEnabled ?? true,
          frequency: body.frequency || 'daily',
          scheduledTime: body.scheduledTime || '02:00',
          maxBackups: body.maxBackups ?? 30,
          notifyOnAutoBackup: body.notifyOnAutoBackup ?? false,
          notifyOnBackupFailure: body.notifyOnBackupFailure ?? true,
          backupLocation: body.backupLocation || 'download/backups',
          compressBackups: body.compressBackups ?? false,
          includeUploads: body.includeUploads ?? false,
        },
      });
    } else {
      // تحديث الإعدادات الموجودة
      settings = await db.backupSettings.update({
        where: { id: settings.id },
        data: {
          ...(body.autoBackupEnabled !== undefined && { autoBackupEnabled: body.autoBackupEnabled }),
          ...(body.frequency && { frequency: body.frequency }),
          ...(body.scheduledTime && { scheduledTime: body.scheduledTime }),
          ...(body.maxBackups !== undefined && { maxBackups: body.maxBackups }),
          ...(body.notifyOnAutoBackup !== undefined && { notifyOnAutoBackup: body.notifyOnAutoBackup }),
          ...(body.notifyOnBackupFailure !== undefined && { notifyOnBackupFailure: body.notifyOnBackupFailure }),
          ...(body.backupLocation && { backupLocation: body.backupLocation }),
          ...(body.compressBackups !== undefined && { compressBackups: body.compressBackups }),
          ...(body.includeUploads !== undefined && { includeUploads: body.includeUploads }),
        },
      });
    }

    return NextResponse.json({
      settings,
      message: 'تم تحديث الإعدادات بنجاح',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('PUT /api/backup/settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
