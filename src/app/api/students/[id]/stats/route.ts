import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/students/[id]/stats - statistics for a single student
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';
    const { id } = await params;

    const student = await db.student.findUnique({
      where: { id },
      include: {
        department: true,
        level: true,
        specialization: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    // Get installments (for التقني سامي students)
    const installments = isDirector
      ? await db.installmentPlan.findMany({
          where: { studentId: id },
          orderBy: { monthNumber: 'asc' },
        })
      : [];
    const totalInstallmentsExpected = installments.reduce((s, i) => s + i.expectedAmount, 0);
    const totalInstallmentsPaid = installments.reduce((s, i) => s + i.paidAmount, 0);

    // Get all payments (only for director; employees don't see payment data)
    const payments = isDirector
      ? await db.studentPayment.findMany({
          where: { studentId: id },
          orderBy: { paymentDate: 'desc' },
        })
      : [];

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    // For التقني سامي students (with installments): use totalAmount from student record
    // For other students: use course price as fallback
    let courseFees = 0;
    if (student.totalAmount) {
      // Student has a totalAmount set (التقني سامي with 30-month plan)
      courseFees = student.totalAmount;
    } else if (student.departmentId) {
      // Fallback: try to find a course price
      courseFees = (await db.course.findFirst({ where: { departmentId: student.departmentId } }))?.price || 0;
    }

    // For students with installments, the "remaining" should account for:
    // totalAmount - totalPaid (which includes initial payment + installment payments)
    // But installments' paidAmount is already a subset of payments (linked via installmentId)
    // So totalPaid already includes everything. remaining = totalAmount - totalPaid
    const remaining = Math.max(0, courseFees - totalPaid);

    // Get attendance records
    const attendances = await db.attendance.findMany({
      where: { studentId: id },
      orderBy: { date: 'desc' },
    });

    const totalSessions = attendances.length;
    const presentSessions = attendances.filter(a => a.totalCount > 0).length;
    const attendanceRate = totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0;

    // Get registrations
    const registrations = await db.registration.findMany({
      where: { studentId: id },
      orderBy: { date: 'desc' },
    });

    const stats = {
      student,
      // Payment info is only included for directors
      payments: isDirector ? payments : [],
      totalPaid: isDirector ? totalPaid : null,
      courseFees: isDirector ? courseFees : null,
      remaining: isDirector ? remaining : null,
      paymentCount: isDirector ? payments.length : 0,
      // For التقني سامي: also include initial payment info
      initialPayment: isDirector ? (student.initialPayment || 0) : null,
      // Installments (التقني سامي - 30 شهر) - director only
      installments: isDirector ? installments : [],
      installmentsTotal: isDirector ? {
        // totalExpected = sum of monthly installments (already excludes initial payment)
        expected: totalInstallmentsExpected,
        // paid = sum of paidAmount from installment records
        paid: totalInstallmentsPaid,
        remaining: totalInstallmentsExpected - totalInstallmentsPaid,
        // Also include the big picture: totalAmount, initialPayment, overall remaining
        totalAmount: student.totalAmount || 0,
        initialPayment: student.initialPayment || 0,
        overallPaid: totalPaid, // total from StudentPayment table (includes initial + installments)
        overallRemaining: Math.max(0, (student.totalAmount || 0) - totalPaid),
      } : null,
      attendance: {
        totalSessions,
        presentSessions,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        records: attendances,
      },
      registrations,
      courseCount: registrations.length,
      isDirector,
    };

    return NextResponse.json({ stats });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/students/[id]/stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
