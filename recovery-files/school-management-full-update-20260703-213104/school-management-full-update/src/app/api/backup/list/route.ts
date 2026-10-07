import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/backup/list
 * (المدير فقط)
 * يعرض قائمة بكل النسخ الاحتياطية المتوفرة مع الحجم وتاريخ الإنشاء
 */
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
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.db'));

    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const filePath = path.join(backupDir, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
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
