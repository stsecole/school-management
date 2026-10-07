// ===== POST /api/reports/branch-ai-analysis — مقارنة فروع ذكية =====
// مستقل تماماً — يدعم: Groq, Gemini, OpenAI, DeepSeek
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

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
  return { provider: providerRow?.value || 'groq', apiKey, model: modelRow?.value || 'llama-3.1-8b-instant' };
}

async function callAI(config: { provider: string; apiKey: string; model: string }, systemPrompt: string, userPrompt: string): Promise<string> {
  const { provider, apiKey, model } = config;
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: systemPrompt, contents: [{ role: 'user', parts: [{ text: userPrompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 1500 } }) });
    if (!res.ok) { const t = await res.text(); throw new Error(`Gemini ${res.status}: ${t.substring(0, 200)}`); }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  }
  const baseUrl = provider === 'groq' ? 'https://api.groq.com/openai/v1' : provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'deepseek' ? 'https://api.deepseek.com/v1' : 'https://api.groq.com/openai/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.6, max_tokens: 1500 }) });
  if (!res.ok) { const t = await res.text(); throw new Error(`${provider} ${res.status}: ${t.substring(0, 200)}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const year = body.year ? parseInt(body.year) : new Date().getFullYear();
    const yearStart = new Date(year, 0, 1); const yearEnd = new Date(year + 1, 0, 1);
    const branches = await db.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    if (branches.length === 0) return NextResponse.json({ analysis: 'لا توجد فروع نشطة.', usedFallback: true, year });

    const branchSummaries = await Promise.all(branches.map(async (branch) => {
      const [students, teachers, newStudents, attendances, tasks, completedTasks, overdueTasks, studentPayments, teacherPayments, expenses] = await Promise.all([
        db.student.count({ where: { branchId: branch.id, status: { in: ['registered', 'continuing'] } } }),
        db.teacher.count({ where: { branchId: branch.id, status: 'active' } }),
        db.student.count({ where: { branchId: branch.id, registrationDate: { gte: yearStart, lt: yearEnd } } }),
        db.attendance.count({ where: { branchId: branch.id, date: { gte: yearStart, lt: yearEnd } } }),
        db.task.count({ where: { branchId: branch.id, OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] } }),
        db.task.count({ where: { branchId: branch.id, completed: true, OR: [{ startDate: { gte: yearStart, lt: yearEnd } }, { deadline: { gte: yearStart, lt: yearEnd } }] } }),
        db.task.count({ where: { branchId: branch.id, completed: false, deadline: { lt: new Date(), gte: yearStart, lt: yearEnd } } }),
        db.studentPayment.findMany({ where: { branchId: branch.id, paymentDate: { gte: yearStart, lt: yearEnd } }, select: { amount: true } }),
        db.teacherPayment.findMany({ where: { teacher: { branchId: branch.id }, paymentDate: { gte: yearStart, lt: yearEnd } }, select: { amount: true } }),
        db.expense.findMany({ where: { branchId: branch.id, date: { gte: yearStart, lt: yearEnd } }, select: { amount: true } }),
      ]);
      const studentIncome = studentPayments.reduce((s, p) => s + p.amount, 0);
      const teacherExpense = teacherPayments.reduce((s, p) => s + p.amount, 0);
      const secondaryExpense = expenses.reduce((s, e) => s + e.amount, 0);
      return { name: branch.name, students, teachers, newStudents, attendances, tasks, completedTasks, overdueTasks, taskCompletionRate: tasks > 0 ? Math.round((completedTasks / tasks) * 100) : 0, studentIncome, teacherExpense, secondaryExpense, totalExpenses: teacherExpense + secondaryExpense, balance: studentIncome - teacherExpense - secondaryExpense, margin: studentIncome > 0 ? Math.round(((studentIncome - teacherExpense - secondaryExpense) / studentIncome) * 100) : 0 };
    }));

    const dataSummary = { year, branchCount: branchSummaries.length, branches: branchSummaries, totals: { students: branchSummaries.reduce((s, b) => s + b.students, 0), studentIncome: branchSummaries.reduce((s, b) => s + b.studentIncome, 0), totalExpenses: branchSummaries.reduce((s, b) => s + b.totalExpenses, 0), balance: branchSummaries.reduce((s, b) => s + b.balance, 0) } };

    const systemPrompt = `أنت محلل بيانات مالي خبير. حلل مقارنة فروع مدرسة باللغة العربية بصيغة Markdown. أعطِ تحليلاً مختصراً:

# تحليل مقارنة الفروع - ${year}
## ملخص تنفيذي (3-4 أسطر)
## المقارنة المالية (3-5 نقاط)
## المقارنة الأكاديمية والمهام (3-4 نقاط)
## الفروع الأفضل والأسوأ
## 5 توصيات استراتيجية
استخدم الأرقام الفعلية.`;

    const userPrompt = `حلل بيانات ${dataSummary.branchCount} فروع لسنة ${year}:\n\n${JSON.stringify(dataSummary, null, 2)}`;

    let analysis = ''; let usedFallback = false;
    const config = await getAIConfig();
    if (config) {
      try {
        console.log('[Branch AI] Calling', config.provider, '...');
        analysis = await callAI(config, systemPrompt, userPrompt);
        console.log('[Branch AI] Responded, length:', analysis.length);
        if (!analysis.trim()) { analysis = generateFallback(dataSummary); usedFallback = true; }
      } catch (err: any) {
        console.error('[Branch AI] Failed:', err.message);
        analysis = `# تعذر الاتصال بـ ${config.provider}\n\nالخطأ: ${err.message}\n\n## التحليل المحلي\n\n` + generateFallback(dataSummary);
        usedFallback = true;
      }
    } else { analysis = generateFallback(dataSummary); usedFallback = true; }

    return NextResponse.json({ analysis, usedFallback, year });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    return NextResponse.json({ error: 'Server error: ' + (error.message || '') }, { status: 500 });
  }
}

function generateFallback(data: any): string {
  const branches: any[] = data.branches; const total = data.totals;
  const byBalance = [...branches].sort((a, b) => b.balance - a.balance);
  const best = byBalance[0]; const worst = byBalance[byBalance.length - 1];
  let md = `# تحليل مقارنة الفروع - السنة ${data.year}\n\n## 1. ملخص تنفيذي\n\nيضم النظام **${branches.length}** فرعاً. إجمالي المداخيل **${total.studentIncome.toLocaleString('ar-DZ')} دج** والمصاريف **${total.totalExpenses.toLocaleString('ar-DZ')} دج**. الفرع **${best.name}** الأفضل أداءً، بينما يحتاج **${worst.name}** لتدخل.\n\n`;
  md += `## 2. المقارنة المالية\n\n| الفرع | المداخيل | المصاريف | الرصيد | الهامش |\n|-------|---------|---------|--------|--------|\n`;
  for (const b of branches) md += `| ${b.name} | ${b.studentIncome.toLocaleString('ar-DZ')} | ${b.totalExpenses.toLocaleString('ar-DZ')} | ${b.balance.toLocaleString('ar-DZ')} | ${b.margin}% |\n`;
  md += `\n## 3. الفروع الأفضل والأسوأ\n\n- **الأفضل**: ${best.name} - رصيد ${best.balance.toLocaleString('ar-DZ')} دج\n- **يحتاج تدخلاً**: ${worst.name} - رصيد ${worst.balance.toLocaleString('ar-DZ')} دج\n\n## 4. التوصيات\n\n1. تعزيز نجاح ${best.name}\n2. مراجعة مصاريف ${worst.name}\n3. اجتماع شهري لمسؤولي الفروع\n4. مراجعة المصاريف\n5. تقرير مقارنة شهري\n`;
  return md;
}
