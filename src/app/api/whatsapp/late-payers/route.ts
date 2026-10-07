import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/whatsapp/late-payers
 * الطلاب المتأخرون في الدفع (للأقساط العادية)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // كل الطلاب النشطون
    const students = await db.student.findMany({
      where: { status: { in: ['registered', 'continuing'] }, phone: { not: null } },
      include: {
        department: { select: { name: true } },
        payments: {
          where: { paymentDate: { gte: monthStart } },
          select: { amount: true },
        },
      },
    });

    // ابحث عن المتأخرين (لم يدفعوا هذا الشهر)
    const latePayers = students
      .map((s) => {
        const paidThisMonth = s.payments.reduce((sum, p) => sum + p.amount, 0);
        const expectedAmount = s.department?.name === 'التقني سامي' ? 2500 : 1500;
        return {
          id: s.id,
          name: s.name,
          phone: s.phone || '',
          department: s.department?.name || '',
          paidThisMonth,
          expectedAmount,
          dueAmount: Math.max(0, expectedAmount - paidThisMonth),
        };
      })
      .filter((s) => s.dueAmount > 0 && s.phone);

    return NextResponse.json({
      latePayers,
      total: latePayers.length,
      totalDue: latePayers.reduce((sum, s) => sum + s.dueAmount, 0),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/whatsapp/late-payers error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
