import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/exams
 * يعيد قائمة الامتحانات مع الفلاتر والإحصائيات
 * - departmentId, status, search, term
 * - يتضمن _count grades وإحصائيات (average, highest, lowest, passRate)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const term = searchParams.get('term');
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (departmentId && departmentId !== 'all') where.departmentId = departmentId;
    if (status && status !== 'all') where.status = status;
    if (term && term !== 'all') where.term = term;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const exams = await db.exam.findMany({
      where,
      include: {
        department: true,
        level: true,
        course: true,
        _count: { select: { grades: true } },
      },
      orderBy: { examDate: 'desc' },
    });

    // حساب الإحصائيات لكل امتحان
    const examsWithStats = await Promise.all(
      exams.map(async (e) => {
        const grades = await db.grade.findMany({
          where: {
            examId: e.id,
            // استثناء الغائبين غير المبررين من حساب المعدل
            isAbsent: false,
            OR: [
              { isExcused: false },
              { isExcused: true },
            ],
            score: { not: null },
          },
          select: { score: true, isAbsent: true, isExcused: true },
        });

        // فلترة الغائبين غير المبررين من حساب المعدل
        const validGrades = grades.filter(g => !(g.isAbsent && !g.isExcused));
        const scores = validGrades.map(g => g.score as number);
        const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const highest = scores.length > 0 ? Math.max(...scores) : 0;
        const lowest = scores.length > 0 ? Math.min(...scores) : 0;
        const passed = scores.filter(s => s >= e.passingScore).length;
        const passRate = scores.length > 0 ? Math.round((passed / scores.length) * 100) : 0;

        return {
          ...e,
          stats: {
            average: Math.round(average * 100) / 100,
            highest: Math.round(highest * 100) / 100,
            lowest: Math.round(lowest * 100) / 100,
            passRate,
            gradedCount: scores.length,
          },
        };
      })
    );

    return NextResponse.json({ exams: examsWithStats });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/exams error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/exams
 * إنشاء امتحان جديد
 * - إذا كان autoEnroll=true يُنشئ درجات فارغة لكل طلاب القسم
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!body.title || !body.examDate) {
      return NextResponse.json(
        { error: 'العنوان وتاريخ الامتحان مطلوبان' },
        { status: 400 }
      );
    }

    const exam = await db.exam.create({
      data: {
        title: body.title,
        examDate: new Date(body.examDate),
        maxScore: body.maxScore ? parseFloat(body.maxScore) : 20,
        passingScore: body.passingScore ? parseFloat(body.passingScore) : 10,
        weight: body.weight ? parseFloat(body.weight) : 1,
        term: body.term || 'first',
        status: body.status || 'scheduled',
        departmentId: body.departmentId || null,
        levelId: body.levelId || null,
        courseId: body.courseId || null,
        notes: body.notes || null,
      },
      include: {
        department: true,
        level: true,
        course: true,
        _count: { select: { grades: true } },
      },
    });

    // التسجيل التلقائي للطلاب
    if (body.autoEnroll && body.departmentId) {
      const studentWhere: any = { departmentId: body.departmentId };
      if (body.levelId) studentWhere.levelId = body.levelId;
      const students = await db.student.findMany({
        where: studentWhere,
        select: { id: true },
      });
      if (students.length > 0) {
        // إنشاء درجات فارغة (تجاهل التكرارات عبر @@unique)
        const gradeData = students.map(s => ({
          examId: exam.id,
          studentId: s.id,
          score: null,
        }));
        await db.$transaction(
          gradeData.map(g =>
            db.grade.upsert({
              where: {
                examId_studentId: { examId: g.examId, studentId: g.studentId },
              },
              update: {},
              create: g,
            })
          )
        );
      }
    }

    return NextResponse.json({ exam }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/exams error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
