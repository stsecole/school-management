import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/leads/[id] - تفاصيل العميل المحتمل مع كل المتابعات
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        followUps: { orderBy: { date: 'desc' } },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/leads/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT /api/leads/[id] - تحديث بيانات العميل المحتمل
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    const lead = await db.lead.update({
      where: { id },
      data: {
        fullName: body.fullName !== undefined ? body.fullName : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        phone2: body.phone2 !== undefined ? (body.phone2 || null) : undefined,
        email: body.email !== undefined ? (body.email || null) : undefined,
        gender: body.gender !== undefined ? (body.gender || null) : undefined,
        birthDate:
          body.birthDate !== undefined
            ? body.birthDate
              ? new Date(body.birthDate)
              : null
            : undefined,
        wilaya: body.wilaya !== undefined ? (body.wilaya || null) : undefined,
        baladia: body.baladia !== undefined ? (body.baladia || null) : undefined,
        address: body.address !== undefined ? (body.address || null) : undefined,
        source: body.source !== undefined ? body.source : undefined,
        desiredCourse:
          body.desiredCourse !== undefined ? (body.desiredCourse || null) : undefined,
        desiredBranch:
          body.desiredBranch !== undefined ? (body.desiredBranch || null) : undefined,
        assignedTo:
          body.assignedTo !== undefined ? (body.assignedTo || null) : undefined,
        nextFollowUpDate:
          body.nextFollowUpDate !== undefined
            ? body.nextFollowUpDate
              ? new Date(body.nextFollowUpDate)
              : null
            : undefined,
        status: body.status !== undefined ? body.status : undefined,
        interestLevel:
          body.interestLevel !== undefined ? body.interestLevel : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
        lastModifiedBy: user.name,
      },
      include: {
        followUps: { orderBy: { date: 'desc' } },
      },
    });

    return NextResponse.json({ lead });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/leads/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}

// DELETE /api/leads/[id] - حذف العميل المحتمل (فقط إذا لم يُحوّل لطالب)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }
    if (lead.convertedToStudentId) {
      return NextResponse.json(
        { error: 'لا يمكن حذف عميل تم تحويله إلى طالب' },
        { status: 400 }
      );
    }

    // حذف المتابعات أولاً ثم العميل
    await db.leadFollowUp.deleteMany({ where: { leadId: id } });
    await db.lead.delete({ where: { id } });

    return NextResponse.json({ message: 'تم حذف العميل المحتمل' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/leads/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}
