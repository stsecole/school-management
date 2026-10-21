import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import { generateTimetable } from '@/lib/timetable/auto-generator';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

// POST /api/timetable/generate
// Body: { clearExisting?: boolean, subjectIds?: string[], groupIds?: string[] }
// Generates an auto timetable using the constraint satisfaction algorithm
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    const branchFilter = await getBranchFilter();
    const newBranchId = await getBranchIdForNewRecord();

    // Combine subject/group filter with branch filter
    const subjectWhere = { ...branchFilter, ...(body.subjectIds ? { id: { in: body.subjectIds } } : {}) };
    const groupWhere = { ...branchFilter, ...(body.groupIds ? { id: { in: body.groupIds } } : {}) };

    const subjects = await db.subject.findMany({ where: subjectWhere });
    const teachers = await db.teacher.findMany({ where: { ...branchFilter, status: 'active' } });
    const rooms = await db.room.findMany({ where: branchFilter });
    const groups = await db.group.findMany({ where: groupWhere });
    const holidays = await db.holiday.findMany({ where: branchFilter });
    const workSettings = (await db.workSettings.findFirst({ where: branchFilter })) ||
      (await db.workSettings.create({ data: { branchId: newBranchId } }));

    if (subjects.length === 0 || groups.length === 0 || rooms.length === 0) {
      return NextResponse.json(
        { error: 'يجب توفر مواد وأفواج وقاعات على الأقل قبل التوليد' },
        { status: 400 }
      );
    }

    // Get existing sessions (to preserve or clear) — scoped to current branch
    const existingSessions = body.clearExisting
      ? []
      : await db.timetableSession.findMany({ where: branchFilter });

    if (body.clearExisting) {
      await db.timetableSession.deleteMany({ where: branchFilter });
    }

    const result = generateTimetable({
      subjects: subjects as any,
      teachers: teachers.map(t => ({ id: t.id, name: t.name })),
      rooms: rooms as any,
      groups: groups.map(g => ({ id: g.id, name: g.name })),
      workSettings: workSettings as any,
      holidays: holidays as any,
      existingSessions: existingSessions as any,
    });

    // Save generated sessions to DB (with branchId)
    const created = [];
    for (const session of result.sessions) {
      const s = await db.timetableSession.create({
        data: {
          dayOfWeek: session.dayOfWeek,
          startTime: session.startTime,
          endTime: session.endTime,
          teacherId: session.teacherId || null,
          teacherName: session.teacherName || null,
          roomId: session.roomId || null,
          roomName: session.roomName || null,
          groupId: session.groupId || null,
          groupName: session.groupName || null,
          subjectId: session.subjectId || null,
          subjectName: session.subjectName || null,
          color: session.color || null,
          branchId: newBranchId,
        },
      });
      created.push(s);
    }

    return NextResponse.json({
      success: result.success,
      sessionsCreated: created.length,
      unassigned: result.unassigned,
      stats: result.stats,
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'التوليد التلقائي متاح للمدير فقط' }, { status: 403 });
    }
    console.error('generate:', e);
    return NextResponse.json({ error: 'حدث خطأ أثناء التوليد' }, { status: 500 });
  }
}
