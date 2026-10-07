import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET /api/receipt-print/[id]?type=student|teacher
 *
 * Returns a STANDALONE HTML page (Content-Type: text/html) that renders the
 * receipt with inline styles + auto-print script. This completely bypasses
 * the Next.js root layout (which applies bg-background/text-foreground and
 * dark-mode CSS variables that made the receipt invisible), so the printed
 * page is always rendered correctly regardless of the app theme.
 *
 * The finance dashboard buttons call window.open() on this URL.
 */

// Stable date formatter — Latin digits, DD/MM/YYYY format (avoids locale issues)
function formatDate(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // --- Auth ---
  const user = await getSession();
  if (!user) {
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>غير مصرح</h2></body></html>`,
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const { id } = await params;
  const type = new URL(_request.url).searchParams.get('type') === 'teacher' ? 'teacher' : 'student';

  if (type === 'teacher' && user.role !== 'director') {
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>وصولات الأساتذة متاحة للمدير فقط</h2></body></html>`,
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // --- Fetch data ---
  const schoolSetting = await db.setting.findUnique({ where: { key: 'school_name' } });
  const schoolName = schoolSetting?.value || 'مدرسة السلامة';

  let receipt: {
    receiptNumber: string;
    dateStr: string;
    name: string;
    studentNumber?: string;
    department?: string;
    level?: string;
    amount: number;
    label: string;
    month?: string;
    paymentMethod?: string;
    notes?: string;
    type: 'student' | 'teacher';
  };

  try {
    if (type === 'student') {
      const payment = await db.studentPayment.findUnique({
        where: { id },
        include: { student: { include: { department: true, level: true } } },
      });
      if (!payment) {
        return new Response(
          `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>الوصل غير موجود</h2></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      receipt = {
        receiptNumber: payment.receiptNumber,
        dateStr: formatDate(payment.paymentDate),
        name: payment.student.name,
        studentNumber: payment.student.studentNumber || undefined,
        department: payment.student.department?.name || undefined,
        level: payment.student.level?.name || undefined,
        amount: payment.amount,
        label: payment.paymentLabel,
        paymentMethod: payment.paymentMethod || undefined,
        notes: payment.notes || undefined,
        type: 'student',
      };
    } else {
      const payment = await db.teacherPayment.findUnique({
        where: { id },
        include: { teacher: { include: { department: true } } },
      });
      if (!payment) {
        return new Response(
          `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>الوصل غير موجود</h2></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      receipt = {
        receiptNumber: payment.receiptNumber,
        dateStr: formatDate(payment.paymentDate),
        name: payment.teacher.name,
        department: payment.teacher.department?.name || undefined,
        amount: payment.amount,
        month: payment.month,
        label: payment.paymentLabel,
        notes: payment.notes || undefined,
        type: 'teacher',
      };
    }
  } catch (err) {
    console.error('receipt-print error:', err);
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>تعذر تحميل الوصل</h2></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // --- Build standalone HTML ---
  const amountStr = new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(receipt.amount) + ' دج';
  const methodLabel = receipt.paymentMethod
    ? (receipt.paymentMethod === 'cash' ? 'نقداً' : receipt.paymentMethod === 'transfer' ? 'تحويل بنكي' : receipt.paymentMethod === 'check' ? 'شيك' : receipt.paymentMethod)
    : '';

  const titleText = receipt.type === 'student' ? 'وصل دفع - أقساط طالب' : 'وصل دفع - راتب أستاذ';
  const nameLabel = receipt.type === 'student' ? 'اسم الطالب' : 'اسم الأستاذ';

  const rows: string[] = [];
  rows.push(row('التاريخ', receipt.dateStr));
  rows.push(row(nameLabel, escapeHtml(receipt.name)));
  if (receipt.studentNumber) rows.push(row('رقم الطالب', `<span style="font-family:monospace">${escapeHtml(receipt.studentNumber)}</span>`));
  if (receipt.department) rows.push(row('القسم', escapeHtml(receipt.department)));
  if (receipt.level) rows.push(row('المستوى', escapeHtml(receipt.level)));
  if (receipt.month) rows.push(row('الشهر', escapeHtml(receipt.month)));
  rows.push(row('نوع الدفعة', escapeHtml(receipt.label) + (methodLabel ? ` <span style="font-size:13px;color:#666;margin-right:8px">(${methodLabel})</span>` : '')));

  const notesBlock = receipt.notes
    ? row('ملاحظات', `<span style="font-weight:400">${escapeHtml(receipt.notes)}</span>`)
    : '';

  const qrData = JSON.stringify({ n: receipt.receiptNumber, t: receipt.type === 'student' ? 'S' : 'T', a: receipt.amount, d: receipt.dateStr });

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>وصل ${escapeHtml(receipt.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'Cairo', 'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif;
    background: #f5f5f5;
    padding: 20px;
    color: #1a1a1a;
    direction: rtl;
  }
  .receipt {
    max-width: 800px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #e5e7eb;
  }
  .receipt-header {
    background: linear-gradient(135deg, #1e3a5f, #2c5282);
    color: #ffffff;
    padding: 24px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .receipt-header h1 { font-size: 22px; font-weight: 700; color: #ffffff; }
  .receipt-header .school { font-size: 18px; opacity: 0.9; color: #ffffff; }
  .receipt-header .receipt-num { font-size: 14px; opacity: 0.8; color: #ffffff; }
  .receipt-body { padding: 32px; background: #ffffff; }
  .receipt-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
  .receipt-row:last-child { border-bottom: none; }
  .receipt-label { width: 200px; color: #666666; font-size: 14px; }
  .receipt-value { flex: 1; font-weight: 600; font-size: 16px; color: #1a1a1a; }
  .amount-box {
    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
    border: 2px solid #16a34a;
    border-radius: 8px;
    padding: 20px;
    margin: 24px 0;
    text-align: center;
  }
  .amount-label { color: #16a34a; font-size: 14px; margin-bottom: 4px; }
  .amount-value { color: #15803d; font-size: 32px; font-weight: 800; }
  .receipt-footer {
    padding: 24px 32px;
    border-top: 2px dashed #e0e0e0;
    display: flex;
    justify-content: space-between;
    color: #666666;
    font-size: 13px;
    background: #fafafa;
  }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 24px; }
  .sig-box { text-align: center; color: #666666; }
  .sig-line { margin-top: 40px; border-top: 1px solid #999999; padding-top: 8px; width: 200px; }
  .print-btn {
    position: fixed; top: 20px; left: 20px;
    background: #1e3a5f; color: #ffffff; border: none;
    padding: 10px 20px; border-radius: 6px; cursor: pointer;
    font-family: inherit; font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000;
  }
  .print-btn:hover { background: #2c5282; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .receipt { box-shadow: none; max-width: 100%; border-radius: 0; border: none; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة الوصل</button>
  <div class="receipt">
    <div class="receipt-header">
      <div>
        <h1>${escapeHtml(receipt.schoolName || schoolName)}</h1>
        <div class="school">${titleText}</div>
      </div>
      <div style="text-align:left;display:flex;align-items:center;gap:12px">
        <div>
          <div class="receipt-num">رقم الوصل</div>
          <div style="font-size:18px;font-weight:700;color:#ffffff">${escapeHtml(receipt.receiptNumber)}</div>
        </div>
        <div style="background:#ffffff;padding:4px;border-radius:6px">
          <img src="/api/qr?data=${encodeURIComponent(qrData)}" alt="QR" style="width:60px;height:60px" />
        </div>
      </div>
    </div>
    <div class="receipt-body">
      ${rows.join('')}
      <div class="amount-box">
        <div class="amount-label">المبلغ المدفوع</div>
        <div class="amount-value">${amountStr}</div>
      </div>
      ${notesBlock}
      <div class="signature">
        <div class="sig-box"><div class="sig-line">توقيع المستلم</div></div>
        <div class="sig-box"><div class="sig-line">توقيع المدير / الختم</div></div>
      </div>
    </div>
    <div class="receipt-footer">
      <div>${escapeHtml(schoolName)} - جميع الحقوق محفوظة</div>
      <div>طُبع في: ${formatDate(new Date())}</div>
    </div>
  </div>
  <script>
    // Auto-print after page fully loads (including the QR image)
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 600);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function row(label: string, value: string): string {
  return `<div class="receipt-row"><div class="receipt-label">${label}</div><div class="receipt-value">${value}</div></div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
