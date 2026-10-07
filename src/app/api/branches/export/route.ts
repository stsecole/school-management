import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * GET /api/branches/export?id=xxx
 *
 * Exports ALL data of a specific branch as an Excel workbook (.xlsx) with
 * multiple sheets:
 *   1. Branch Info      — metadata about the branch
 *   2. Students          — all students with department/level/specialization
 *   3. Teachers          — all teachers with department
 *   4. Student Payments  — all student payments with student name
 *   5. Teacher Payments  — all teacher payments
 *   6. Expenses          — all expenses
 *   7. Attendance        — all attendance records
 *   8. Tasks             — all tasks
 *   9. Documents         — document metadata (file paths, not file contents)
 *
 * Director-only access.
 */
export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Branch ID required (?id=xxx)' }, { status: 400 });
    }

    const branch = await db.branch.findUnique({ where: { id } });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Fetch all branch data in parallel
    const [
      students,
      teachers,
      studentPayments,
      teacherPayments,
      expenses,
      attendances,
      tasks,
      documents,
    ] = await Promise.all([
      db.student.findMany({
        where: { branchId: id },
        include: { department: true, level: true, specialization: true },
        orderBy: { name: 'asc' },
      }),
      db.teacher.findMany({
        where: { branchId: id },
        include: { department: true },
        orderBy: { name: 'asc' },
      }),
      db.studentPayment.findMany({
        where: { branchId: id },
        include: { student: { select: { name: true, studentNumber: true } } },
        orderBy: { paymentDate: 'desc' },
      }),
      db.teacherPayment.findMany({
        where: { teacher: { branchId: id } },
        include: { teacher: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
      }),
      db.expense.findMany({
        where: { branchId: id },
        orderBy: { date: 'desc' },
      }),
      db.attendance.findMany({
        where: { branchId: id },
        include: { teacher: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      db.task.findMany({
        where: { branchId: id },
        orderBy: { createdAt: 'desc' },
      }),
      db.document.findMany({
        where: { branchId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ===== Build Excel workbook =====
    const wb = XLSX.utils.book_new();

    // Sheet 1: Branch Info
    const branchInfo = [
      { 'الحقل': 'اسم الفرع', 'القيمة': branch.name },
      { 'الحقل': 'الرمز', 'القيمة': branch.code || '' },
      { 'الحقل': 'العنوان', 'القيمة': branch.address || '' },
      { 'الحقل': 'الهاتف', 'القيمة': branch.phone || '' },
      { 'الحقل': 'البريد الإلكتروني', 'القيمة': branch.email || '' },
      { 'الحقل': 'اسم المسؤول', 'القيمة': branch.managerName || '' },
      { 'الحقل': 'نشط', 'القيمة': branch.isActive ? 'نعم' : 'لا' },
      { 'الحقل': 'ملاحظات', 'القيمة': branch.notes || '' },
      { 'الحقل': 'تاريخ الإنشاء', 'القيمة': branch.createdAt.toLocaleString('ar-DZ') },
      { 'الحقل': 'عدد الطلاب', 'القيمة': students.length },
      { 'الحقل': 'عدد الأساتذة', 'القيمة': teachers.length },
      { 'الحقل': 'عدد المدفوعات', 'القيمة': studentPayments.length + teacherPayments.length },
      { 'الحقل': 'عدد المصاريف', 'القيمة': expenses.length },
      { 'الحقل': 'عدد سجلات الحضور', 'القيمة': attendances.length },
      { 'الحقل': 'عدد المهام', 'القيمة': tasks.length },
      { 'الحقل': 'عدد الوثائق', 'القيمة': documents.length },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(branchInfo);
    wsInfo['!cols'] = [{ wch: 25 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'معلومات الفرع');

    // Sheet 2: Students
    const studentsData = students.map((s, i) => ({
      '#': i + 1,
      'رقم الطالب': s.studentNumber || '',
      'الاسم': s.name,
      'البريد': s.email || '',
      'الهاتف': s.phone || '',
      'الجنس': s.gender || '',
      'تاريخ الميلاد': s.birthDate ? new Date(s.birthDate).toLocaleDateString('ar-DZ') : '',
      'العنوان': s.address || '',
      'القسم': s.department?.name || '',
      'المستوى': s.level?.name || '',
      'التخصص': s.specialization?.name || '',
      'الحالة': s.status,
      'تاريخ التسجيل': new Date(s.registrationDate).toLocaleDateString('ar-DZ'),
      'المبلغ الإجمالي': s.totalAmount || 0,
      'الدفعة الأولية': s.initialPayment || 0,
    }));
    const wsStudents = XLSX.utils.json_to_sheet(studentsData);
    wsStudents['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
      { wch: 8 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');

    // Sheet 3: Teachers
    const teachersData = teachers.map((t, i) => ({
      '#': i + 1,
      'الاسم': t.name,
      'البريد': t.email || '',
      'الهاتف': t.phone || '',
      'الجنس': t.gender || '',
      'التخصص': t.specialty || '',
      'القسم': t.department?.name || '',
      'الراتب': t.salary,
      'تاريخ التوظيف': t.hireDate ? new Date(t.hireDate).toLocaleDateString('ar-DZ') : '',
      'الحالة': t.status,
    }));
    const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
    wsTeachers['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 8 },
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'الأساتذة');

    // Sheet 4: Student Payments
    const studentPaymentsData = studentPayments.map((p, i) => ({
      '#': i + 1,
      'رقم الوصل': p.receiptNumber,
      'الطالب': p.student?.name || '',
      'رقم الطالب': p.student?.studentNumber || '',
      'المبلغ': p.amount,
      'نوع الدفعة': p.paymentLabel || p.paymentType,
      'تاريخ الدفع': new Date(p.paymentDate).toLocaleDateString('ar-DZ'),
      'طريقة الدفع': p.paymentMethod || '',
      'ملاحظات': p.notes || '',
    }));
    const wsStudentPayments = XLSX.utils.json_to_sheet(studentPaymentsData);
    wsStudentPayments['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStudentPayments, 'مدفوعات الطلاب');

    // Sheet 5: Teacher Payments
    const teacherPaymentsData = teacherPayments.map((p, i) => ({
      '#': i + 1,
      'رقم الوصل': p.receiptNumber,
      'الأستاذ': p.teacher?.name || '',
      'المبلغ': p.amount,
      'الشهر': p.month,
      'نوع الدفعة': p.paymentLabel || p.paymentType,
      'تاريخ الدفع': new Date(p.paymentDate).toLocaleDateString('ar-DZ'),
      'ملاحظات': p.notes || '',
    }));
    const wsTeacherPayments = XLSX.utils.json_to_sheet(teacherPaymentsData);
    wsTeacherPayments['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTeacherPayments, 'رواتب الأساتذة');

    // Sheet 6: Expenses
    const expensesData = expenses.map((e, i) => ({
      '#': i + 1,
      'التاريخ': new Date(e.date).toLocaleDateString('ar-DZ'),
      'النوع': e.type,
      'الوصف': e.description || '',
      'المبلغ': e.amount,
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    wsExpenses['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 35 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصاريف');

    // Sheet 7: Attendance
    const attendancesData = attendances.map((a, i) => ({
      '#': i + 1,
      'التاريخ': new Date(a.date).toLocaleDateString('ar-DZ'),
      'المادة': a.courseName,
      'المستوى': a.level || '',
      'البداية': a.startTime || '',
      'النهاية': a.endTime || '',
      'الأستاذ': a.teacherName || a.teacher?.name || '',
      'إجمالي الحضور': a.totalCount,
      'ذكور': a.maleCount,
      'إناث': a.femaleCount,
      'المدة (دقيقة)': a.durationMinutes,
    }));
    const wsAttendance = XLSX.utils.json_to_sheet(attendancesData);
    wsAttendance['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 8 },
      { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'الحضور');

    // Sheet 8: Tasks
    const tasksData = tasks.map((t, i) => ({
      '#': i + 1,
      'العنوان': t.title,
      'الأولوية': t.priorityLabel || t.priority,
      'المسؤول': t.responsible || '',
      'تاريخ البداية': t.startDate ? new Date(t.startDate).toLocaleDateString('ar-DZ') : '',
      'الأجل': t.deadline ? new Date(t.deadline).toLocaleDateString('ar-DZ') : '',
      'مكتملة': t.completed ? 'نعم' : 'لا',
      'الحالة': t.status,
      'ملاحظات': t.notes || '',
    }));
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    wsTasks['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 12 },
      { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTasks, 'المهام');

    // Sheet 9: Documents (metadata only — file contents are not exported)
    const documentsData = documents.map((d, i) => ({
      '#': i + 1,
      'العنوان': d.title,
      'النوع': d.type,
      'الطالب': d.studentName || '',
      'اسم الملف': d.fileName,
      'الحجم (KB)': Math.round(d.fileSize / 1024),
      'تاريخ الرفع': new Date(d.createdAt).toLocaleDateString('ar-DZ'),
      'ملاحظات': d.description || '',
    }));
    const wsDocuments = XLSX.utils.json_to_sheet(documentsData);
    wsDocuments['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 25 },
      { wch: 10 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDocuments, 'الوثائق');

    // ===== Generate Excel buffer =====
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Sanitize branch name for filename
    const safeName = branch.name.replace(/[^\w\u0600-\u06FF\s-]/g, '').trim() || 'branch';
    const filename = `branch-${safeName}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(buf.length),
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('GET /api/branches/export error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
