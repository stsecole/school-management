import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs/promises';
import * as path from 'path';

// تحويل نص Markdown إلى HTML مع دعم RTL
function markdownToHtml(markdown: string, institutionName: string, year: number, analysisType: string): string {
  // تهريب HTML لتجنّب حقن الأكواد
  const escapeHtml = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // معالجة كتل الشيفرة ```...```
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre class="code-block"><code>${escapeHtml(code.trim())}</code></pre>`);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  // تقسيم النص إلى أسطر
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableHeader: string[] = [];

  const closeList = () => {
    if (inList) {
      htmlLines.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlLines.push('</tbody></table>');
      inTable = false;
      tableHeader = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // كتل الشيفرة المُستبدلة سابقاً
    const codeBlockMatch = trimmed.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (codeBlockMatch) {
      closeList();
      closeTable();
      htmlLines.push(codeBlocks[parseInt(codeBlockMatch[1])]);
      continue;
    }

    // العناوين # ## ###
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeTable();
      const level = headingMatch[1].length;
      const content = formatInline(escapeHtml(headingMatch[2]));
      htmlLines.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // اقتباس
    if (trimmed.startsWith('> ')) {
      closeList();
      closeTable();
      const content = formatInline(escapeHtml(trimmed.substring(2)));
      htmlLines.push(`<blockquote>${content}</blockquote>`);
      continue;
    }

    // عناصر القائمة غير المرتبة
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      closeTable();
      if (inList !== 'ul') {
        closeList();
        htmlLines.push('<ul>');
        inList = 'ul';
      }
      const content = formatInline(escapeHtml(ulMatch[1]));
      htmlLines.push(`<li>${content}</li>`);
      continue;
    }

    // عناصر القائمة المرتبة
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      closeTable();
      if (inList !== 'ol') {
        closeList();
        htmlLines.push('<ol>');
        inList = 'ol';
      }
      const content = formatInline(escapeHtml(olMatch[1]));
      htmlLines.push(`<li>${content}</li>`);
      continue;
    }

    // صفوف الجدول
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());

      // صف فاصل بين الرأس والجسم (|---|---|)
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        // نتجاهله لأنه مجرد فاصل
        continue;
      }

      if (!inTable) {
        // أول صف هو الرأس
        tableHeader = cells;
        inTable = true;
        htmlLines.push('<table>');
        htmlLines.push('<thead><tr>');
        for (const cell of tableHeader) {
          htmlLines.push(`<th>${formatInline(escapeHtml(cell))}</th>`);
        }
        htmlLines.push('</tr></thead><tbody>');
      } else {
        htmlLines.push('<tr>');
        for (const cell of cells) {
          htmlLines.push(`<td>${formatInline(escapeHtml(cell))}</td>`);
        }
        htmlLines.push('</tr>');
      }
      continue;
    }

    // فاصل أفقي
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      closeList();
      closeTable();
      htmlLines.push('<hr />');
      continue;
    }

    // سطر فارغ
    if (trimmed === '') {
      closeList();
      closeTable();
      continue;
    }

    // فقرة عادية
    closeList();
    closeTable();
    const content = formatInline(escapeHtml(trimmed));
    htmlLines.push(`<p>${content}</p>`);
  }

  closeList();
  closeTable();

  const body = htmlLines.join('\n');

  // قاموس نوع التحليل بالعربية
  const analysisTypeLabels: Record<string, string> = {
    full: 'تحليل شامل',
    financial: 'تحليل مالي',
    tasks: 'تحليل أداء المهام',
    attendance: 'تحليل الحضور',
  };
  const analysisLabel = analysisTypeLabels[analysisType] || 'تحليل';

  // بناء صفحة HTML كاملة مع تنسيق RTL ومظهر احترافي
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تقرير التحليل - ${escapeHtml(institutionName)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Tajawal', 'Cairo', 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif;
      direction: rtl;
      color: #1a1a1a;
      line-height: 1.7;
      font-size: 12pt;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1e3a8a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      color: #1e3a8a;
      font-size: 22pt;
      margin: 0 0 6px 0;
      font-weight: 800;
    }
    .header .subtitle {
      color: #6b7280;
      font-size: 11pt;
      margin: 0;
    }
    .header .badge {
      display: inline-block;
      background: #1e3a8a;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 10pt;
      margin-top: 8px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      background: #f3f4f6;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 10pt;
      color: #4b5563;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #1e3a8a;
      margin-top: 24px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    h1 { font-size: 18pt; }
    h2 {
      font-size: 15pt;
      border-right: 4px solid #1e3a8a;
      padding-right: 10px;
    }
    h3 { font-size: 13pt; }
    p { margin: 8px 0; text-align: justify; }
    ul, ol {
      padding-right: 22px;
      margin: 8px 0;
    }
    li { margin: 4px 0; }
    blockquote {
      border-right: 4px solid #f59e0b;
      background: #fffbeb;
      padding: 8px 14px;
      margin: 12px 0;
      color: #92400e;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px 10px;
      text-align: right;
    }
    thead th {
      background: #1e3a8a;
      color: white;
      font-weight: 700;
    }
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    .code-block {
      background: #1f2937;
      color: #f9fafb;
      padding: 12px;
      border-radius: 6px;
      direction: ltr;
      text-align: left;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      margin: 12px 0;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
    strong { font-weight: 700; color: #111827; }
    em { font-style: italic; }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(institutionName)}</h1>
    <p class="subtitle">تقرير تحليل أداء المؤسسة التعليمية</p>
    <div class="badge">${escapeHtml(analysisLabel)}</div>
  </div>
  <div class="meta">
    <span>السنة: <strong>${year}</strong></span>
    <span>تاريخ الإصدار: <strong>${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
  </div>
  ${body}
  <div class="footer">
    وثيقة مولّدة تلقائياً بواسطة نظام إدارة المؤسسة التعليمية - ${new Date().toLocaleString('ar-EG')}
  </div>
</body>
</html>`;
}

// تنسيق التنسيقات الداخلية: **عريض**, *مائل*, `شفرة`, [رابط](url)
function formatInline(text: string): string {
  return text
    // روابط [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // شيفرة داخل السطر `code`
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;font-family:monospace;direction:ltr;display:inline-block;">$1</code>')
    // عريض **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // مائل *text* أو _text_
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

// POST /api/reports/ai-pdf
// الجسم: { analysis: string, year: number, analysisType: string, institutionName: string }
// يُرجع: { filePath: string, fileName: string }
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    const analysis: string = body.analysis || '';
    const year: number = body.year ? parseInt(body.year) : new Date().getFullYear();
    const analysisType: string = body.analysisType || 'full';
    const institutionName: string = body.institutionName || 'مدرسة السلامة';

    if (!analysis || analysis.trim().length === 0) {
      return NextResponse.json(
        { error: 'نص التحليل فارغ' },
        { status: 400 }
      );
    }

    // تحويل الـ Markdown إلى HTML
    const html = markdownToHtml(analysis, institutionName, year, analysisType);

    // التأكد من وجود مجلد التحميل/التقارير
    const projectRoot = process.cwd();
    const reportsDir = path.join(projectRoot, 'download', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // توليد اسم ملف فريد
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `report-${year}-${analysisType}-${timestamp}.pdf`;
    const fullPath = path.join(reportsDir, fileName);

    // استخدام Playwright لتحويل HTML إلى PDF
    let playwright: any;
    try {
      playwright = await import('playwright');
    } catch (e: any) {
      console.error('Playwright not available:', e?.message || e);
      return NextResponse.json(
        { error: 'خدمة PDF غير متاحة (Playwright غير مثبّت)' },
        { status: 503 }
      );
    }

    // إطلاق متصفح Chromium
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 794, height: 1123 }, // A4 بالبكسل تقريباً
      });
      const page = await context.newPage();

      // تحميل الـ HTML مباشرة
      await page.setContent(html, { waitUntil: 'networkidle' });

      // توليد PDF بحجم A4
      await page.pdf({
        path: fullPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '18mm',
          bottom: '20mm',
          left: '16mm',
          right: '16mm',
        },
        preferCSSPageSize: true,
      });

      await context.close();
    } finally {
      await browser.close();
    }

    // التحقق من وجود الملف
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      throw new Error('فشل توليد ملف PDF');
    }

    // إرجاع المسار النسبي ليُستخدم لاحقاً في التحميل
    const relativePath = `reports/${fileName}`;

    return NextResponse.json({
      success: true,
      filePath: relativePath,
      fileName,
      size: stat.size,
      downloadUrl: `/api/download?file=${encodeURIComponent(relativePath)}`,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/reports/ai-pdf error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء توليد ملف PDF' },
      { status: 500 }
    );
  }
}
