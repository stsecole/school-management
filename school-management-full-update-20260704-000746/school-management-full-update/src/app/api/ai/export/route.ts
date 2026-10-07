// ===== POST /api/ai/export =====
// { format, content, title, table } → PDF (HTML) or Excel (xlsx)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { format, content, title, table } = body as {
    format: 'pdf' | 'excel';
    content?: string;
    title?: string;
    table?: { columns: string[]; rows: any[][] };
  };

  const safeTitle = title || 'تقرير المساعد الذكي';
  const date = new Date().toLocaleString('ar-DZ');

  if (format === 'excel') {
    try {
      const XLSX = await import('xlsx');
      let data: any[][] = [];
      if (table?.columns) {
        data.push(table.columns);
        data.push(...(table.rows || []));
      } else if (content) {
        data = content.split('\n').map((l) => [l]);
      } else {
        data = [['لا توجد بيانات']];
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = (data[0] || []).map(() => ({ wch: 25 }));
      // RTL
      if (!ws['!views']) ws['!views'] = [{}];
      (ws['!views'][0] as any).RTL = true;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new Response(buf, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(
            safeTitle
          )}.xlsx"`,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `فشل إنشاء Excel: ${err?.message}` },
        { status: 500 }
      );
    }
  }

  // PDF: نُرجع HTML قابل للطباعة (المتصفح يحوّله إلى PDF عبر window.print)
  if (format === 'pdf') {
    const rowsHtml = table?.rows
      ? table.rows
          .map(
            (r) =>
              `<tr>${r
                .map(
                  (c) =>
                    `<td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${String(
                      c ?? ''
                    )}</td>`
                )
                .join('')}</tr>`
          )
          .join('')
      : '';
    const tableHtml = table?.columns
      ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;"><thead><tr>${table.columns
          .map(
            (c) =>
              `<th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:right;font-weight:600;">${c}</th>`
          )
          .join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`
      : '';
    const contentHtml = content
      ? `<div style="white-space:pre-wrap;margin-top:16px;line-height:1.7;">${content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</div>`
      : '';
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  body { font-family: 'Tajawal', system-ui, sans-serif; padding: 32px; color: #1f2937; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">طُبع بواسطة: ${user.name} — ${date}</div>
  ${tableHtml}
  ${contentHtml}
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 300); };
  </script>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'صيغة غير مدعومة' }, { status: 400 });
}
