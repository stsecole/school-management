// ===== POST /api/ai/upload =====
// Multipart: parse Excel/PDF, send content to LLM

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chat } from '@/lib/ai/provider';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'multipart/form-data مطلوب' }, { status: 400 });
  }
  const file = formData.get('file') as File | null;
  const question = (formData.get('question') as string) || 'لخّص محتوى هذا الملف.';
  if (!file) {
    return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();
  let extracted = '';

  try {
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheets = wb.SheetNames.slice(0, 5); // أول 5 أوراق
      for (const name of sheets) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
        extracted += `### ورقة: ${name}\n${csv}\n\n`;
      }
    } else if (lowerName.endsWith('.pdf')) {
      // استخراج نص بدائي من PDF (يصلح للنصوص غير المضغوطة)
      extracted = buf
        .toString('latin1')
        .replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .slice(0, 8000);
    } else if (
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json')
    ) {
      extracted = buf.toString('utf-8').slice(0, 16000);
    } else {
      return NextResponse.json(
        { error: 'صيغة الملف غير مدعومة. استخدم xlsx, csv, pdf, txt' },
        { status: 400 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `فشل تحليل الملف: ${err?.message}` },
      { status: 500 }
    );
  }

  if (!extracted.trim()) {
    return NextResponse.json({ error: 'لا يوجد محتوى قابل للاستخراج' }, { status: 400 });
  }

  // قص المحتوى لتجنب تجاوز حد الرموز
  const truncated = extracted.slice(0, 12000);

  const { response } = await chat({
    messages: [
      {
        role: 'system',
        content: `أنت مساعد ذكي. تم رفع ملف من قبل المستخدم "${user.name}". حلّل المحتوى وأجب عن سؤاله بالعربية. استخدم Markdown.`,
      },
      {
        role: 'user',
        content: `سؤالي: ${question}\n\n=== محتوى الملف: ${file.name} ===\n${truncated}`,
      },
    ],
    temperature: 0.5,
    maxTokens: 2000,
  });

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    fileSize: buf.length,
    extractedLength: extracted.length,
    answer: response.content,
    tokensUsed: response.tokensUsed,
  });
}
