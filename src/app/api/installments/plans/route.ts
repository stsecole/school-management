import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/installments/plans
 * قائمة جميع خطط الدفع
 */
export async function GET() {
  try {
    await requireAuth();
    const plans = await db.paymentPlan.findMany({
      include: {
        _count: { select: { installments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ plans });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/installments/plans error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * POST /api/installments/plans
 * إنشاء خطة دفع جديدة + توليد أقساط لكل الطلاب
 * Body: { name, description?, totalAmount, monthsCount, startDate, studentIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, totalAmount, monthsCount, startDate, studentIds } = body;

    if (!name || !totalAmount || !monthsCount || !startDate || !studentIds || !Array.isArray(studentIds)) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const monthlyAmount = Math.round((totalAmount / monthsCount) * 100) / 100;
    const start = new Date(startDate);

    // إنشاء خطة الدفع
    const plan = await db.paymentPlan.create({
      data: {
        name,
        description: description || null,
        totalAmount: parseFloat(totalAmount),
        monthsCount: parseInt(monthsCount),
        monthlyAmount,
        startDate: start,
        active: true,
      },
    });

    // توليد أقساط لكل طالب
    const installmentsData: any[] = [];
    for (const studentId of studentIds) {
      for (let i = 0; i < monthsCount; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);
        installmentsData.push({
          paymentPlanId: plan.id,
          studentId,
          amount: monthlyAmount,
          installmentNumber: i + 1,
          dueDate,
          status: 'PENDING',
        });
      }
    }

    await db.installment.createMany({ data: installmentsData });

    return NextResponse.json({
      plan,
      installmentsCreated: installmentsData.length,
      studentsCount: studentIds.length,
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST /api/installments/plans error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم', details: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/installments/plans
 * تعديل خطة دفع (تفعيل/إلغاء)
 * Body: { id, active? }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }

    const body = await request.json();
    const { id, active } = body;

    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });

    const plan = await db.paymentPlan.update({
      where: { id },
      data: { active: active !== undefined ? active : undefined },
    });

    return NextResponse.json({ plan });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('PUT /api/installments/plans error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * DELETE /api/installments/plans?id=xxx
 * حذف خطة دفع + كل أقساطها
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== 'director') {
      return NextResponse.json({ error: 'صلاحيات مدير مطلوبة' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID مطلوب' }, { status: 400 });

    await db.paymentPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('DELETE /api/installments/plans error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
