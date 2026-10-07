import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Parse "HH:MM" time string into total minutes since midnight.
 */
function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Compute duration in minutes between start and end times.
 * Handles overnight (end < start) by adding 24h.
 */
function computeDurationMinutes(start: string, end: string): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // overnight
  return diff;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const teacherId = searchParams.get('teacherId');

    const where: any = {};
    if (search) {
      where.OR = [
        { courseName: { contains: search } },
        { teacherName: { contains: search } },
        { level: { contains: search } },
      ];
    }
    if (teacherId && teacherId !== 'all') where.teacherId = teacherId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const attendances = await db.attendance.findMany({
      where,
      include: { teacher: true, course: true },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ attendances });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    // Validate required time fields
    if (!body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'يرجى إدخال وقت البداية ووقت النهاية' },
        { status: 400 }
      );
    }

    const startTime = String(body.startTime).trim();
    const endTime = String(body.endTime).trim();

    // Validate time format
    if (!/^\d{1,2}:\d{2}$/.test(startTime) || !/^\d{1,2}:\d{2}$/.test(endTime)) {
      return NextResponse.json(
        { error: 'صيغة الوقت غير صحيحة. استخدم الصيغة HH:MM مثل 08:00' },
        { status: 400 }
      );
    }

    if (parseTimeToMinutes(startTime) === null || parseTimeToMinutes(endTime) === null) {
      return NextResponse.json(
        { error: 'قيمة الوقت غير صالحة' },
        { status: 400 }
      );
    }

    // Compute duration in minutes
    const durationMinutes = computeDurationMinutes(startTime, endTime);

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'وقت النهاية يجب أن يكون بعد وقت البداية' },
        { status: 400 }
      );
    }

    // Warn on suspiciously long sessions (more than 12 hours = likely input error)
    if (durationMinutes > 12 * 60) {
      return NextResponse.json(
        { error: 'المدة المحسوبة كبيرة جداً (أكثر من 12 ساعة). يرجى التحقق من وقت البداية والنهاية.' },
        { status: 400 }
      );
    }

    // Auto-generate timeSlot display string
    const timeSlot = `${startTime} - ${endTime}`;

    const attendance = await db.attendance.create({
      data: {
        date: body.date ? new Date(body.date) : new Date(),
        courseId: body.courseId || null,
        courseName: body.courseName || '',
        level: body.level || null,
        startTime,
        endTime,
        timeSlot,
        teacherId: body.teacherId || null,
        teacherName: body.teacherName || null,
        totalCount: parseInt(body.totalCount) || 0,
        maleCount: parseInt(body.maleCount) || 0,
        femaleCount: parseInt(body.femaleCount) || 0,
        durationMinutes,
        unpaidCount: parseInt(body.unpaidCount) || 0,
        notes: body.notes || null,
        studentId: body.studentId || null,
      },
      include: { teacher: true, course: true },
    });

    return NextResponse.json({ attendance }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/attendance error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
