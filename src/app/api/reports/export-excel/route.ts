// ===== GET /api/reports/export-excel?year=2026 — تصدير التقرير الشامل إلى Excel =====
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const branchFilter = await getBranchFilter();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    // Fetch all data
    const [students, teachers, attendances, tasks, studentPayments, teacherPayments, expenses, departments] = await Promise.all([
      db.student.findMany({ where: branchFilter, include: { department: true, level: true, specialization: true }, orderBy: { name: 'asc' } }),
      db.teacher.findMany({ where: branchFilter, include: { department: true }, orderBy: { name: 'asc' } }),
      db.attendance.findMany({ where: { date: { gte: yearStart, lt: yearEnd }, ...branchFilter }, include: { teacher: true, course: true }, orderBy: { date: 'desc' } }),
      db.task.findMany({ where: { ...branchFilter, OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] }, orderBy: { createdAt: 'desc' } }),
      db.studentPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd }, ...branchFilter }, include: { student: { select: { name: true, studentNumber: true } } }, orderBy: { paymentDate: 'desc' } }),
      db.teacherPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd }, teacher: branchFilter }, include: { teacher: { select: { name: true } } }, orderBy: { paymentDate: 'desc' } }),
      db.expense.findMany({ where: { date: { gte: yearStart, lt: yearEnd }, ...branchFilter }, orderBy: { date: 'desc' } }),
      db.department.findMany({ include: { _count: { select: { students: { where: branchFilter }, teachers: { where: branchFilter } } } }, orderBy: { name: 'asc' } }),
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
    const totalTeacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const totalSecondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const summary = [
      { 'البند': 'السنة', 'القيمة': year },
      { 'البند': 'عدد الطلاب', 'القيمة': students.length },
      { 'البند': 'عدد الأساتذة', 'القيمة': teachers.length },
      { 'البند': 'عدد الأقسام', 'القيمة': departments.length },
      { 'البند': 'سجلات الحضور', 'القيمة': attendances.length },
      { 'البند': 'إجمالي المهام', 'القيمة': tasks.length },
      { 'البند': 'مهام مكتملة', 'القيمة': tasks.filter(t => t.completed).length },
      { 'البند': 'مهام معلقة', 'القيمة': tasks.filter(t => !t.completed).length },
      { 'البند': 'مهام متأخرة', 'القيمة': tasks.filter(t => !t.completed && t.deadline && t.deadline < new Date()).length },
      { 'البند': 'إجمالي المداخيل', 'القيمة': totalIncome },
      { 'البند': 'رواتب الأساتذة', 'القيمة': totalTeacherExpense },
      { 'البند': 'مصاريف ثانوية', 'القيمة': totalSecondaryExpense },
      { 'البند': 'إجمالي المصاريف', 'القيمة': totalTeacherExpense + totalSecondaryExpense },
      { 'البند': 'الرصيد', 'القيمة': totalIncome - totalTeacherExpense - totalSecondaryExpense },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'ملخص');

    // Sheet 2: Students
    const studentsData = students.map((s, i) => ({
      '#': i + 1, 'رقم الطالب': s.studentNumber || '', 'الاسم': s.name, 'الهاتف': s.phone || '',
      'الجنس': s.gender || '', 'القسم': s.department?.name || '', 'المستوى': s.level?.name || '',
      'التخصص': s.specialization?.name || '', 'الحالة': s.status,
      'تاريخ التسجيل': new Date(s.registrationDate).toLocaleDateString('ar-DZ'),
      'صور': s.docPhotos ? 'نعم' : 'لا', 'شهادة ميلاد': s.docBirthCert ? 'نعم' : 'لا',
      'بطاقة تعريف': s.docIdCard ? 'نعم' : 'لا', 'شهادة مدرسية': s.docSchoolCert ? 'نعم' : 'لا',
      'شهادة طبية': s.docMedicalCert ? 'نعم' : 'لا',
      'تربص تطبيقي': s.docPracticalTraining ? 'نعم' : 'لا',
      'استلم شهادة': s.docCertificateReceived ? 'نعم' : 'لا',
      'المؤسسة': s.schoolName || '', 'الطور': s.educationLevel || '',
      'الشعبة': s.schoolStream || '', 'السنة': s.schoolYear || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsData), 'الطلاب');

    // Sheet 3: Teachers
    const teachersData = teachers.map((t, i) => ({
      '#': i + 1, 'الاسم': t.name, 'الهاتف': t.phone || '', 'الجنس': t.gender || '',
      'التخصص': t.specialty || '', 'القسم': t.department?.name || '', 'الراتب': t.salary, 'الحالة': t.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teachersData), 'الأساتذة');

    // Sheet 4: Student Payments
    const paymentsData = studentPayments.map((p, i) => ({
      '#': i + 1, 'رقم الوصل': p.receiptNumber, 'الطالب': p.student?.name || '',
      'المبلغ': p.amount, 'النوع': p.paymentLabel || p.paymentType,
      'التاريخ': new Date(p.paymentDate).toLocaleDateString('ar-DZ'), 'طريقة الدفع': p.paymentMethod || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentsData), 'مدفوعات الطلاب');

    // Sheet 5: Teacher Payments
    const teacherPaymentsData = teacherPayments.map((p, i) => ({
      '#': i + 1, 'رقم الوصل': p.receiptNumber, 'الأستاذ': p.teacher?.name || '',
      'المبلغ': p.amount, 'الشهر': p.month, 'النوع': p.paymentLabel || p.paymentType,
      'التاريخ': new Date(p.paymentDate).toLocaleDateString('ar-DZ'),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teacherPaymentsData), 'رواتب الأساتذة');

    // Sheet 6: Expenses
    const expensesData = expenses.map((e, i) => ({
      '#': i + 1, 'التاريخ': new Date(e.date).toLocaleDateString('ar-DZ'),
      'النوع': e.type, 'الوصف': e.description || '', 'المبلغ': e.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), 'المصاريف');

    // Sheet 7: Attendance
    const attendanceData = attendances.map((a, i) => ({
      '#': i + 1, 'التاريخ': new Date(a.date).toLocaleDateString('ar-DZ'),
      'المادة': a.courseName, 'المستوى': a.level || '', 'الأستاذ': a.teacherName || a.teacher?.name || '',
      'البداية': a.startTime || '', 'النهاية': a.endTime || '',
      'إجمالي الحضور': a.totalCount, 'ذكور': a.maleCount, 'إناث': a.femaleCount,
      'المدة (دقيقة)': a.durationMinutes,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceData), 'الحضور');

    // Sheet 8: Tasks
    const tasksData = tasks.map((t, i) => ({
      '#': i + 1, 'العنوان': t.title, 'الأولوية': t.priorityLabel || t.priority,
      'المسؤول': t.responsible || '', 'تاريخ البداية': t.startDate ? new Date(t.startDate).toLocaleDateString('ar-DZ') : '',
      'الأجل': t.deadline ? new Date(t.deadline).toLocaleDateString('ar-DZ') : '',
      'مكتملة': t.completed ? 'نعم' : 'لا', 'الحالة': t.status,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tasksData), 'المهام');

    // Sheet 9: Departments
    const deptData = departments.map((d, i) => ({
      '#': i + 1, 'القسم': d.name, 'عدد الطلاب': d._count.students, 'عدد الأساتذة': d._count.teachers,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), 'الأقسام');

    // Generate
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `report-${year}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/reports/export-excel error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
