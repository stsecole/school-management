import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/reports/ai-analysis
 * { year, analysisType }
 *
 * يجمع ملخص البيانات ويُرسله إلى نموذج اللغة (ZAI) مع تعليمات عربية
 * - يحلل: نظرة عامة، نقاط الضعف، أداء الموظفين، مقارنات، 5 توصيات
 * - في حال فشل LLM، يستخدم دالة احتياطية تُولّد تحليلاً محلياً
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';

    const body = await request.json();
    const year = body.year ? parseInt(body.year) : new Date().getFullYear();
    const analysisType = body.analysisType || 'general';

    // ===== جمع البيانات السريعة =====
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const [
      studentsCount,
      teachersCount,
      departmentsCount,
      attendanceCount,
      tasksCount,
      pendingTasks,
      completedTasks,
      overdueTasks,
      departments,
      attendanceRecords,
      tasks,
      studentPayments,
      teacherPayments,
      expenses,
    ] = await Promise.all([
      db.student.count(),
      db.teacher.count(),
      db.department.count(),
      db.attendance.count({ where: { date: { gte: yearStart, lt: yearEnd } } }),
      db.task.count({
        where: {
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: false,
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: true,
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      db.task.count({
        where: {
          completed: false,
          deadline: { lt: new Date(), gte: yearStart, lt: yearEnd },
        },
      }),
      db.department.findMany({
        include: { _count: { select: { students: true, teachers: true } } },
      }),
      db.attendance.findMany({
        where: { date: { gte: yearStart, lt: yearEnd } },
      }),
      db.task.findMany({
        where: {
          OR: [
            { startDate: { gte: yearStart, lt: yearEnd } },
            { deadline: { gte: yearStart, lt: yearEnd } },
          ],
        },
      }),
      isDirector
        ? db.studentPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd } } })
        : Promise.resolve([]),
      isDirector
        ? db.teacherPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd } } })
        : Promise.resolve([]),
      isDirector
        ? db.expense.findMany({ where: { date: { gte: yearStart, lt: yearEnd } } })
        : Promise.resolve([]),
    ]);

    // ===== ملخص البيانات =====
    const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
    const totalTeacherSalaries = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0) + totalTeacherSalaries;
    const totalAttendance = attendanceRecords.reduce((s, a) => s + a.totalCount, 0);

    // ترتيب الموظفين حسب إكمال المهام
    const empMap: Record<string, { total: number; completed: number }> = {};
    for (const t of tasks) {
      if (!t.responsible) continue;
      if (!empMap[t.responsible]) empMap[t.responsible] = { total: 0, completed: 0 };
      empMap[t.responsible].total += 1;
      if (t.completed) empMap[t.responsible].completed += 1;
    }
    const employeeStats = Object.entries(empMap).map(([name, d]) => ({
      name,
      total: d.total,
      completed: d.completed,
      rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    }));

    const dataSummary = {
      year,
      type: analysisType,
      counts: {
        students: studentsCount,
        teachers: teachersCount,
        departments: departmentsCount,
        attendances: attendanceCount,
        totalAttendanceRecords: totalAttendance,
        tasks: tasksCount,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      departments: departments.map(d => ({
        name: d.name,
        students: d._count.students,
        teachers: d._count.teachers,
      })),
      finance: isDirector
        ? {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            teacherSalaries: totalTeacherSalaries,
            secondaryExpenses: expenses.reduce((s, e) => s + e.amount, 0),
          }
        : null,
      employeeStats,
    };

    // ===== بناء تعليمات النظام باللغة العربية =====
    const systemPrompt = `أنت محلل بيانات خبير في المؤسسات التعليمية. مهمتك تحليل بيانات مدرسة وإنتاج تقرير منظم.
أجب باللغة العربية وبصيغة Markdown مع الالتزام الصارم بالبنية التالية:

# تحليل أداء المؤسسة - السنة ${year}

## 1. نظرة عامة
ملخص شامل للوضع العام للمؤسسة بناءً على الأرقام.

## 2. نقاط الضعف
تحديد المشاكل الرئيسية (مثل المهام المتأخرة، انخفاض الحضور، إلخ).

## 3. أداء الموظفين
تحليل أداء الموظفين حسب نسبة إكمال المهام مع ذكر أسمائهم.

## 4. مقارنات
مقارنة بين الأقسام والأداء الشهري إن أمكن.

## 5. التوصيات (5 توصيات)
قائمة مرقمة بـ 5 توصيات عملية وقابلة للتنفيذ.

استخدم الأرقام الفعلية الواردة في البيانات. اجعل الإجابة دقيقة ومختصرة.`;

    const userPrompt = `حلّل بيانات مدرسة السلامة للسنة ${year}:\n\n${JSON.stringify(dataSummary, null, 2)}`;

    // ===== محاولة استدعاء LLM =====
    let analysis = '';
    let usedFallback = false;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      analysis = completion.choices?.[0]?.message?.content || '';
      if (!analysis.trim()) {
        analysis = generateFallbackAnalysis(dataSummary);
        usedFallback = true;
      }
    } catch (err: any) {
      console.error('AI analysis failed, using fallback:', err?.message || err);
      analysis = generateFallbackAnalysis(dataSummary);
      usedFallback = true;
    }

    return NextResponse.json({
      analysis,
      usedFallback,
      year,
      analysisType,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/reports/ai-analysis error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحليل' }, { status: 500 });
  }
}

/**
 * دالة احتياطية تُولّد تحليلاً محلياً عند فشل LLM
 */
function generateFallbackAnalysis(data: any): string {
  const c = data.counts;
  const completionRate = c.tasks > 0 ? Math.round((c.completedTasks / c.tasks) * 100) : 0;
  const empList = (data.employeeStats || [])
    .sort((a: any, b: any) => b.rate - a.rate)
    .slice(0, 5)
    .map((e: any) => `- **${e.name}**: ${e.completed}/${e.total} مهمة (${e.rate}%)`)
    .join('\n');

  const financeSection = data.finance
    ? `- إجمالي المداخيل: ${data.finance.totalIncome.toLocaleString('ar-DZ')} دج\n- إجمالي المصاريف: ${data.finance.totalExpenses.toLocaleString('ar-DZ')} دج\n- الرصيد: ${data.finance.balance.toLocaleString('ar-DZ')} دج`
    : 'البيانات المالية متاحة للمدير فقط.';

  const depts = (data.departments || [])
    .map((d: any) => `- ${d.name}: ${d.students} طالب، ${d.teachers} أستاذ`)
    .join('\n');

  return `# تحليل أداء المؤسسة - السنة ${data.year}

## 1. نظرة عامة
تضم المؤسسة **${c.students}** طالباً و**${c.teachers}** أستاذاً موزعين على **${c.departments}** قسم. تم تسجيل **${c.attendances}** جلسة حضور بإجمالي **${c.totalAttendanceRecords}** حضور. كما تم تتبع **${c.tasks}** مهمة خلال السنة.

## 2. نقاط الضعف
- عدد المهام المعلقة: **${c.pendingTasks}** مهمة.
- عدد المهام المتأخرة: **${c.overdueTasks}** مهمة - تتطلب تدخلاً عاجلاً.
- نسبة إكمال المهام: **${completionRate}%** ${completionRate < 70 ? '(منخفضة)' : '(مقبولة)'}.

## 3. أداء الموظفين
ترتيب الموظفين حسب إكمال المهام:
${empList || '- لا توجد بيانات كافية.'}

## 4. مقارنات
توزيع الطلاب والأساتذة حسب الأقسام:
${depts || '- لا توجد أقسام.'}

البيانات المالية:
${financeSection}

## 5. التوصيات (5 توصيات)
1. **معالجة المهام المتأخرة**: عقد اجتماع عاجل لمراجعة ${c.overdueTasks} مهمة متأخرة وإعادة توزيعها.
2. **متابعة الموظفين ذات الأداء المنخفض**: تقديم دعم وتدريب لمن هم دون 50% نسبة إكمال.
3. **تحسين نظام الحضور**: مراجعة الجلسات ذات الحضور المنخفض وتحفيز الطلاب.
4. **التوازن المالي**: ${data.finance && data.finance.balance < 0 ? 'مراجعة المصاريف لتحقيق التوازن.' : 'الحفاظ على الفائض الحالي واستثماره في تطوير المؤسسة.'}
5. **تقييم الأقسام**: إجراء تقييم دوري للأقسام لتحديد الأقسام الناجحة وتطويرها.

> _هذا التحليل تم توليده محلياً (بدون LLM) بسبب عدم توفر خدمة الذكاء الاصطناعي._
`;
}
