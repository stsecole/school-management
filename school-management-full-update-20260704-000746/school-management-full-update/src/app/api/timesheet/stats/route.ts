import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/timesheet/stats - aggregated statistics
// For employees: returns their own stats
// For directors: returns stats for all staff (or a specific user)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (user.role !== 'director') {
      where.userId = user.id;
    } else if (targetUserId && targetUserId !== 'all') {
      where.userId = targetUserId;
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

    // If director and no specific user: group by user
    if (user.role === 'director' && (!targetUserId || targetUserId === 'all')) {
      const byUser: Record<string, {
        userId: string;
        name: string;
        role: string;
        totalDays: number;
        presentDays: number;
        absentDays: number;
        sickDays: number;
        leaveDays: number;
        totalHours: number;
        regularHours: number;
        overtimeHours: number;
        sickHours: number;
        leaveHours: number;
      }> = {};

      for (const t of timesheets) {
        const key = t.userId;
        if (!byUser[key]) {
          byUser[key] = {
            userId: t.userId,
            name: t.user.name,
            role: t.user.role,
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            sickDays: 0,
            leaveDays: 0,
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            sickHours: 0,
            leaveHours: 0,
          };
        }
        byUser[key].totalDays++;
        byUser[key].totalHours += t.totalHours;
        byUser[key].regularHours += t.regularHours;
        byUser[key].overtimeHours += t.overtimeHours;
        byUser[key].sickHours += t.sickHours;
        byUser[key].leaveHours += t.leaveHours;
        if (t.status === 'present') byUser[key].presentDays++;
        else if (t.status === 'absent') byUser[key].absentDays++;
        else if (t.status === 'sick') byUser[key].sickDays++;
        else if (t.status === 'leave') byUser[key].leaveDays++;
      }

      // Round hours
      const staffStats = Object.values(byUser).map(s => ({
        ...s,
        totalHours: Math.round(s.totalHours * 100) / 100,
        regularHours: Math.round(s.regularHours * 100) / 100,
        overtimeHours: Math.round(s.overtimeHours * 100) / 100,
        sickHours: Math.round(s.sickHours * 100) / 100,
        leaveHours: Math.round(s.leaveHours * 100) / 100,
      }));

      return NextResponse.json({ staffStats, isDirector: true });
    }

    // Single user stats
    const totalDays = timesheets.length;
    const presentDays = timesheets.filter(t => t.status === 'present').length;
    const absentDays = timesheets.filter(t => t.status === 'absent').length;
    const sickDays = timesheets.filter(t => t.status === 'sick').length;
    const leaveDays = timesheets.filter(t => t.status === 'leave').length;
    const totalHours = timesheets.reduce((s, t) => s + t.totalHours, 0);
    const regularHours = timesheets.reduce((s, t) => s + t.regularHours, 0);
    const overtimeHours = timesheets.reduce((s, t) => s + t.overtimeHours, 0);
    const sickHours = timesheets.reduce((s, t) => s + t.sickHours, 0);
    const leaveHours = timesheets.reduce((s, t) => s + t.leaveHours, 0);

    return NextResponse.json({
      isDirector: user.role === 'director',
      stats: {
        totalDays,
        presentDays,
        absentDays,
        sickDays,
        leaveDays,
        totalHours: Math.round(totalHours * 100) / 100,
        regularHours: Math.round(regularHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        sickHours: Math.round(sickHours * 100) / 100,
        leaveHours: Math.round(leaveHours * 100) / 100,
        avgHoursPerDay: totalDays > 0 ? Math.round((totalHours / totalDays) * 100) / 100 : 0,
      },
      records: timesheets,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/timesheet/stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
