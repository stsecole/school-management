import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    let settings = await db.workSettings.findFirst();
    if (!settings) {
      settings = await db.workSettings.create({ data: {} });
    }
    return NextResponse.json({ settings });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    let settings = await db.workSettings.findFirst();
    const data = {
      workDays: body.workDays || '0,1,2,3,4',
      workStartTime: body.workStartTime || '08:00',
      workEndTime: body.workEndTime || '18:00',
      sessionDuration: parseInt(body.sessionDuration) || 120,
      breakDuration: parseInt(body.breakDuration) || 15,
      maxTeacherHoursPerWeek: parseInt(body.maxTeacherHoursPerWeek) || 20,
      maxSessionsPerDay: parseInt(body.maxSessionsPerDay) || 4,
    };
    if (settings) {
      settings = await db.workSettings.update({ where: { id: settings.id }, data });
    } else {
      settings = await db.workSettings.create({ data });
    }
    return NextResponse.json({ settings });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
