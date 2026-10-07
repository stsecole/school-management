// ===== POST /api/attendance/scan — تسجيل حضور الطالب عبر مسح البطاقة =====
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchIdForNewRecord } from '@/lib/branch-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/**
 * POST /api/attendance/scan
 * Body: { studentId: string, date?: string }
 *
 * Registers attendance for a student by scanning their ID card.
 * The scanner (USB barcode/QR) sends the student ID as keyboard input.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const studentId = body.studentId;
    const today = body.date ? new Date(body.date) : new Date();
    const branchId = await getBranchIdForNewRecord();

    if (!studentId) {
      return NextResponse.json({ error: 'معرف الطالب مطلوب' }, { status: 400 });
    }

    // Find student by id or studentNumber
    const student = await db.student.findFirst({
      where: {
        OR: [
          { id: studentId },
          { studentNumber: studentId },
        ],
      },
      include: { department: true, level: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'طالب غير موجود' }, { status: 404 });
    }

    // Check if already checked in today
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const existing = await db.attendance.findFirst({
      where: {
        studentId: student.id,
        date: { gte: todayStart, lt: todayEnd },
      },
    });

    if (existing) {
      return NextResponse.json({
        ok: false,
        duplicate: true,
        message: `${student.name} مسجّل حضور اليوم`,
        student: { id: student.id, name: student.name, studentNumber: student.studentNumber, department: student.department?.name },
      });
    }

    // Create attendance record
    const attendance = await db.attendance.create({
      data: {
        date: today,
        courseName: 'تسجيل دخول - مسح',
        studentId: student.id,
        teacherName: null,
        totalCount: 1,
        maleCount: student.gender === 'ذكر' ? 1 : 0,
        femaleCount: student.gender === 'أنثى' ? 1 : 0,
        durationMinutes: 0,
        notes: `مسح تلقائي - ${new Date().toLocaleTimeString('ar-DZ')}`,
        branchId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `تم تسجيل حضور: ${student.name}`,
      student: { id: student.id, name: student.name, studentNumber: student.studentNumber, department: student.department?.name, level: student.level?.name },
      attendance,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST /api/attendance/scan error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

/**
 * GET /api/attendance/scan?date=2026-07-26
 * Returns list of students who checked in on a specific date
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

    const records = await db.attendance.findMany({
      where: {
        date: { gte: dayStart, lt: dayEnd },
        notes: { contains: 'مسح تلقائي' },
      },
      include: {
        student: { select: { name: true, studentNumber: true, department: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      count: records.length,
      records: records.map(r => ({
        id: r.id,
        time: r.date.toLocaleTimeString('ar-DZ'),
        studentName: r.student?.name,
        studentNumber: r.student?.studentNumber,
        department: r.student?.department?.name,
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
