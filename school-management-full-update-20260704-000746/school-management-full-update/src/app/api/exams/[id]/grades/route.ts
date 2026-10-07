import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * PUT /api/exams/[id]/grades
 * تحديث جماعي للدرجات
 * body: { grades: [{ id, score, isAbsent, isExcused, notes }] }
 * - score قد يكون null (لم يُدخل)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const grades = body.grades;

    if (!Array.isArray(grades)) {
      return NextResponse.json(
        { error: 'يجب إرسال مصفوفة grades' },
        { status: 400 }
      );
    }

    // التحقق من وجود الامتحان
    const exam = await db.exam.findUnique({ where: { id } });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    // تحديث كل درجة في معاملة واحدة
    await db.$transaction(
      grades.map((g: any) =>
        db.grade.update({
          where: { id: g.id },
          data: {
            score: g.score !== undefined && g.score !== '' && g.score !== null ? parseFloat(g.score) : null,
            isAbsent: !!g.isAbsent,
            isExcused: !!g.isExcused,
            notes: g.notes !== undefined ? (g.notes || null) : undefined,
          },
        })
      )
    );

    // إعادة حساب الإحصائيات بعد التحديث
    const allGrades = await db.grade.findMany({
      where: { examId: id },
    });
    const validGrades = allGrades.filter(g => g.score !== null && !(g.isAbsent && !g.isExcused));
    const scores = validGrades.map(g => g.score as number);
    const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;
    const passed = scores.filter(s => s >= exam.passingScore).length;
    const passRate = scores.length > 0 ? Math.round((passed / scores.length) * 100) : 0;

    return NextResponse.json({
      message: 'تم حفظ الدرجات بنجاح',
      updatedCount: grades.length,
      stats: {
        average: Math.round(average * 100) / 100,
        highest: Math.round(highest * 100) / 100,
        lowest: Math.round(lowest * 100) / 100,
        passRate,
        totalStudents: allGrades.length,
        gradedCount: scores.length,
        absentCount: allGrades.filter(g => g.isAbsent).length,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/exams/[id]/grades error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ الدرجات' }, { status: 500 });
  }
}

/**
 * POST /api/exams/[id]/grades
 * إضافة طلاب إلى الامتحان (إنشاء درجات فارغة)
 * body: { studentIds: string[] } | { departmentId: string, levelId?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const exam = await db.exam.findUnique({ where: { id } });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    let studentIds: string[] = [];

    if (Array.isArray(body.studentIds)) {
      studentIds = body.studentIds;
    } else if (body.departmentId) {
      // إضافة كل طلاب القسم (اختيارياً مع المستوى)
      const where: any = { departmentId: body.departmentId };
      if (body.levelId) where.levelId = body.levelId;
      const students = await db.student.findMany({
        where,
        select: { id: true },
      });
      studentIds = students.map(s => s.id);
    } else {
      return NextResponse.json(
        { error: 'يرجى إرسال studentIds أو departmentId' },
        { status: 400 }
      );
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'لا يوجد طلاب للإضافة', addedCount: 0 });
    }

    // إنشاء درجات فارغة (تجاهل الموجودين عبر upsert)
    const result = await db.$transaction(
      studentIds.map(studentId =>
        db.grade.upsert({
          where: { examId_studentId: { examId: id, studentId } },
          update: {},
          create: { examId: id, studentId, score: null },
        })
      )
    );

    return NextResponse.json({
      message: 'تمت إضافة الطلاب للامتحان',
      addedCount: result.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/exams/[id]/grades error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإضافة' }, { status: 500 });
  }
}
