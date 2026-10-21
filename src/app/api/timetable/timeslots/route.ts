import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

export async function GET() {
  try {
    await requireAuth();
    const branchFilter = await getBranchFilter();
    const timeSlots = await db.timeSlot.findMany({
      where: branchFilter,
      orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
    });
    return NextResponse.json({ timeSlots });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const timeSlot = await db.timeSlot.create({
      data: {
        name: body.name,
        dayOfWeek: parseInt(body.dayOfWeek),
        startTime: body.startTime,
        endTime: body.endTime,
        order: parseInt(body.order) || 0,
        branchId: await getBranchIdForNewRecord(),
      },
    });
    return NextResponse.json({ timeSlot }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
