import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function computeDurationMinutes(start: string, end: string): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Validate time fields
    if (!body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'يرجى إدخال وقت البداية ووقت النهاية' },
        { status: 400 }
      );
    }

    const startTime = String(body.startTime).trim();
    const endTime = String(body.endTime).trim();

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

    const durationMinutes = computeDurationMinutes(startTime, endTime);

    if (durationMinutes <= 0) {
      return NextResponse.json(
        { error: 'وقت النهاية يجب أن يكون بعد وقت البداية' },
        { status: 400 }
      );
    }

    if (durationMinutes > 12 * 60) {
      return NextResponse.json(
        { error: 'المدة المحسوبة كبيرة جداً (أكثر من 12 ساعة). يرجى التحقق من وقت البداية والنهاية.' },
        { status: 400 }
      );
    }

    const timeSlot = `${startTime} - ${endTime}`;

    const attendance = await db.attendance.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        courseId: body.courseId || null,
        courseName: body.courseName,
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
      },
      include: { teacher: true, course: true },
    });

    return NextResponse.json({ attendance });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await db.attendance.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف سجل الحضور' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
