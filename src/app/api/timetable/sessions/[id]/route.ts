import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireTimetableManage } from '@/lib/auth';
import { checkSessionConflicts, SessionInput } from '@/lib/timetable/conflict-engine';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireTimetableManage();
    const { id } = await params;
    const body = await request.json();

    // Conflict detection (exclude current session)
    const existingSessions = await db.timetableSession.findMany({
      where: { NOT: { id } },
    });
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
      id,
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
          error: 'يوجد تعارض يمنع التحديث',
          conflicts: conflictResult.errors,
          warnings: conflictResult.warnings,
        },
        { status: 409 }
      );
    }

    const session = await db.timetableSession.update({
      where: { id },
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
      },
      include: {
        teacher: true,
        room: true,
        group: { include: { department: true, specialization: true } },
        subject: { include: { department: true, specialization: true } },
      },
    });

    return NextResponse.json({ session, warnings: conflictResult.warnings });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('PUT session:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireTimetableManage();
    const { id } = await params;
    await db.timetableSession.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الحصة' });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'حذف الحصص متاح للمدير أو الموظفين المخولين فقط' }, { status: 403 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
