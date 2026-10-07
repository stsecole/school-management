// ===== GET /api/search?q=...&limit=20 =====
// بحث موحّد عبر كل الأقسام: طلاب، أساتذة، أقسام، دورات، فواتير، عملاء محتملون
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50);

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [], counts: {} });
    }

    const branchFilter = await getBranchFilter();
    const qLower = q.toLowerCase();
    const qUpper = q.toUpperCase();

    const contains = (field: string) => [
      { [field]: { contains: q } } as any,
      { [field]: { contains: qLower } } as any,
      { [field]: { contains: qUpper } } as any,
    ];

    const [
      students,
      teachers,
      departments,
      courses,
      leads,
      payments,
      tasks,
    ] = await Promise.all([
      db.student.findMany({
        where: {
          ...branchFilter,
          OR: [
            ...contains('name'),
            ...contains('studentNumber'),
            ...contains('phone'),
            ...contains('email'),
          ],
        },
        select: {
          id: true, name: true, studentNumber: true, phone: true,
          status: true, gender: true,
          department: { select: { name: true } },
        },
        take: limit,
      }),
      db.teacher.findMany({
        where: {
          ...branchFilter,
          OR: [
            ...contains('name'),
            ...contains('phone'),
            ...contains('email'),
          ],
        },
        select: {
          id: true, name: true, phone: true, gender: true, status: true,
          _count: { select: { courses: true } },
        },
        take: limit,
      }),
      db.department.findMany({
        where: {
          OR: [
            ...contains('name'),
            ...contains('code'),
          ],
        },
        select: {
          id: true, name: true, code: true,
          _count: { select: { students: { where: branchFilter }, teachers: { where: branchFilter }, courses: true } },
        },
        take: limit,
      }),
      db.course.findMany({
        where: {
          OR: [
            ...contains('name'),
            ...contains('code'),
          ],
        },
        select: {
          id: true, name: true, code: true,
          department: { select: { name: true } },
        },
        take: limit,
      }),
      isDirector ? db.lead.findMany({
        where: {
          ...branchFilter,
          OR: [
            ...contains('fullName'),
            ...contains('phone'),
            ...contains('phone2'),
            ...contains('email'),
          ],
        },
        select: {
          id: true, fullName: true, phone: true, status: true,
        },
        take: limit,
      }) : Promise.resolve([]),
      isDirector ? db.studentPayment.findMany({
        where: {
          ...branchFilter,
          OR: [
            ...contains('receiptNumber'),
            { student: { name: { contains: q } } },
          ],
        },
        select: {
          id: true, receiptNumber: true, amount: true, paymentDate: true, paymentType: true,
          student: { select: { name: true, studentNumber: true } },
        },
        orderBy: { paymentDate: 'desc' },
        take: limit,
      }) : Promise.resolve([]),
      db.task.findMany({
        where: {
          ...branchFilter,
          OR: [
            ...contains('title'),
            ...contains('responsible'),
          ],
        },
        select: {
          id: true, title: true, priority: true, responsible: true, completed: true, deadline: true,
        },
        take: limit,
      }),
    ]);

    type Result = {
      id: string;
      type: 'student' | 'teacher' | 'department' | 'course' | 'lead' | 'payment' | 'task';
      typeLabel: string;
      title: string;
      subtitle: string;
      badge?: string;
      section: string;
      extra?: any;
    };

    const results: Result[] = [];

    for (const s of students) {
      results.push({
        id: s.id,
        type: 'student',
        typeLabel: 'طالب',
        title: s.name,
        subtitle: [
          s.studentNumber ? `#${s.studentNumber}` : null,
          s.department?.name || null,
          s.phone || null,
        ].filter(Boolean).join(' • '),
        badge: s.status,
        section: 'students',
        extra: { studentId: s.id },
      });
    }

    for (const t of teachers) {
      results.push({
        id: t.id,
        type: 'teacher',
        typeLabel: 'أستاذ',
        title: t.name,
        subtitle: [
          t.phone || null,
          `${t._count.courses} دورة`,
        ].filter(Boolean).join(' • '),
        badge: t.status === 'active' ? 'نشط' : t.status,
        section: 'teachers',
      });
    }

    for (const d of departments) {
      results.push({
        id: d.id,
        type: 'department',
        typeLabel: 'قسم',
        title: d.name,
        subtitle: [
          d.code ? `رمز: ${d.code}` : null,
          `${d._count.students} طالب`,
          `${d._count.teachers} أستاذ`,
          `${d._count.courses} دورة`,
        ].filter(Boolean).join(' • '),
        section: 'departments',
      });
    }

    for (const c of courses) {
      results.push({
        id: c.id,
        type: 'course',
        typeLabel: 'مادة',
        title: c.name,
        subtitle: [
          c.code ? `#${c.code}` : null,
          c.department?.name || null,
        ].filter(Boolean).join(' • '),
        section: 'departments',
      });
    }

    for (const l of leads) {
      results.push({
        id: l.id,
        type: 'lead',
        typeLabel: 'عميل محتمل',
        title: l.fullName,
        subtitle: [
          l.phone || null,
          l.status || null,
        ].filter(Boolean).join(' • '),
        badge: l.status,
        section: 'crm',
      });
    }

    for (const p of payments) {
      results.push({
        id: p.id,
        type: 'payment',
        typeLabel: 'دفعة',
        title: `${p.amount.toLocaleString('ar-DZ')} دج`,
        subtitle: [
          `وصل: ${p.receiptNumber}`,
          p.student?.name || null,
          new Date(p.paymentDate).toLocaleDateString('ar'),
        ].filter(Boolean).join(' • '),
        badge: p.paymentType,
        section: 'finance',
      });
    }

    for (const t of tasks) {
      results.push({
        id: t.id,
        type: 'task',
        typeLabel: 'مهمة',
        title: t.title,
        subtitle: [
          t.responsible || null,
          t.deadline ? `آجل: ${new Date(t.deadline).toLocaleDateString('ar')}` : null,
        ].filter(Boolean).join(' • '),
        badge: t.completed ? 'مكتملة' : t.priority,
        section: 'tasks',
      });
    }

    const typeOrder = ['student', 'teacher', 'department', 'course', 'lead', 'payment', 'task'];
    results.sort((a, b) => {
      const t = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      if (t !== 0) return t;
      return a.title.localeCompare(b.title, 'ar');
    });

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.type] = (counts[r.type] || 0) + 1;
    }

    return NextResponse.json({
      query: q,
      total: results.length,
      counts,
      results: results.slice(0, limit * 2),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/search error:', error);
    return NextResponse.json({ error: 'خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
