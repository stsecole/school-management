import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/installments/overdue-check
 * فحص + تحديث الأقساط المتأخرة (dueDate + 7 أيام → OVERDUE)
 */
export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const overdueThreshold = new Date();
    overdueThreshold.setDate(overdueThreshold.getDate() - 7); // +7 أيام من تاريخ الاستحقاق

    // تحديث الأقساط المتأخرة
    const result = await db.installment.updateMany({
      where: {
        status: { in: ['PENDING', 'DUE'] },
        dueDate: { lt: overdueThreshold },
      },
      data: { status: 'OVERDUE' },
    });

    // تحديث الأقساط المستحقة (تاريخ الاستحقاق قريب لكن لم يحن التأخير)
    const dueResult = await db.installment.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: now, gte: overdueThreshold },
      },
      data: { status: 'DUE' },
    });

    return NextResponse.json({
      overdueUpdated: result.count,
      dueUpdated: dueResult.count,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/installments/overdue-check error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
