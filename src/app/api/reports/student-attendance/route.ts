// ===== GET /api/reports/student-attendance?studentId=xxx — تفصيل حضور طالب واحد =====
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 });
    }

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { name: true } },
        level: { select: { name: true } },
        specialization: { select: { name: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get all attendance records for this student
    const attendances = await db.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        courseName: true,
        startTime: true,
        endTime: true,
        teacherName: true,
        totalCount: true,
        maleCount: true,
        femaleCount: true,
        durationMinutes: true,
        notes: true,
      },
    });

    // Calculate stats
    const totalSessions = attendances.length;
    const totalMinutes = attendances.reduce((s, a) => s + (a.durationMinutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Group by month
    const byMonth: Record<string, { count: number; minutes: number }> = {};
    for (const a of attendances) {
      const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { count: 0, minutes: 0 };
      byMonth[key].count++;
      byMonth[key].minutes += a.durationMinutes || 0;
    }

    // Get all expected sessions (from timetable or department courses) — simplified: count total course sessions
    // For now, we compare against department's expected sessions
    const expectedSessions = student.department ? await db.timetableSession.count({
      where: { OR: [{ group: { departmentId: student.departmentId } }, { subject: { departmentId: student.departmentId } }] },
    }) : 0;

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        department: student.department?.name,
        level: student.level?.name,
        specialization: student.specialization?.name,
        gender: student.gender,
        phone: student.phone,
      },
      stats: {
        totalSessions,
        totalMinutes,
        totalHours,
        expectedSessions,
        attendanceRate: expectedSessions > 0 ? Math.round((totalSessions / expectedSessions) * 100) : 0,
        absenceCount: expectedSessions > totalSessions ? expectedSessions - totalSessions : 0,
      },
      attendances: attendances.map(a => ({
        id: a.id,
        date: a.date.toISOString().split('T')[0],
        time: a.date.toLocaleTimeString('ar-DZ'),
        courseName: a.courseName,
        startTime: a.startTime,
        endTime: a.endTime,
        teacherName: a.teacherName,
        durationMinutes: a.durationMinutes,
        notes: a.notes,
      })),
      byMonth: Object.entries(byMonth).map(([month, data]) => ({
        month,
        sessions: data.count,
        minutes: data.minutes,
        hours: Math.round((data.minutes / 60) * 10) / 10,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('GET /api/reports/student-attendance error:', error);
    return NextResponse.json({ error: 'Server error: ' + (error.message || '') }, { status: 500 });
  }
}
