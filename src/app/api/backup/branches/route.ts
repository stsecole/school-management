// ===== GET /api/backup/branches?filename=xxx =====
// (المدير فقط) - يعرض الفروع المتوفرة في نسخة احتياطية محددة
// يدعم النسخ القديمة (بدون جدول Branch) والنسخ الحديثة

import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  let backupDb: PrismaClient | null = null;

  try {
    await requireDirector();

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'اسم الملف مطلوب' }, { status: 400 });
    }

    // Validate filename — accept all backup types
    if (!/^backup-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^backup-[a-zA-Z0-9_]+-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^uploaded-.+\.db$/.test(filename) &&
        !/^backup-cloud-.+\.db$/.test(filename)) {
      return NextResponse.json({ error: 'اسم الملف غير صالح' }, { status: 400 });
    }

    const backupPath = path.join(process.cwd(), 'download', 'backups', filename);

    // Verify file exists
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json({ error: 'النسخة الاحتياطية غير موجودة' }, { status: 404 });
    }

    // إنشاء Prisma client منفصل للاتصال بالنسخة الاحتياطية
    backupDb = new PrismaClient({
      datasources: {
        db: { url: `file:${backupPath}` },
      },
    });

    // اختبار الاتصال
    try {
      await backupDb.$queryRaw`SELECT 1 as test`;
    } catch (connErr: any) {
      return NextResponse.json({
        error: 'تعذر الاتصال بقاعدة بيانات النسخة الاحتياطية',
        details: connErr.message,
        filename,
      }, { status: 500 });
    }

    // ===== قراءة الفروع المتوفرة في النسخة =====
    let branches: any[] = [];
    let branchTableExists = true;

    try {
      branches = await backupDb.branch.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          receiptPrefix: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (branchErr: any) {
      // جدول Branch غير موجود - نسخة قديمة
      console.log('Branch table not found in backup:', branchErr.message);
      branchTableExists = false;
    }

    // ===== إذا كانت الفروع موجودة، اجلب الإحصائيات لكل فرع =====
    let branchesWithStats: any[] = [];

    if (branchTableExists && branches.length > 0) {
      branchesWithStats = await Promise.all(
        branches.map(async (branch) => {
          const [studentsCount, teachersCount, paymentsCount, expensesCount] = await Promise.all([
            backupDb!.student.count({ where: { branchId: branch.id } }).catch(() => 0),
            backupDb!.teacher.count({ where: { branchId: branch.id } }).catch(() => 0),
            backupDb!.studentPayment.count({ where: { branchId: branch.id } }).catch(() => 0),
            backupDb!.expense.count({ where: { branchId: branch.id } }).catch(() => 0),
          ]);
          return {
            ...branch,
            stats: {
              students: studentsCount,
              teachers: teachersCount,
              payments: paymentsCount,
              expenses: expensesCount,
            },
          };
        })
      );
    }

    // ===== إحصائيات النسخة الاحتياطية الإجمالية =====
    const totalStats = {
      branches: branches.length,
      students: await backupDb.student.count().catch(() => 0),
      teachers: await backupDb.teacher.count().catch(() => 0),
      payments: await backupDb.studentPayment.count().catch(() => 0),
      expenses: await backupDb.expense.count().catch(() => 0),
      hasBranchTable: branchTableExists,
    };

    // ===== إذا لم توجد فروع، ابحث عن "فرع افتراضي" من السجلات بدون branchId =====
    if (branchesWithStats.length === 0 && totalStats.students > 0) {
      // عد الطلاب بدون branchId (نسخة قديمة بدون نظام فروع)
      const studentsWithoutBranch = await backupDb.student.count({
        where: { branchId: null },
      }).catch(() => 0);

      if (studentsWithoutBranch > 0) {
        // أضف "فرع افتراضي" للبيانات بدون فرع
        branchesWithStats.push({
          id: 'no-branch',
          name: 'بيانات بدون فرع (نسخة قديمة)',
          code: 'LEGACY',
          receiptPrefix: null,
          isActive: true,
          stats: {
            students: studentsWithoutBranch,
            teachers: 0,
            payments: 0,
            expenses: 0,
          },
        });
      }
    }

    // ===== قائمة الجداول المتوفرة في النسخة =====
    let availableTables: string[] = [];
    try {
      const tablesResult = await backupDb.$queryRaw`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
        ORDER BY name
      ` as any[];
      availableTables = tablesResult.map((t: any) => t.name);
    } catch (e) {
      console.log('Could not list tables:', e.message);
    }

    return NextResponse.json({
      filename,
      branches: branchesWithStats,
      totalStats,
      availableTables,
      branchTableExists,
      legacyMode: branchesWithStats.length === 0,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/backup/branches error:', error);
    return NextResponse.json({
      error: 'حدث خطأ: ' + (error.message || ''),
      details: error.message,
    }, { status: 500 });
  } finally {
    // إغلاق اتصال النسخة الاحتياطية
    if (backupDb) {
      try {
        await backupDb.$disconnect();
      } catch {}
    }
  }
}
