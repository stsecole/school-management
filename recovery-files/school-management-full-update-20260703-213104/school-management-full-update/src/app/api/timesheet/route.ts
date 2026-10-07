import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/** Parse "HH:MM" → minutes since midnight */
function parseTime(time: string | null | undefined): number | null {
  if (!time || !time.match(/^\d{1,2}:\d{2}$/)) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Calculate total hours from check-in/out times (2 periods) */
function calculateHours(checkIn1?: string, checkOut1?: string, checkIn2?: string, checkOut2?: string): number {
  let totalMinutes = 0;
  const ci1 = parseTime(checkIn1);
  const co1 = parseTime(checkOut1);
  const ci2 = parseTime(checkIn2);
  const co2 = parseTime(checkOut2);
  if (ci1 !== null && co1 !== null) {
    let diff = co1 - ci1;
    if (diff < 0) diff += 24 * 60;
    totalMinutes += diff;
  }
  if (ci2 !== null && co2 !== null) {
    let diff = co2 - ci2;
    if (diff < 0) diff += 24 * 60;
    totalMinutes += diff;
  }
  return Math.round((totalMinutes / 60) * 100) / 100;
}

// GET /api/timesheet - list timesheets (own for employee, all for director)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    // Employees can only see their own timesheets
    if (user.role !== 'director') {
      where.userId = user.id;
    } else if (userId && userId !== 'all') {
      where.userId = userId;
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const timesheets = await db.employeeTimesheet.findMany({
      where,
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ timesheets });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/timesheet error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/timesheet - create or update a timesheet entry
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const date = new Date(body.date);
    const dayOfWeek = date.getDay();

    // Employees can only create their own; directors can create for anyone
    const targetUserId = user.role === 'director' ? (body.userId || user.id) : user.id;

    // Calculate hours
    const totalHours = calculateHours(body.checkIn1, body.checkOut1, body.checkIn2, body.checkOut2);
    const regularHours = body.regularHours ? parseFloat(body.regularHours) : totalHours;
    const overtimeHours = body.overtimeHours ? parseFloat(body.overtimeHours) : Math.max(0, totalHours - 8);
    const sickHours = body.sickHours ? parseFloat(body.sickHours) : 0;
    const leaveHours = body.leaveHours ? parseFloat(body.leaveHours) : 0;

    const status = body.status || (totalHours > 0 ? 'present' : 'absent');

    // Check if entry exists for this date+user
    const existing = await db.employeeTimesheet.findFirst({
      where: { userId: targetUserId, date: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()), lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) } },
    });

    let timesheet;
    if (existing) {
      timesheet = await db.employeeTimesheet.update({
        where: { id: existing.id },
        data: {
          checkIn1: body.checkIn1 || null,
          checkOut1: body.checkOut1 || null,
          checkIn2: body.checkIn2 || null,
          checkOut2: body.checkOut2 || null,
          totalHours,
          regularHours,
          overtimeHours,
          sickHours,
          leaveHours,
          status,
          notes: body.notes || null,
        },
        include: { user: { select: { id: true, name: true, username: true, role: true } } },
      });
    } else {
      timesheet = await db.employeeTimesheet.create({
        data: {
          userId: targetUserId,
          date,
          dayOfWeek,
          checkIn1: body.checkIn1 || null,
          checkOut1: body.checkOut1 || null,
          checkIn2: body.checkIn2 || null,
          checkOut2: body.checkOut2 || null,
          totalHours,
          regularHours,
          overtimeHours,
          sickHours,
          leaveHours,
          status,
          notes: body.notes || null,
        },
        include: { user: { select: { id: true, name: true, username: true, role: true } } },
      });
    }

    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/timesheet error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
