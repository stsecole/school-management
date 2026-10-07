import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * POST /api/backup/run
 * (المدير فقط)
 * ينسخ قاعدة البيانات db/custom.db إلى download/backups/
 * اسم النسخة يحتوي على بادئة الفرع (X, Y, Z) لتمييز النسخ من فروع مختلفة
 *
 * صيغة الاسم: backup-{PREFIX}-{timestamp}.db
 * مثال: backup-X-20260807-143000.db
 * مثال: backup-Y-20260807-143000.db
 */

// دالة مساعدة: جلب بادئة الفرع النشط
async function getActiveBranchPrefix(): Promise<{ prefix: string; name: string; code: string | null } | null> {
  try {
    const activeBranchId = await getBranchIdForNewRecord();
    if (!activeBranchId) return null;

    const branch = await db.branch.findUnique({
      where: { id: activeBranchId },
      select: { name: true, code: true, receiptPrefix: true },
    });

    if (!branch) return null;

    // استخدم receiptPrefix (X, Y, Z) أو code كـ fallback
    const prefix = (branch.receiptPrefix || branch.code || 'MAIN')
      .replace(/[^a-zA-Z0-9_-]/g, '') // إزالة الرموز الخاصة
      .slice(0, 5) // حد أقصى 5 أحرف
      .toUpperCase();

    return {
      prefix: prefix || 'MAIN',
      name: branch.name || 'الفرع الرئيسي',
      code: branch.code,
    };
  } catch (err) {
    console.log('Could not get branch prefix:', err.message);
    return null;
  }
}

export async function POST() {
  try {
    await requireDirector();

    const sourcePath = path.join(process.cwd(), 'db', 'custom.db');
    const backupDir = path.join(process.cwd(), 'download', 'backups');

    // التأكد من وجود المجلد
    await fs.mkdir(backupDir, { recursive: true });

    // التحقق من وجود الملف المصدر
    try {
      await fs.access(sourcePath);
    } catch {
      return NextResponse.json({ error: 'قاعدة البيانات غير موجودة' }, { status: 404 });
    }

    // إنشاء اسم الملف بالطابع الزمني + بادئة الفرع
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    // جلب بادئة الفرع النشط
    const branchInfo = await getActiveBranchPrefix();
    const branchPrefix = branchInfo?.prefix || 'MAIN';

    // صيغة الاسم: backup-{PREFIX}-{timestamp}.db
    const filename = `backup-${branchPrefix}-${timestamp}.db`;
    const destPath = path.join(backupDir, filename);

    // WAL checkpoint لضمان اكتمال البيانات
    try {
      await db.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;
    } catch (e) {
      console.log('WAL checkpoint failed (non-fatal):', e);
    }
    await new Promise(resolve => setTimeout(resolve, 300));

    // نسخ الملف
    const data = await fs.readFile(sourcePath);
    await fs.writeFile(destPath, data);

    const size = (await fs.stat(destPath)).size;

    // ===== الاحتفاظ بآخر N نسخة لكل بادئة فرع =====
    // اقرأ الإعدادات للحصول على maxBackups
    let settings = await db.backupSettings.findFirst();
    const maxBackups = settings?.maxBackups || 30;

    const files = await fs.readdir(backupDir);
    // فلترة النسخ بنفس بادئة الفرع الحالي
    const samePrefixPattern = new RegExp(`^backup-${branchPrefix}-\\d{8}-\\d{6}\\.db$`);
    const allBackupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.db'));

    // النسخ بنفس البادئة
    const samePrefixFiles = allBackupFiles.filter(f => samePrefixPattern.test(f));
    // ترتيب تنازلي (الأحدث أولاً)
    samePrefixFiles.sort().reverse();
    // حذف الزائد عن maxBackups لنفس البادئة
    const toDelete = samePrefixFiles.slice(maxBackups);
    for (const f of toDelete) {
      try {
        await fs.unlink(path.join(backupDir, f));
      } catch {}
    }

    // تحديث lastManualBackupAt في الإعدادات
    if (!settings) {
      settings = await db.backupSettings.create({
        data: { lastManualBackupAt: now },
      });
    } else {
      await db.backupSettings.update({
        where: { id: settings.id },
        data: { lastManualBackupAt: now },
      });
    }

    return NextResponse.json({
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      filename,
      size,
      createdAt: now.toISOString(),
      deletedOld: toDelete.length,
      branch: branchInfo ? {
        prefix: branchInfo.prefix,
        name: branchInfo.name,
        code: branchInfo.code,
      } : null,
      checkpoint: true,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('POST /api/backup/run error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء النسخ الاحتياطي: ' + (error.message || '') }, { status: 500 });
  }
}
