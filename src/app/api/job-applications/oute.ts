// ===== GET/POST /api/job-applications =====
// إدارة طلبات العمل

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

// GET — قائمة الطلبات (مفلترة بالفرع)
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { whatsapp: { contains: search } },
        { diploma: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'all') where.status = status;

    const applications = await db.jobApplication.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
    });

    return NextResponse.json({ applications });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/job-applications error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}

// POST — إضافة طلب جديد
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'الاسم واللقب مطلوبان' }, { status: 400 });
    }

    const branchId = await getBranchIdForNewRecord();

    let birthDate: Date | null = null;
    if (body.birthDate) {
      try {
        birthDate = new Date(body.birthDate);
        if (isNaN(birthDate.getTime())) birthDate = null;
      } catch {}
    }

    const application = await db.jobApplication.create({
      data: {
        name: body.name.trim(),
        birthDate,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        diploma: body.diploma?.trim() || null,
        experience: body.experience?.trim() || null,
        address: body.address?.trim() || null,
        note: body.note?.trim() || null,
        cvUrl: body.cvUrl || null,
        diplomaUrl: body.diplomaUrl || null,
        status: body.status || 'pending',
        branchId,
      },
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/job-applications error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
