// ===== POST /api/attendance/bulk — تسجيل حضور جماعي للطلاب =====
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/attendance/bulk
 * Body: {
 *   date: string,
 *   courseName: string,
 *   level?: string,
 *   startTime: string,
 *   endTime: string,
 *   teacherId?: string,
 *   studentIds: string[],  // قائمة معرفات الطلاب
 *   departmentId?: string, // أو القسم كاملاً
 * }
 *
 * يسجل حضوراً جماعياً لعدة طلاب في حصة واحدة، ثم يُرجع الإحصائيات.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const branchId = await getBranchIdForNewRecord();

    // Parse time + compute duration
    function parseTime(t: string): number | null {
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      return h * 60 + min;
    }
    const startMin = parseTime(body.startTime || '08:00') ?? 480;
    const endMin = parseTime(body.endTime || '10:00') ?? 600;
    let duration = endMin - startMin;
    if (duration < 0) duration += 24 * 60;

    const date = body.date ? new Date(body.date) : new Date();

    // Get student IDs
    let studentIds: string[] = body.studentIds || [];

    // If departmentId provided, get all students in that department
    if (!studentIds.length && body.departmentId) {
      const deptStudents = await db.student.findMany({
        where: {
          departmentId: body.departmentId,
          status: { in: ['registered', 'continuing'] },
        },
        select: { id: true, name: true, gender: true },
      });
      studentIds = deptStudents.map(s => s.id);
    }

    if (!studentIds.length) {
      return NextResponse.json({ error: 'لا يوجد طلاب للتسجيل' }, { status: 400 });
    }

    // Fetch student details for stats
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, gender: true },
    });

    // Create a single attendance record with aggregate counts
    const totalCount = students.length;
    const maleCount = students.filter(s => s.gender === 'ذكر').length;
    const femaleCount = students.filter(s => s.gender === 'أنثى').length;

    // Get teacher name if provided
    let teacherName: string | null = null;
    if (body.teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: body.teacherId }, select: { name: true } });
      teacherName = teacher?.name || null;
    }

    const attendance = await db.attendance.create({
      data: {
        date,
        courseId: body.courseId || null,
        courseName: body.courseName || 'حضور جماعي',
        level: body.level || null,
        startTime: body.startTime || '08:00',
        endTime: body.endTime || '10:00',
        timeSlot: `${body.startTime || '08:00'} - ${body.endTime || '10:00'}`,
        teacherId: body.teacherId || null,
        teacherName,
        totalCount,
        maleCount,
        femaleCount,
        durationMinutes: duration,
        unpaidCount: 0,
        notes: body.notes || `حضور جماعي - ${totalCount} طالب`,
        branchId,
      },
    });

    return NextResponse.json({
      ok: true,
      attendance,
      stats: {
        total: totalCount,
        male: maleCount,
        female: femaleCount,
        duration,
        studentNames: students.map(s => s.name),
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST /api/attendance/bulk error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
