import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { db } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/backup/list
 * (المدير فقط)
 * يعرض قائمة بكل النسخ الاحتياطية المتوفرة مع الحجم وتاريخ الإنشاء
 * يضيف معلومات الفرع (بادئة) لكل نسخة
 */

// دالة لجلب خريطة بادئات الفروع
async function getBranchPrefixesMap(): Promise<Record<string, { name: string; code: string | null }>> {
  try {
    const branches = await db.branch.findMany({
      select: { name: true, code: true, receiptPrefix: true },
    });
    const map: Record<string, { name: string; code: string | null }> = {};
    for (const b of branches) {
      const prefix = (b.receiptPrefix || b.code || '').toUpperCase().slice(0, 5);
      if (prefix) {
        map[prefix] = { name: b.name, code: b.code };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    await requireDirector();

    const backupDir = path.join(process.cwd(), 'download', 'backups');

    // التأكد من وجود المجلد
    try {
      await fs.access(backupDir);
    } catch {
      // المجلد غير موجود = لا توجد نسخ احتياطية بعد
      return NextResponse.json({ backups: [], totalSize: 0, count: 0 });
    }

    const files = await fs.readdir(backupDir);
    // عرض كل ملفات .db (backup-*, uploaded-*, backup-cloud-*)
    const backupFiles = files.filter(f =>
      f.endsWith('.db') &&
      !f.endsWith('-shm.db') &&
      !f.endsWith('-wal.db')
    );

    // خريطة بادئات الفروع لمطابقة الأسماء
    const branchMap = await getBranchPrefixesMap();

    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const filePath = path.join(backupDir, filename);
        const stats = await fs.stat(filePath);

        // تحديد نوع النسخة وبادئة الفرع
        let type: 'local' | 'cloud' | 'uploaded' | 'other' = 'other';
        let branchPrefix: string | null = null;
        let branchName: string | null = null;

        if (filename.startsWith('backup-cloud-')) {
          type = 'cloud';
          // backup-cloud-{PREFIX}-{timestamp}.db
          const match = filename.match(/^backup-cloud-([a-zA-Z0-9_-]+)-\d{8}-\d{6}\.db$/);
          if (match) {
            branchPrefix = match[1];
            const branchInfo = branchMap[branchPrefix];
            if (branchInfo) branchName = branchInfo.name;
          }
        } else if (filename.startsWith('uploaded-')) {
          type = 'uploaded';
        } else if (filename.startsWith('backup-')) {
          type = 'local';
          // backup-{PREFIX}-{timestamp}.db OR backup-{timestamp}.db (قديم)
          const match = filename.match(/^backup-([a-zA-Z0-9_]+)-(\d{8}-\d{6})\.db$/);
          if (match) {
            branchPrefix = match[1];
            const branchInfo = branchMap[branchPrefix];
            if (branchInfo) branchName = branchInfo.name;
          } else {
            // نسخة قديمة بدون بادئة فرع
            branchPrefix = 'LEGACY';
            branchName = 'نسخة قديمة';
          }
        }

        return {
          filename,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
          type,
          branchPrefix,
          branchName,
        };
      })
    );

    // ترتيب تنازلي حسب التاريخ
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return NextResponse.json({
      backups,
      count: backups.length,
      totalSize,
      lastBackup: backups[0]?.createdAt || null,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/backup/list error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
