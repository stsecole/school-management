import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/leads - قائمة العملاء المحتملين مع الفلاتر
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const assignedTo = searchParams.get('assignedTo');

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { phone2: { contains: search } },
        { email: { contains: search } },
        { desiredCourse: { contains: search } },
        { notes: { contains: search } },
      ];
    }
    if (status && status !== 'all') where.status = status;
    if (source && source !== 'all') where.source = source;
    if (assignedTo && assignedTo !== 'all') where.assignedTo = assignedTo;

    const leads = await db.lead.findMany({
      where,
      include: {
        _count: { select: { followUps: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ leads });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/leads error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/leads - إنشاء عميل محتمل جديد
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    if (!body.fullName || !body.phone) {
      return NextResponse.json(
        { error: 'الاسم ورقم الهاتف مطلوبان' },
        { status: 400 }
      );
    }

    const lead = await db.lead.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        phone2: body.phone2 || null,
        email: body.email || null,
        gender: body.gender || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        wilaya: body.wilaya || null,
        baladia: body.baladia || null,
        address: body.address || null,
        source: body.source || 'أخرى',
        desiredCourse: body.desiredCourse || null,
        desiredBranch: body.desiredBranch || null,
        assignedTo: body.assignedTo || null,
        firstContactDate: new Date(),
        nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null,
        status: body.status || 'new',
        interestLevel: body.interestLevel || 'medium',
        notes: body.notes || null,
        lastModifiedBy: user.name,
      },
      include: {
        _count: { select: { followUps: true } },
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/leads error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
