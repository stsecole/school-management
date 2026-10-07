import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/report-cards?studentId=xxx
 * أو ?departmentId=xxx (لجميع طلاب القسم)
 *
 * يولّد بطاقة نتائج لطالب واحد أو لكل طلاب قسم:
 * - درجات كل الاختبارات
 * - المعدل المرجح
 * - الترتيب في القسم
 * - عدد الناجحين/الراسبين
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const departmentId = searchParams.get('departmentId');

    // ===== بطاقة طالب واحد =====
    if (studentId) {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          department: { select: { name: true } },
          level: { select: { name: true } },
          specialization: { select: { name: true } },
          grades: {
            include: {
              exam: {
                select: {
                  id: true,
                  title: true,
                  subjectName: true,
                  examDate: true,
                  maxScore: true,
                  passingScore: true,
                  weight: true,
                },
              },
            },
            orderBy: { exam: { examDate: 'desc' } },
          },
        },
      });

      if (!student) {
        return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
      }

      // حساب الدرجات
      const examResults = student.grades.map((g) => {
        const exam = g.exam;
        const percentage = exam.maxScore > 0 ? (g.score / exam.maxScore) * 100 : 0;
        const isPassed = !g.isAbsent && !g.isExcused && g.score >= exam.passingScore;
        const weightedScore = g.score * exam.weight;
        return {
          examId: exam.id,
          examTitle: exam.title,
          subjectName: exam.subjectName || '',
          examDate: exam.examDate.toISOString().split('T')[0],
          score: g.score,
          maxScore: exam.maxScore,
          passingScore: exam.passingScore,
          weight: exam.weight,
          weightedScore,
          percentage: Math.round(percentage * 100) / 100,
          isAbsent: g.isAbsent,
          isExcused: g.isExcused,
          isPassed,
          notes: g.notes,
        };
      });

      // المعدل المرجح
      const validResults = examResults.filter((r) => !r.isAbsent && !r.isExcused);
      const totalWeight = validResults.reduce((s, r) => s + r.weight, 0);
      const totalWeightedScore = validResults.reduce((s, r) => s + r.weightedScore, 0);
      const average = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

      // نسبة النجاح
      const passedCount = validResults.filter((r) => r.isPassed).length;
      const failedCount = validResults.length - passedCount;
      const absentCount = examResults.filter((r) => r.isAbsent).length;
      const passRate = validResults.length > 0 ? Math.round((passedCount / validResults.length) * 100) : 0;

      // الترتيب في القسم
      let rank = 0;
      let totalStudentsInDept = 0;
      if (student.departmentId) {
        const deptStudents = await db.student.findMany({
          where: { departmentId: student.departmentId, status: { in: ['registered', 'continuing'] } },
          select: { id: true },
        });
        totalStudentsInDept = deptStudents.length;

        // حساب معدل كل طالب في القسم
        const deptAverages: { studentId: string; avg: number }[] = [];
        for (const ds of deptStudents) {
          const grades = await db.grade.findMany({
            where: { studentId: ds.id, isAbsent: false, isExcused: false },
            include: { exam: { select: { weight: true, maxScore: true } } },
          });
          if (grades.length > 0) {
            const tw = grades.reduce((s, g) => s + g.exam.weight, 0);
            const tws = grades.reduce((s, g) => s + g.score * g.exam.weight, 0);
            deptAverages.push({ studentId: ds.id, avg: tw > 0 ? tws / tw : 0 });
          }
        }
        // ترتيب تنازلي
        deptAverages.sort((a, b) => b.avg - a.avg);
        const rankEntry = deptAverages.findIndex((d) => d.studentId === studentId);
        rank = rankEntry >= 0 ? rankEntry + 1 : 0;
      }

      // التقدير
      let appreciation = '';
      let appreciationColor = '';
      const avgPercent = validResults.length > 0 && validResults[0]?.maxScore
        ? (average / validResults[0].maxScore) * 100
        : 0;
      if (avgPercent >= 80) { appreciation = 'ممتاز'; appreciationColor = 'emerald'; }
      else if (avgPercent >= 70) { appreciation = 'جيد جداً'; appreciationColor = 'blue'; }
      else if (avgPercent >= 60) { appreciation = 'جيد'; appreciationColor = 'cyan'; }
      else if (avgPercent >= 50) { appreciation = 'مقبول'; appreciationColor = 'amber'; }
      else { appreciation = 'ضعيف'; appreciationColor = 'red'; }

      return NextResponse.json({
        reportCard: {
          student: {
            id: student.id,
            name: student.name,
            studentNumber: student.studentNumber,
            gender: student.gender,
            phone: student.phone,
            department: student.department?.name || '',
            level: student.level?.name || '',
            specialization: student.specialization?.name || '',
          },
          exams: examResults,
          summary: {
            totalExams: examResults.length,
            gradedExams: validResults.length,
            absentCount,
            average: Math.round(average * 100) / 100,
            passedCount,
            failedCount,
            passRate,
            rank,
            totalStudentsInDept,
            appreciation,
            appreciationColor,
          },
          generatedAt: new Date().toISOString(),
        },
      });
    }

    // ===== قائمة طلاب القسم (لاختيار طالب) =====
    if (departmentId) {
      const students = await db.student.findMany({
        where: { departmentId: departmentId || undefined, status: { in: ['registered', 'continuing'] } },
        select: { id: true, name: true, studentNumber: true, department: { select: { name: true } } },
        orderBy: { name: 'asc' },
      });
      return NextResponse.json({ students });
    }

    // ===== قائمة كل الطلاب =====
    const students = await db.student.findMany({
      where: { status: { in: ['registered', 'continuing'] } },
      select: {
        id: true, name: true, studentNumber: true,
        department: { select: { name: true } },
        _count: { select: { grades: true } },
      },
      orderBy: { name: 'asc' },
    });

    // فقط الطلاب الذين لديهم درجات
    const studentsWithGrades = students.filter((s) => s._count.grades > 0);

    return NextResponse.json({ students: studentsWithGrades });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/report-cards error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
