import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkSessionConflicts, SessionInput } from '@/lib/timetable/conflict-engine';
import { getBranchFilter } from '@/lib/branch-filter';

// POST /api/timetable/check-conflict
// Body: { dayOfWeek, startTime, endTime, teacherId, roomId, groupId, subjectId, excludeId? }
// Returns: { hasConflicts, errors, warnings }
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const branchFilter = await getBranchFilter();
    const whereClause: any = { ...branchFilter };
    if (body.excludeId) {
      whereClause.NOT = { id: body.excludeId };
    }

    const existingSessions = await db.timetableSession.findMany({ where: whereClause });
    const rooms = await db.room.findMany({ where: branchFilter });
    const subjects = await db.subject.findMany({ where: branchFilter });
    const holidays = await db.holiday.findMany({ where: branchFilter });
    const workSettings = (await db.workSettings.findFirst({ where: branchFilter })) || {
      workDays: '0,1,2,3,4',
      workStartTime: '08:00',
      workEndTime: '18:00',
      maxTeacherHoursPerWeek: 20,
      maxSessionsPerDay: 4,
    };

    const sessionInput: SessionInput = {
      id: body.excludeId,
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

    const result = checkSessionConflicts(sessionInput, existingSessions as any, {
      rooms: rooms as any,
      subjects: subjects as any,
      holidays: holidays as any,
      workSettings: workSettings as any,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('check-conflict:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
