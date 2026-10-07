import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/leads/stats - إحصائيات لوحة تحكم CRM
export async function GET() {
  try {
    await requireAuth();

    const totalLeads = await db.lead.count();

    // العملاء الجدد اليوم
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const newToday = await db.lead.count({
      where: {
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    // العملاء المتحوّلون (مسجّلون)
    const converted = await db.lead.count({
      where: { convertedToStudentId: { not: null } },
    });

    const conversionRate = totalLeads > 0
      ? Math.round((converted / totalLeads) * 1000) / 10
      : 0;

    // التوزيع حسب الحالة
    const byStatusRaw = await db.lead.groupBy({
      by: ['status'],
      _count: true,
    });
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count;
    }

    // التوزيع حسب المصدر
    const bySourceRaw = await db.lead.groupBy({
      by: ['source'],
      _count: true,
    });
    const bySource: Record<string, number> = {};
    for (const row of bySourceRaw) {
      bySource[row.source] = row._count;
    }

    // العملاء الذين يحتاجون متابعة اليوم (nextFollowUpDate <= اليوم ولم يُحوّلوا)
    const needsFollowUpToday = await db.lead.count({
      where: {
        nextFollowUpDate: { lte: endOfToday },
        convertedToStudentId: null,
        status: { notIn: ['registered', 'rejected'] },
      },
    });

    // قائمة العملاء الذين يحتاجون متابعة اليوم
    const followUpTodayList = await db.lead.findMany({
      where: {
        nextFollowUpDate: { lte: endOfToday },
        convertedToStudentId: null,
        status: { notIn: ['registered', 'rejected'] },
      },
      orderBy: { nextFollowUpDate: 'asc' },
      take: 20,
      select: {
        id: true,
        fullName: true,
        phone: true,
        nextFollowUpDate: true,
        status: true,
        interestLevel: true,
        desiredCourse: true,
        source: true,
      },
    });

    return NextResponse.json({
      totalLeads,
      newToday,
      converted,
      conversionRate,
      needsFollowUpToday,
      byStatus,
      bySource,
      followUpTodayList,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/leads/stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
