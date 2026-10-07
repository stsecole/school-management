// ===== POST /api/reports/ai-analysis — تحليل ذكي مباشر =====
// مستقل تماماً — يستدعي المزود المفعّل مباشرة باستخدام fetch()
// يدعم: Groq, Gemini, OpenAI, DeepSeek
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function getAIConfig(): Promise<{ provider: string; apiKey: string; model: string } | null> {
  const [providerRow, keyRow, modelRow] = await Promise.all([
    db.setting.findUnique({ where: { key: 'ai_provider' } }),
    db.setting.findUnique({ where: { key: 'ai_api_key' } }),
    db.setting.findUnique({ where: { key: 'ai_model' } }),
  ]);
  const apiKey = keyRow?.value || '';
  if (!apiKey || apiKey.length < 10) return null;
  return {
    provider: providerRow?.value || 'groq',
    apiKey,
    model: modelRow?.value || 'llama-3.1-8b-instant',
  };
}

async function callAI(config: { provider: string; apiKey: string; model: string }, systemPrompt: string, userPrompt: string): Promise<string> {
  const { provider, apiKey, model } = config;

  if (provider === 'gemini') {
    // Gemini uses a different API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 1500 },
      }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`Gemini ${res.status}: ${t.substring(0, 200)}`); }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  }

  // Groq, OpenAI, DeepSeek all use OpenAI-compatible API
  const baseUrl = provider === 'groq' ? 'https://api.groq.com/openai/v1'
    : provider === 'openai' ? 'https://api.openai.com/v1'
    : provider === 'deepseek' ? 'https://api.deepseek.com/v1'
    : 'https://api.groq.com/openai/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.6, max_tokens: 1500,
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`${provider} ${res.status}: ${t.substring(0, 200)}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const isDirector = user.role === 'director';
    const body = await request.json();
    const year = body.year ? parseInt(body.year) : new Date().getFullYear();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const [studentsCount, teachersCount, departmentsCount, attendanceCount, tasksCount, pendingTasks, completedTasks, overdueTasks, departments, studentPayments, teacherPayments, expenses] = await Promise.all([
      db.student.count(), db.teacher.count(), db.department.count(),
      db.attendance.count({ where: { date: { gte: yearStart, lt: yearEnd } } }),
      db.task.count({ where: { OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] } }),
      db.task.count({ where: { completed: false, OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] } }),
      db.task.count({ where: { completed: true, OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] } }),
      db.task.count({ where: { completed: false, deadline: { lt: new Date(), gte: yearStart, lt: yearEnd } } }),
      db.department.findMany({ include: { _count: { select: { students: true, teachers: true, courses: true } } } }),
      isDirector ? db.studentPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd } } }) : Promise.resolve([]),
      isDirector ? db.teacherPayment.findMany({ where: { paymentDate: { gte: yearStart, lt: yearEnd } } }) : Promise.resolve([]),
      isDirector ? db.expense.findMany({ where: { date: { gte: yearStart, lt: yearEnd } } }) : Promise.resolve([]),
    ]);

    const totalIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
    const totalTeacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
    const totalSecondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);

    const dataSummary = {
      year, counts: { students: studentsCount, teachers: teachersCount, departments: departmentsCount, attendances: attendanceCount, tasks: tasksCount, pendingTasks, completedTasks, overdueTasks },
      finance: isDirector ? { totalIncome, totalExpense: totalTeacherExpense + totalSecondaryExpense, totalTeacherExpense, totalSecondaryExpense, balance: totalIncome - totalTeacherExpense - totalSecondaryExpense } : null,
      departments: departments.map(d => ({ name: d.name, students: d._count.students, teachers: d._count.teachers, courses: d._count.courses })),
    };

    const systemPrompt = `أنت محلل بيانات خبير في المؤسسات التعليمية. حلل بيانات مدرسة باللغة العربية بصيغة Markdown. أعطِ تحليلاً مختصراً بالبنية التالية:

# تحليل أداء المؤسسة - السنة ${year}
## 1. نظرة عامة (3-4 أسطر)
## 2. نقاط الضعف (3-5 نقاط)
## 3. أداء الموظفين (3-4 نقاط)
## 4. مقارنات (3-4 نقاط)
## 5. التوصيات (5 توصيات)
استخدم الأرقام الفعلية.`;

    const userPrompt = `حلّل بيانات مدرسة السلامة للسنة ${year}:\n\n${JSON.stringify(dataSummary, null, 2)}`;

    let analysis = '';
    let usedFallback = false;
    const config = await getAIConfig();

    if (config) {
      try {
        console.log('[AI] Calling', config.provider, '...');
        analysis = await callAI(config, systemPrompt, userPrompt);
        console.log('[AI] Responded, length:', analysis.length);
        if (!analysis.trim()) { analysis = generateFallback(dataSummary); usedFallback = true; }
      } catch (err: any) {
        console.error('[AI] Failed:', err.message);
        analysis = `# تعذر الاتصال بـ ${config.provider}\n\nالخطأ: ${err.message}\n\n## التحليل المحلي\n\n` + generateFallback(dataSummary);
        usedFallback = true;
      }
    } else {
      analysis = generateFallback(dataSummary);
      usedFallback = true;
    }

    return NextResponse.json({ analysis, usedFallback, year });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

function generateFallback(data: any): string {
  const c = data.counts; const f = data.finance;
  let md = `# تحليل أداء المؤسسة - السنة ${data.year}\n\n## 1. نظرة عامة\n\nالمؤسسة تضم ${c.students} طالب و${c.teachers} أستاذ في ${c.departments} قسم. ${c.attendances} سجل حضور و${c.tasks} مهمة. `;
  if (f) md += `المداخيل ${f.totalIncome.toLocaleString('ar-DZ')} دج، المصاريف ${f.totalExpense.toLocaleString('ar-DZ')} دج.\n\n`;
  md += `## 2. نقاط الضعف\n\n- ${c.overdueTasks} مهمة متأخرة\n- نسبة الإكمال: ${c.tasks > 0 ? Math.round((c.completedTasks / c.tasks) * 100) : 0}%\n\n## 3. التوصيات\n\n1. متابعة المهام المتأخرة\n2. تحسين الحضور\n3. مراجعة المصاريف\n4. اجتماعات دورية\n5. تحفيز الموظفين\n`;
  return md;
}
