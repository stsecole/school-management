import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/leads/[id]/follow-ups - قائمة متابعات العميل
export async function GET(
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

    const followUps = await db.leadFollowUp.findMany({
      where: { leadId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ followUps });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/leads/[id]/follow-ups error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/leads/[id]/follow-ups - إضافة متابعة جديدة + تحديث تواريخ العميل
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    // إنشاء المتابعة
    const followUp = await db.leadFollowUp.create({
      data: {
        leadId: id,
        date: body.date ? new Date(body.date) : new Date(),
        userName: body.userName || user.name,
        contactType: body.contactType || 'call',
        notes: body.notes || null,
        result: body.result || null,
        nextFollowUpDate: body.nextFollowUpDate
          ? new Date(body.nextFollowUpDate)
          : null,
      },
    });

    // تحديث تواريخ آخر/تالي متابعة على العميل
    const followUpDate = body.date ? new Date(body.date) : new Date();
    await db.lead.update({
      where: { id },
      data: {
        lastFollowUpDate: followUpDate,
        nextFollowUpDate: body.nextFollowUpDate
          ? new Date(body.nextFollowUpDate)
          : null,
        lastModifiedBy: user.name,
      },
    });

    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/leads/[id]/follow-ups error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المتابعة' }, { status: 500 });
  }
}
