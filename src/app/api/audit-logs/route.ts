import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

/**
 * GET /api/audit-logs
 * عرض سجل النشاط (للمدير فقط)
 * - فلترة حسب: المستخدم، الوحدة، نوع العملية، التاريخ
 * - ترقيم الصفحات
 */
export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {};
    if (userId) where.userId = userId;
    if (module && module !== 'all') where.module = module;
    if (action && action !== 'all') where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.auditLog.count({ where }),
    ]);

    // إحصائيات سريعة
    const stats = {
      total,
      today: await db.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      createCount: await db.auditLog.count({ where: { ...where, action: 'create' } }),
      updateCount: await db.auditLog.count({ where: { ...where, action: 'update' } }),
      deleteCount: await db.auditLog.count({ where: { ...where, action: 'delete' } }),
    };

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('GET /api/audit-logs error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/audit-logs
 * حذف السجلات القديمة (أقدم من X يوم) - للمدير فقط
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '90');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return NextResponse.json({
      message: `تم حذف ${result.count} سجل قديم (أقدم من ${olderThanDays} يوم)`,
      deleted: result.count,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('DELETE /api/audit-logs error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
