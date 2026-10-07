// ===== سياق البيانات للمساعد الذكي =====
// يبني ملخص المؤسسة مع احترام صلاحيات المدير/الموظف

import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';

export interface DataContext {
  user: SessionUser;
  isDirector: boolean;
  now: Date;
}

export function ctxFromUser(user: SessionUser): DataContext {
  return {
    user,
    isDirector: user.role === 'director',
    now: new Date(),
  };
}

/**
 * ملخص شامل للمؤسسة يُمرّر إلى الـ system prompt.
 * يحترم الصلاحيات: المعلومات المالية للمدير فقط.
 */
export async function buildInstitutionSummary(ctx: DataContext): Promise<string> {
  const [
    studentsCount,
    teachersCount,
    departmentsCount,
    coursesCount,
    roomsCount,
    activeStudents,
    pendingTasks,
    completedTasks,
    overdueTasks,
    departments,
    todayAttendance,
  ] = await Promise.all([
    db.student.count(),
    db.teacher.count(),
    db.department.count(),
    db.course.count(),
    db.room.count(),
    db.student.count({ where: { status: 'registered' } }),
    db.task.count({ where: { completed: false } }),
    db.task.count({ where: { completed: true } }),
    db.task.count({
      where: { completed: false, deadline: { lt: ctx.now } },
    }),
    db.department.findMany({
      include: { _count: { select: { students: true, teachers: true } } },
    }),
    db.attendance.findMany({
      where: {
        date: {
          gte: new Date(ctx.now.setHours(0, 0, 0, 0)),
          lt: new Date(ctx.now.setHours(23, 59, 59, 999)),
        },
      },
    }),
  ]);

  const lines: string[] = [
    '=== ملخص المؤسسة (مدرسة السلامة) ===',
    `- التاريخ الحالي: ${ctx.now.toISOString().split('T')[0]}`,
    `- إجمالي الطلاب: ${studentsCount}`,
    `- الطلاب المسجلين (جدد): ${activeStudents}`,
    `- إجمالي الأساتذة: ${teachersCount}`,
    `- عدد الأقسام: ${departmentsCount}`,
    `- عدد الدورات: ${coursesCount}`,
    `- عدد القاعات: ${roomsCount}`,
    `- المهام: ${pendingTasks} معلقة، ${completedTasks} مكتملة، ${overdueTasks} متأخرة`,
    `- سجلات الحضور اليوم: ${todayAttendance.length}`,
    '',
    'الأقسام:',
    ...departments.map(
      (d) => `  • ${d.name}: ${d._count.students} طالب، ${d._count.teachers} أستاذ`
    ),
  ];

  // القسم المالي للمدير فقط
  if (ctx.isDirector) {
    const monthStart = new Date(ctx.now.getFullYear(), ctx.now.getMonth(), 1);
    const monthEnd = new Date(ctx.now.getFullYear(), ctx.now.getMonth() + 1, 1);
    const [studentPayments, teacherPayments, expenses] = await Promise.all([
      db.studentPayment.findMany({
        where: { paymentDate: { gte: monthStart, lt: monthEnd } },
      }),
      db.teacherPayment.findMany({
        where: { paymentDate: { gte: monthStart, lt: monthEnd } },
      }),
      db.expense.findMany({
        where: { date: { gte: monthStart, lt: monthEnd } },
      }),
    ]);
    const income = studentPayments.reduce((s, p) => s + p.amount, 0);
    const teacherCost = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
    lines.push(
      '',
      `=== البيانات المالية (هذا الشهر) ===`,
      `- المداخيل: ${income.toFixed(2)} دج`,
      `- رواتب الأساتذة: ${teacherCost.toFixed(2)} دج`,
      `- المصاريف الثانوية: ${expTotal.toFixed(2)} دج`,
      `- الرصيد: ${(income - teacherCost - expTotal).toFixed(2)} دج`
    );
  } else {
    lines.push('', '=== البيانات المالية ===', 'البيانات المالية متاحة للمدير فقط.');
  }

  lines.push(
    '',
    `=== المستخدم الحالي ===`,
    `- الاسم: ${ctx.user.name}`,
    `- الدور: ${ctx.user.role === 'director' ? 'مدير' : 'موظف'}`,
    '- الصلاحيات: ' +
      (ctx.isDirector
        ? 'الوصول الكامل بما في ذلك المالية والإجراءات'
        : 'الاستعلامات فقط (لا يمكن تنفيذ إجراءات حساسة)')
  );

  return lines.join('\n');
}
