import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/timetable/stats - timetable statistics
export async function GET() {
  try {
    await requireAuth();

    const sessions = await db.timetableSession.findMany({
      include: { teacher: true, room: true, group: true, subject: true },
    });

    // Total counts
    const totalSessions = sessions.length;

    // Hours per teacher
    const teacherHours: Record<string, { name: string; hours: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!s.teacherId || !s.teacherName) continue;
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const hours = (eh * 60 + em - sh * 60 - sm) / 60;
      if (!teacherHours[s.teacherId]) {
        teacherHours[s.teacherId] = { name: s.teacherName, hours: 0, sessions: 0 };
      }
      teacherHours[s.teacherId].hours += hours;
      teacherHours[s.teacherId].sessions += 1;
    }

    // Hours per room (utilization)
    const roomStats: Record<string, { name: string; hours: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!s.roomId || !s.roomName) continue;
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const hours = (eh * 60 + em - sh * 60 - sm) / 60;
      if (!roomStats[s.roomId]) {
        roomStats[s.roomId] = { name: s.roomName, hours: 0, sessions: 0 };
      }
      roomStats[s.roomId].hours += hours;
      roomStats[s.roomId].sessions += 1;
    }

    // Hours per subject
    const subjectStats: Record<string, { name: string; hours: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!s.subjectId || !s.subjectName) continue;
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const hours = (eh * 60 + em - sh * 60 - sm) / 60;
      if (!subjectStats[s.subjectId]) {
        subjectStats[s.subjectId] = { name: s.subjectName, hours: 0, sessions: 0 };
      }
      subjectStats[s.subjectId].hours += hours;
      subjectStats[s.subjectId].sessions += 1;
    }

    // Hours per group (specialization)
    const groupStats: Record<string, { name: string; hours: number; sessions: number }> = {};
    for (const s of sessions) {
      if (!s.groupId || !s.groupName) continue;
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const hours = (eh * 60 + em - sh * 60 - sm) / 60;
      if (!groupStats[s.groupId]) {
        groupStats[s.groupId] = { name: s.groupName, hours: 0, sessions: 0 };
      }
      groupStats[s.groupId].hours += hours;
      groupStats[s.groupId].sessions += 1;
    }

    // Room utilization rate (based on 6 days × 10 hours = 60 hours max per week)
    const rooms = await db.room.findMany();
    const maxRoomHoursPerWeek = 60; // approx
    const roomUtilization = rooms.map(r => {
      const stats = roomStats[r.id] || { name: r.name, hours: 0, sessions: 0 };
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        hours: stats.hours,
        sessions: stats.sessions,
        utilizationRate: Math.round((stats.hours / maxRoomHoursPerWeek) * 100),
      };
    });

    // Teacher utilization rate (based on maxTeacherHoursPerWeek setting)
    const workSettings = await db.workSettings.findFirst();
    const maxTeacherHours = workSettings?.maxTeacherHoursPerWeek || 20;
    const teachers = await db.teacher.findMany({ where: { status: 'active' } });
    const teacherUtilization = teachers.map(t => {
      const stats = teacherHours[t.id] || { name: t.name, hours: 0, sessions: 0 };
      return {
        id: t.id,
        name: t.name,
        hours: stats.hours,
        sessions: stats.sessions,
        utilizationRate: Math.round((stats.hours / maxTeacherHours) * 100),
      };
    });

    return NextResponse.json({
      totalSessions,
      teacherStats: Object.values(teacherHours),
      roomStats: Object.values(roomStats),
      subjectStats: Object.values(subjectStats),
      groupStats: Object.values(groupStats),
      roomUtilization,
      teacherUtilization,
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('stats:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
