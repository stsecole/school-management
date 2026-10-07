import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireTimetableManage } from '@/lib/auth';
import { checkSessionConflicts, SessionInput } from '@/lib/timetable/conflict-engine';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const roomId = searchParams.get('roomId');
    const groupId = searchParams.get('groupId');
    const subjectId = searchParams.get('subjectId');
    const dayOfWeek = searchParams.get('dayOfWeek');

    const where: any = {};
    if (teacherId && teacherId !== 'all') where.teacherId = teacherId;
    if (roomId && roomId !== 'all') where.roomId = roomId;
    if (groupId && groupId !== 'all') where.groupId = groupId;
    if (subjectId && subjectId !== 'all') where.subjectId = subjectId;
    if (dayOfWeek !== null && dayOfWeek !== undefined && dayOfWeek !== 'all') {
      where.dayOfWeek = parseInt(dayOfWeek);
    }

    const sessions = await db.timetableSession.findMany({
      where,
      include: {
        teacher: true,
        room: true,
        group: { include: { department: true, specialization: true } },
        subject: { include: { department: true, specialization: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({ sessions });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET sessions:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireTimetableManage();
    const body = await request.json();

    // ===== Conflict Detection =====
    const existingSessions = await db.timetableSession.findMany();
    const rooms = await db.room.findMany();
    const subjects = await db.subject.findMany();
    const holidays = await db.holiday.findMany();
    const workSettings = (await db.workSettings.findFirst()) || {
      workDays: '0,1,2,3,4',
      workStartTime: '08:00',
      workEndTime: '18:00',
      maxTeacherHoursPerWeek: 20,
      maxSessionsPerDay: 4,
    };

    const sessionInput: SessionInput = {
      dayOfWeek: parseInt(body.dayOfWeek),
      startTime: body.startTime,
      endTime: body.endTime,
      teacherId: body.teacherId || undefined,
      teacherName: body.teacherName || undefined,
      roomId: body.roomId || undefined,
      roomName: body.roomName || undefined,
      groupId: body.groupId || undefined,
      groupName: body.groupName || undefined,
      subjectId: body.subjectId || undefined,
      subjectName: body.subjectName || undefined,
    };

    const conflictResult = checkSessionConflicts(sessionInput, existingSessions as any, {
      rooms: rooms as any,
      subjects: subjects as any,
      holidays: holidays as any,
      workSettings: workSettings as any,
    });

    if (conflictResult.hasConflicts) {
      return NextResponse.json(
        {
          error: 'يوجد تعارض يمنع الحفظ',
          conflicts: conflictResult.errors,
          warnings: conflictResult.warnings,
        },
        { status: 409 }
      );
    }

    // If no errors, create the session
    const session = await db.timetableSession.create({
      data: {
        dayOfWeek: parseInt(body.dayOfWeek),
        startTime: body.startTime,
        endTime: body.endTime,
        teacherId: body.teacherId || null,
        teacherName: body.teacherName || null,
        roomId: body.roomId || null,
        roomName: body.roomName || null,
        groupId: body.groupId || null,
        groupName: body.groupName || null,
        subjectId: body.subjectId || null,
        subjectName: body.subjectName || null,
        notes: body.notes || null,
        color: body.color || null,
        timeSlotId: body.timeSlotId || null,
      },
      include: {
        teacher: true,
        room: true,
        group: { include: { department: true, specialization: true } },
        subject: { include: { department: true, specialization: true } },
      },
    });

    return NextResponse.json({ session, warnings: conflictResult.warnings }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'إدارة الجدول متاحة للمدير أو الموظفين المخولين فقط' }, { status: 403 });
    console.error('POST session:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
