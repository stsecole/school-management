// ===== أدوات الاستعلام للمساعد الذكي =====
// 22+ أداة استعلام. ملاحظة: تجنّب groupBy مع having على SQLite — استخدم findMany + JS filter.

import { db } from '@/lib/db';
import type { DataContext } from '../context';
import type { ToolResult } from '../types';

type QueryHandler = (ctx: DataContext, params: any) => Promise<ToolResult>;

export interface QueryTool {
  name: string;
  description: string;
  handler: QueryHandler;
}

// ===== Helper: تنسيق التاريخ =====
function fmtDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().split('T')[0];
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function endOfMonth(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 1);
}

// ===== الأدوات =====

const QUERIES: QueryTool[] = [
  // 1) countStudents
  {
    name: 'countStudents',
    description: 'عدد الطلاب الكلي أو حسب الحالة/القسم',
    async handler(ctx, params) {
      const where: any = {};
      if (params.status) where.status = params.status;
      if (params.departmentId) where.departmentId = params.departmentId;
      const count = await db.student.count({ where });
      return {
        tool: 'countStudents',
        success: true,
        data: { count },
        message: `إجمالي الطلاب: ${count}`,
        display: {
          type: 'card',
          title: 'عدد الطلاب',
          cards: [{ label: 'العدد الكلي', value: count, icon: 'users' }],
        },
      };
    },
  },

  // 2) latePayers
  {
    name: 'latePayers',
    description: 'الطلاب المتأخرون في الدفع (لديهم أقساط غير مدفوعة)',
    async handler(ctx, _params) {
      const installments = await db.installmentPlan.findMany({
        where: {
          status: { in: ['pending', 'late', 'partial'] },
          expectedDate: { lt: ctx.now },
        },
        include: { student: true },
      });
      // تجميع حسب الطالب (JS filter لتجنب groupBy having)
      const map = new Map<
        string,
        { name: string; total: number; months: number }
      >();
      for (const inst of installments) {
        const sid = inst.studentId;
        const existing = map.get(sid) || {
          name: inst.student?.name || '-',
          total: 0,
          months: 0,
        };
        existing.total += inst.expectedAmount - inst.paidAmount;
        existing.months += 1;
        map.set(sid, existing);
      }
      const rows = Array.from(map.entries())
        .map(([id, v]) => ({
          id,
          name: v.name,
          monthsLate: v.months,
          amountDue: Math.round(v.total * 100) / 100,
        }))
        .sort((a, b) => b.amountDue - a.amountDue);
      return {
        tool: 'latePayers',
        success: true,
        data: { count: rows.length, rows },
        message: `يوجد ${rows.length} طالب متأخر في الدفع`,
        display: {
          type: 'table',
          title: 'الطلاب المتأخرون في الدفع',
          columns: ['الاسم', 'عدد الأشهر', 'المبلغ المستحق (دج)'],
          rows: rows.map((r) => [r.name, r.monthsLate, r.amountDue]),
        },
      };
    },
  },

  // 3) topSpecializations
  {
    name: 'topSpecializations',
    description: 'أكثر التخصصات من حيث عدد الطلاب',
    async handler(_ctx, _params) {
      const specs = await db.specialization.findMany({
        include: { _count: { select: { students: true } }, department: true },
      });
      const rows = specs
        .map((s) => ({
          name: s.name,
          department: s.department?.name || '-',
          count: s._count.students,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      return {
        tool: 'topSpecializations',
        success: true,
        data: { rows },
        message: `أكثر ${rows.length} تخصص من حيث عدد الطلاب`,
        display: {
          type: 'chart',
          title: 'أكثر التخصصات',
          chart: {
            type: 'bar',
            data: rows.map((r) => ({ name: r.name, count: r.count })),
            xKey: 'name',
            yKeys: ['count'],
          },
        },
      };
    },
  },

  // 4) revenueThisWeek
  {
    name: 'revenueThisWeek',
    description: 'مداخيل الأسبوع الحالي (للمدير)',
    async handler(ctx, _params) {
      if (!ctx.isDirector) {
        return {
          tool: 'revenueThisWeek',
          success: false,
          message: 'هذه الاستعلامية متاحة للمدير فقط',
        };
      }
      const weekStart = startOfWeek(ctx.now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const payments = await db.studentPayment.findMany({
        where: { paymentDate: { gte: weekStart, lt: weekEnd } },
      });
      const total = payments.reduce((s, p) => s + p.amount, 0);
      return {
        tool: 'revenueThisWeek',
        success: true,
        data: { total, count: payments.length, weekStart, weekEnd },
        message: `مداخيل الأسبوع: ${total.toFixed(2)} دج (${payments.length} عملية)`,
        display: {
          type: 'card',
          title: 'مداخيل الأسبوع',
          cards: [
            { label: 'المداخيل (دج)', value: total.toFixed(2), icon: 'wallet' },
            { label: 'عدد العمليات', value: payments.length, icon: 'receipt' },
          ],
        },
      };
    },
  },

  // 5) topTeachersByHours
  {
    name: 'topTeachersByHours',
    description: 'أكثر الأساتذة من حيث ساعات الحضور',
    async handler(_ctx, _params) {
      const attendances = await db.attendance.findMany({
        where: { teacherId: { not: null } },
        select: { teacherId: true, teacherName: true, durationMinutes: true },
      });
      const map = new Map<string, { name: string; minutes: number; sessions: number }>();
      for (const a of attendances) {
        if (!a.teacherId) continue;
        const ex = map.get(a.teacherId) || { name: a.teacherName || '-', minutes: 0, sessions: 0 };
        ex.minutes += a.durationMinutes || 0;
        ex.sessions += 1;
        map.set(a.teacherId, ex);
      }
      const rows = Array.from(map.entries())
        .map(([id, v]) => ({
          id,
          name: v.name,
          hours: Math.round((v.minutes / 60) * 10) / 10,
          sessions: v.sessions,
        }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10);
      return {
        tool: 'topTeachersByHours',
        success: true,
        data: { rows },
        message: `أكثر ${rows.length} أستاذ من حيث ساعات التدريس`,
        display: {
          type: 'table',
          title: 'أكثر الأساتذة ساعات',
          columns: ['الأستاذ', 'الساعات', 'عدد الجلسات'],
          rows: rows.map((r) => [r.name, r.hours, r.sessions]),
        },
      };
    },
  },

  // 6) absentToday
  {
    name: 'absentToday',
    description: 'سجلات الحضور بعدد صفر اليوم',
    async handler(ctx, _params) {
      const start = new Date(ctx.now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(ctx.now);
      end.setHours(23, 59, 59, 999);
      const records = await db.attendance.findMany({
        where: { date: { gte: start, lt: end }, totalCount: 0 },
      });
      return {
        tool: 'absentToday',
        success: true,
        data: { count: records.length, rows: records },
        message: `${records.length} سجل حضور بعدد صفر اليوم`,
        display: {
          type: 'table',
          title: 'سجلات الحضور الصفرية اليوم',
          columns: ['المادة', 'الأستاذ', 'الوقت'],
          rows: records.map((r) => [
            r.courseName,
            r.teacherName || '-',
            r.timeSlot || '-',
          ]),
        },
      };
    },
  },

  // 7) newStudentsThisMonth
  {
    name: 'newStudentsThisMonth',
    description: 'الطلاب الجدد في الشهر الحالي',
    async handler(ctx, _params) {
      const start = startOfMonth(ctx.now);
      const end = endOfMonth(ctx.now);
      const students = await db.student.findMany({
        where: { registrationDate: { gte: start, lt: end } },
        include: { department: true },
        orderBy: { registrationDate: 'desc' },
      });
      return {
        tool: 'newStudentsThisMonth',
        success: true,
        data: { count: students.length },
        message: `${students.length} طالب جديد هذا الشهر`,
        display: {
          type: 'table',
          title: 'الطلاب الجدد هذا الشهر',
          columns: ['الاسم', 'القسم', 'تاريخ التسجيل'],
          rows: students.slice(0, 20).map((s) => [
            s.name,
            s.department?.name || '-',
            fmtDate(s.registrationDate),
          ]),
        },
      };
    },
  },

  // 8) lateInstallments
  {
    name: 'lateInstallments',
    description: 'الأقساط المتأخرة (لم تُدفع بعد تاريخ الاستحقاق)',
    async handler(ctx, _params) {
      const installments = await db.installmentPlan.findMany({
        where: {
          status: { in: ['pending', 'late', 'partial'] },
          expectedDate: { lt: ctx.now },
        },
        include: { student: true },
        orderBy: { expectedDate: 'asc' },
        take: 100,
      });
      const totalDue = installments.reduce(
        (s, i) => s + (i.expectedAmount - i.paidAmount),
        0
      );
      return {
        tool: 'lateInstallments',
        success: true,
        data: { count: installments.length, totalDue },
        message: `${installments.length} قسط متأخر بإجمالي ${totalDue.toFixed(2)} دج`,
        display: {
          type: 'table',
          title: 'الأقساط المتأخرة',
          columns: ['الطالب', 'تاريخ الاستحقاق', 'المبلغ المتبقي (دج)'],
          rows: installments.slice(0, 20).map((i) => [
            i.student?.name || '-',
            fmtDate(i.expectedDate),
            Math.round((i.expectedAmount - i.paidAmount) * 100) / 100,
          ]),
        },
      };
    },
  },

  // 9) monthProfit
  {
    name: 'monthProfit',
    description: 'ربح الشهر (مداخيل - مصاريف) للمدير',
    async handler(ctx, params) {
      if (!ctx.isDirector) {
        return {
          tool: 'monthProfit',
          success: false,
          message: 'هذه الاستعلامية متاحة للمدير فقط',
        };
      }
      const offset = parseInt(params?.monthOffset || '0', 10);
      const start = startOfMonth(ctx.now, offset);
      const end = endOfMonth(ctx.now, offset);
      const [studentPayments, teacherPayments, expenses] = await Promise.all([
        db.studentPayment.findMany({ where: { paymentDate: { gte: start, lt: end } } }),
        db.teacherPayment.findMany({ where: { paymentDate: { gte: start, lt: end } } }),
        db.expense.findMany({ where: { date: { gte: start, lt: end } } }),
      ]);
      const income = studentPayments.reduce((s, p) => s + p.amount, 0);
      const salaries = teacherPayments.reduce((s, p) => s + p.amount, 0);
      const exp = expenses.reduce((s, e) => s + e.amount, 0);
      const profit = income - salaries - exp;
      return {
        tool: 'monthProfit',
        success: true,
        data: { income, salaries, expenses: exp, profit, month: start.toISOString().slice(0, 7) },
        message: `ربح الشهر ${start.toISOString().slice(0, 7)}: ${profit.toFixed(2)} دج`,
        display: {
          type: 'card',
          title: `ملخص ${start.toISOString().slice(0, 7)}`,
          cards: [
            { label: 'المداخيل', value: `${income.toFixed(2)} دج`, icon: 'wallet' },
            { label: 'الرواتب', value: `${salaries.toFixed(2)} دج`, icon: 'users' },
            { label: 'المصاريف', value: `${exp.toFixed(2)} دج`, icon: 'receipt' },
            {
              label: 'الربح',
              value: `${profit.toFixed(2)} دج`,
              icon: profit >= 0 ? 'trending-up' : 'trending-down',
            },
          ],
        },
      };
    },
  },

  // 10) studentsByDepartment
  {
    name: 'studentsByDepartment',
    description: 'توزيع الطلاب حسب الأقسام',
    async handler(_ctx, _params) {
      const depts = await db.department.findMany({
        include: { _count: { select: { students: true } } },
      });
      const rows = depts
        .map((d) => ({ name: d.name, count: d._count.students }))
        .sort((a, b) => b.count - a.count);
      return {
        tool: 'studentsByDepartment',
        success: true,
        data: { rows },
        message: `توزيع الطلاب على ${rows.length} قسم`,
        display: {
          type: 'chart',
          title: 'الطلاب حسب القسم',
          chart: {
            type: 'pie',
            data: rows.map((r) => ({ name: r.name, value: r.count })),
            xKey: 'name',
            yKeys: ['value'],
          },
        },
      };
    },
  },

  // 11) roomUtilization
  {
    name: 'roomUtilization',
    description: 'معدل استخدام القاعات (عدد الحصص لكل قاعة)',
    async handler(_ctx, _params) {
      const sessions = await db.timetableSession.findMany({
        select: { roomId: true, roomName: true },
      });
      const map = new Map<string, { name: string; count: number }>();
      for (const s of sessions) {
        if (!s.roomId) continue;
        const ex = map.get(s.roomId) || { name: s.roomName || '-', count: 0 };
        ex.count += 1;
        map.set(s.roomId, ex);
      }
      const rows = Array.from(map.entries())
        .map(([id, v]) => ({ id, name: v.name, sessions: v.count }))
        .sort((a, b) => b.sessions - a.sessions);
      return {
        tool: 'roomUtilization',
        success: true,
        data: { rows },
        message: `استخدام ${rows.length} قاعة`,
        display: {
          type: 'table',
          title: 'استخدام القاعات',
          columns: ['القاعة', 'عدد الحصص'],
          rows: rows.map((r) => [r.name, r.sessions]),
        },
      };
    },
  },

  // 12) checkTeacherConflicts
  {
    name: 'checkTeacherConflicts',
    description: 'كشف تعارضات الأساتذة (نفس الأستاذ، نفس اليوم/الوقت، قاعات مختلفة)',
    async handler(_ctx, _params) {
      const sessions = await db.timetableSession.findMany({
        select: {
          teacherId: true,
          teacherName: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          roomName: true,
          subjectName: true,
        },
      });
      // تجميع حسب (teacherId, dayOfWeek, startTime)
      const map = new Map<string, any[]>();
      for (const s of sessions) {
        if (!s.teacherId) continue;
        const key = `${s.teacherId}|${s.dayOfWeek}|${s.startTime}`;
        const arr = map.get(key) || [];
        arr.push(s);
        map.set(key, arr);
      }
      const conflicts: any[] = [];
      for (const [, arr] of map) {
        if (arr.length > 1) {
          conflicts.push({
            teacher: arr[0].teacherName,
            day: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][arr[0].dayOfWeek],
            time: `${arr[0].startTime} - ${arr[0].endTime}`,
            rooms: arr.map((a) => a.roomName).join(' / '),
            subjects: arr.map((a) => a.subjectName).join(' / '),
          });
        }
      }
      return {
        tool: 'checkTeacherConflicts',
        success: true,
        data: { count: conflicts.length },
        message: `تم اكتشاف ${conflicts.length} تعارض في جدول الأساتذة`,
        display:
          conflicts.length === 0
            ? {
                type: 'text',
                title: 'تعارضات الأساتذة',
              }
            : {
                type: 'table',
                title: 'تعارضات الأساتذة',
                columns: ['الأستاذ', 'اليوم', 'الوقت', 'القاعات', 'المواد'],
                rows: conflicts.map((c) => [
                  c.teacher,
                  c.day,
                  c.time,
                  c.rooms,
                  c.subjects,
                ]),
              },
      };
    },
  },

  // 13) revenueReport
  {
    name: 'revenueReport',
    description: 'تقرير المداخيل التفصيلي للفترة (للمدير)',
    async handler(ctx, params) {
      if (!ctx.isDirector) {
        return {
          tool: 'revenueReport',
          success: false,
          message: 'التقارير المالية متاحة للمدير فقط',
        };
      }
      const monthsBack = parseInt(params?.monthsBack || '3', 10);
      const start = startOfMonth(ctx.now, -monthsBack);
      const end = endOfMonth(ctx.now);
      const payments = await db.studentPayment.findMany({
        where: { paymentDate: { gte: start, lt: end } },
        include: { student: true },
      });
      const byMonth = new Map<string, number>();
      for (const p of payments) {
        const m = p.paymentDate.toISOString().slice(0, 7);
        byMonth.set(m, (byMonth.get(m) || 0) + p.amount);
      }
      const rows = Array.from(byMonth.entries())
        .sort()
        .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
      return {
        tool: 'revenueReport',
        success: true,
        data: { total: payments.reduce((s, p) => s + p.amount, 0), byMonth: rows },
        message: `تقرير المداخيل لآخر ${monthsBack} أشهر`,
        display: {
          type: 'chart',
          title: 'المداخيل الشهرية',
          chart: {
            type: 'bar',
            data: rows,
            xKey: 'month',
            yKeys: ['total'],
          },
        },
      };
    },
  },

  // 14) attendanceReport
  {
    name: 'attendanceReport',
    description: 'تقرير الحضور للفترة',
    async handler(ctx, params) {
      const monthsBack = parseInt(params?.monthsBack || '1', 10);
      const start = startOfMonth(ctx.now, -monthsBack);
      const end = endOfMonth(ctx.now);
      const records = await db.attendance.findMany({
        where: { date: { gte: start, lt: end } },
      });
      const byMonth = new Map<string, { total: number; sessions: number }>();
      for (const r of records) {
        const m = r.date.toISOString().slice(0, 7);
        const ex = byMonth.get(m) || { total: 0, sessions: 0 };
        ex.total += r.totalCount;
        ex.sessions += 1;
        byMonth.set(m, ex);
      }
      const rows = Array.from(byMonth.entries())
        .sort()
        .map(([month, v]) => ({
          month,
          total: v.total,
          avg: v.sessions ? Math.round((v.total / v.sessions) * 10) / 10 : 0,
        }));
      return {
        tool: 'attendanceReport',
        success: true,
        data: { rows },
        message: `تقرير الحضور لآخر ${monthsBack} أشهر`,
        display: {
          type: 'chart',
          title: 'الحضور الشهري',
          chart: {
            type: 'line',
            data: rows,
            xKey: 'month',
            yKeys: ['total', 'avg'],
          },
        },
      };
    },
  },

  // 15) teachersReport
  {
    name: 'teachersReport',
    description: 'تقرير الأساتذة (الساعات، الجلسات، التخصصات)',
    async handler(_ctx, _params) {
      const teachers = await db.teacher.findMany({
        include: {
          attendances: { select: { durationMinutes: true } },
          courses: { select: { id: true } },
          _count: { select: { sessions: true } },
        },
      });
      const rows = teachers
        .map((t) => ({
          name: t.name,
          specialty: t.specialty || '-',
          hours: Math.round(
            (t.attendances.reduce((s, a) => s + a.durationMinutes, 0) / 60) * 10
          ) / 10,
          sessions: t._count.sessions,
          courses: t.courses.length,
          status: t.status,
        }))
        .sort((a, b) => b.hours - a.hours);
      return {
        tool: 'teachersReport',
        success: true,
        data: { count: rows.length, rows },
        message: `تقرير ${rows.length} أستاذ`,
        display: {
          type: 'table',
          title: 'تقرير الأساتذة',
          columns: ['الاسم', 'التخصص', 'الساعات', 'الحصص', 'الدورات'],
          rows: rows.slice(0, 20).map((r) => [
            r.name,
            r.specialty,
            r.hours,
            r.sessions,
            r.courses,
          ]),
        },
      };
    },
  },

  // 16) registrationsReport
  {
    name: 'registrationsReport',
    description: 'تقرير التسجيلات في الدورات',
    async handler(ctx, params) {
      const monthsBack = parseInt(params?.monthsBack || '3', 10);
      const start = startOfMonth(ctx.now, -monthsBack);
      const end = endOfMonth(ctx.now);
      const regs = await db.registration.findMany({
        where: { date: { gte: start, lt: end } },
      });
      const byCourse = new Map<string, number>();
      for (const r of regs) {
        byCourse.set(r.courseName, (byCourse.get(r.courseName) || 0) + 1);
      }
      const rows = Array.from(byCourse.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
      return {
        tool: 'registrationsReport',
        success: true,
        data: { total: regs.length, topCourses: rows },
        message: `${regs.length} تسجيل في آخر ${monthsBack} أشهر`,
        display: {
          type: 'chart',
          title: 'أكثر الدورات تسجيلاً',
          chart: {
            type: 'bar',
            data: rows,
            xKey: 'name',
            yKeys: ['count'],
          },
        },
      };
    },
  },

  // 17) smartSuggestions
  {
    name: 'smartSuggestions',
    description: 'اقتراحات ذكية لتحسين المؤسسة بناءً على البيانات',
    async handler(ctx, _params) {
      const [pendingTasks, overdueTasks, latePayers, lowAttendanceDepts] =
        await Promise.all([
          db.task.count({ where: { completed: false } }),
          db.task.count({
            where: { completed: false, deadline: { lt: ctx.now } },
          }),
          db.installmentPlan.count({
            where: {
              status: { in: ['pending', 'late'] },
              expectedDate: { lt: ctx.now },
            },
          }),
          db.department.findMany({
            include: { _count: { select: { students: true } } },
          }),
        ]);
      const suggestions: string[] = [];
      if (overdueTasks > 0)
        suggestions.push(
          `🔴 عالج ${overdueTasks} مهمة متأخرة عاجلاً لتجنب تراكم العمل.`
        );
      if (pendingTasks > 5)
        suggestions.push(
          `📋 لديك ${pendingTasks} مهمة معلقة، فكّر في إعادة توزيعها على الموظفين.`
        );
      if (latePayers > 0)
        suggestions.push(
          `💰 ${latePayers} قسط غير مدفوع، أرسل تذكيرات للطلاب المتأخرين.`
        );
      const smallestDept = lowAttendanceDepts
        .map((d) => ({ name: d.name, count: d._count.students }))
        .sort((a, b) => a.count - b.count)[0];
      if (smallestDept && smallestDept.count < 5)
        suggestions.push(
          `📈 قسم "${smallestDept.name}" لديه ${smallestDept.count} طلاب فقط، يحتاج حملة تسويق.`
        );
      if (suggestions.length === 0)
        suggestions.push('✅ الوضع العام جيد، لا توجد إشارات تحذيرية.');
      return {
        tool: 'smartSuggestions',
        success: true,
        data: { suggestions },
        message: `${suggestions.length} اقتراحات`,
        display: {
          type: 'text',
          title: 'اقتراحات ذكية',
        },
      };
    },
  },

  // 18) generateReminderMessage
  {
    name: 'generateReminderMessage',
    description: 'توليد رسالة تذكير بالدفع للطلاب المتأخرين',
    async handler(_ctx, params) {
      const studentName = params?.studentName || 'الطالب';
      const amount = params?.amount || 0;
      const month = params?.month || new Date().toISOString().slice(0, 7);
      const msg = `مرحباً ${studentName}،\nنذكّرك بأن لديك قسطاً متأخراً بقيمة ${amount} دج لشهر ${month}.\nيرجى التوجه إلى الإدارة للتسوية في أقرب وقت.\nشكراً لتفهمك.\nإدارة مدرسة السلامة`;
      return {
        tool: 'generateReminderMessage',
        success: true,
        data: { message: msg },
        message: 'تم توليد رسالة التذكير',
        display: {
          type: 'text',
          title: 'رسالة تذكير بالدفع',
        },
      };
    },
  },

  // 19) generateSocialPost
  {
    name: 'generateSocialPost',
    description: 'توليد منشور للشبكات الاجتماعية',
    async handler(_ctx, params) {
      const topic = params?.topic || 'التسجيلات المفتوحة';
      const post = `📢 ${topic}\n\nمرحباً بكم في مدرسة السلامة! 🎓\nنعلن عن فتح أبواب التسجيل للموسم الجديد.\n\n✅ تخصصات متنوعة\n✅ أساتذة مؤهلون\n✅ بيئة تعليمية محفزة\n\n📍 تفضلوا بزيارتنا أو اتصلوا بنا للمزيد من المعلومات.\n#مدرسة_السلامة #التعليم #التسجيل`;
      return {
        tool: 'generateSocialPost',
        success: true,
        data: { post },
        message: 'تم توليد المنشور',
        display: {
          type: 'text',
          title: 'منشور للشبكات الاجتماعية',
        },
      };
    },
  },

  // 20) monthlyStats
  {
    name: 'monthlyStats',
    description: 'إحصائيات شهرية شاملة',
    async handler(ctx, params) {
      const monthsBack = parseInt(params?.monthsBack || '6', 10);
      const start = startOfMonth(ctx.now, -monthsBack);
      const end = endOfMonth(ctx.now);
      const [students, payments, expenses, attendances] = await Promise.all([
        db.student.findMany({ where: { registrationDate: { gte: start, lt: end } } }),
        ctx.isDirector
          ? db.studentPayment.findMany({ where: { paymentDate: { gte: start, lt: end } } })
          : Promise.resolve([]),
        ctx.isDirector
          ? db.expense.findMany({ where: { date: { gte: start, lt: end } } })
          : Promise.resolve([]),
        db.attendance.findMany({ where: { date: { gte: start, lt: end } } }),
      ]);
      const monthsMap = new Map<
        string,
        { students: number; income: number; expenses: number; attendance: number }
      >();
      for (const s of students) {
        const m = s.registrationDate.toISOString().slice(0, 7);
        const ex = monthsMap.get(m) || { students: 0, income: 0, expenses: 0, attendance: 0 };
        ex.students += 1;
        monthsMap.set(m, ex);
      }
      for (const p of payments) {
        const m = p.paymentDate.toISOString().slice(0, 7);
        const ex = monthsMap.get(m) || { students: 0, income: 0, expenses: 0, attendance: 0 };
        ex.income += p.amount;
        monthsMap.set(m, ex);
      }
      for (const e of expenses) {
        const m = e.date.toISOString().slice(0, 7);
        const ex = monthsMap.get(m) || { students: 0, income: 0, expenses: 0, attendance: 0 };
        ex.expenses += e.amount;
        monthsMap.set(m, ex);
      }
      for (const a of attendances) {
        const m = a.date.toISOString().slice(0, 7);
        const ex = monthsMap.get(m) || { students: 0, income: 0, expenses: 0, attendance: 0 };
        ex.attendance += a.totalCount;
        monthsMap.set(m, ex);
      }
      const rows = Array.from(monthsMap.entries())
        .sort()
        .map(([month, v]) => ({ month, ...v }));
      return {
        tool: 'monthlyStats',
        success: true,
        data: { rows },
        message: `إحصائيات ${rows.length} أشهر`,
        display: {
          type: 'chart',
          title: 'الإحصائيات الشهرية',
          chart: {
            type: 'area',
            data: rows,
            xKey: 'month',
            yKeys: ctx.isDirector
              ? ['students', 'income', 'expenses', 'attendance']
              : ['students', 'attendance'],
          },
        },
      };
    },
  },

  // 21) compareMonths
  {
    name: 'compareMonths',
    description: 'مقارنة بين شهرين',
    async handler(ctx, params) {
      const m1 = params?.month1 || -1;
      const m2 = params?.month2 || 0;
      const fetch = async (offset: number) => {
        const start = startOfMonth(ctx.now, offset);
        const end = endOfMonth(ctx.now, offset);
        const [students, payments, attendances] = await Promise.all([
          db.student.count({ where: { registrationDate: { gte: start, lt: end } } }),
          ctx.isDirector
            ? db.studentPayment.aggregate({
                _sum: { amount: true },
                where: { paymentDate: { gte: start, lt: end } },
              })
            : Promise.resolve({ _sum: { amount: 0 } }),
          db.attendance.findMany({ where: { date: { gte: start, lt: end } } }),
        ]);
        return {
          month: start.toISOString().slice(0, 7),
          newStudents: students,
          income: ctx.isDirector ? (payments._sum.amount || 0) : 0,
          attendance: attendances.reduce((s, a) => s + a.totalCount, 0),
        };
      };
      const r1 = await fetch(m1);
      const r2 = await fetch(m2);
      const diff = (a: number, b: number) => (b - a);
      return {
        tool: 'compareMonths',
        success: true,
        data: { month1: r1, month2: r2 },
        message: `مقارنة ${r1.month} و ${r2.month}`,
        display: {
          type: 'table',
          title: `مقارنة ${r1.month} ↔ ${r2.month}`,
          columns: ['المؤشر', r1.month, r2.month, 'الفرق'],
          rows: [
            ['طلاب جدد', r1.newStudents, r2.newStudents, diff(r1.newStudents, r2.newStudents)],
            ctx.isDirector
              ? ['المداخيل (دج)', Math.round(r1.income), Math.round(r2.income), Math.round(diff(r1.income, r2.income))]
              : ['المداخيل', '-', '-', '-'],
            ['الحضور', r1.attendance, r2.attendance, diff(r1.attendance, r2.attendance)],
          ],
        },
      };
    },
  },

  // 22) studentsByStatus
  {
    name: 'studentsByStatus',
    description: 'توزيع الطلاب حسب الحالة',
    async handler(_ctx, _params) {
      const students = await db.student.findMany({ select: { status: true } });
      // JS filter بدل groupBy
      const map = new Map<string, number>();
      const statusLabels: Record<string, string> = {
        registered: 'مسجل',
        continuing: 'مستمر',
        abandoned: 'منقطع',
        postponed: 'مؤجل',
        graduated: 'متخرج',
      };
      for (const s of students) {
        map.set(s.status, (map.get(s.status) || 0) + 1);
      }
      const rows = Array.from(map.entries()).map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
      }));
      return {
        tool: 'studentsByStatus',
        success: true,
        data: { rows },
        message: `توزيع ${students.length} طالب حسب الحالة`,
        display: {
          type: 'chart',
          title: 'الطلاب حسب الحالة',
          chart: {
            type: 'pie',
            data: rows,
            xKey: 'status',
            yKeys: ['count'],
          },
        },
      };
    },
  },

  // 23) topDepartmentsByHours
  {
    name: 'topDepartmentsByHours',
    description: 'أكثر الأقسام من حيث ساعات الحضور',
    async handler(_ctx, _params) {
      const attendances = await db.attendance.findMany({
        where: { course: { departmentId: { not: null } } },
        include: { course: { include: { department: true } } },
        select: {
          durationMinutes: true,
          course: { select: { department: { select: { name: true } } } },
        },
      });
      const map = new Map<string, { name: string; minutes: number }>();
      for (const a of attendances) {
        const dName = a.course?.department?.name;
        if (!dName) continue;
        const ex = map.get(dName) || { name: dName, minutes: 0 };
        ex.minutes += a.durationMinutes || 0;
        map.set(dName, ex);
      }
      const rows = Array.from(map.values())
        .map((v) => ({ name: v.name, hours: Math.round((v.minutes / 60) * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10);
      return {
        tool: 'topDepartmentsByHours',
        success: true,
        data: { rows },
        message: `أكثر ${rows.length} قسم من حيث ساعات التدريس`,
        display: {
          type: 'chart',
          title: 'الأقسام حسب الساعات',
          chart: {
            type: 'bar',
            data: rows,
            xKey: 'name',
            yKeys: ['hours'],
          },
        },
      };
    },
  },
];

export const QUERY_TOOLS = QUERIES;

export function getQueryTool(name: string): QueryTool | undefined {
  return QUERIES.find((q) => q.name === name);
}

export async function runQuery(
  name: string,
  ctx: DataContext,
  params: any = {}
): Promise<ToolResult> {
  const tool = getQueryTool(name);
  if (!tool) {
    return {
      tool: name,
      success: false,
      message: `أداة غير معروفة: ${name}`,
    };
  }
  try {
    return await tool.handler(ctx, params);
  } catch (err: any) {
    return {
      tool: name,
      success: false,
      message: `خطأ في تنفيذ الأداة: ${err?.message || String(err)}`,
    };
  }
}
