// ===== GET /api/invoices/monthly/[studentId]?month=YYYY-MM =====
// يُرجع صفحة HTML مستقلة تعرض فاتورة شهرية للطالب:
// - معلومات المؤسسة (شعار + اسم + عنوان)
// - معلومات الطالب (اسم، رقم، قسم، مستوى)
// - ملخص الحضور للشهر
// - الدفعات المُجراة في الشهر
// - حالة الأقساط (إن وجدت)
// - زر طباعة
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatDate(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

const ARABIC_MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

    const { studentId } = await params;
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month'); // YYYY-MM

    // Determine month range
    const now = new Date();
    let year = now.getFullYear();
    let monthIdx = now.getMonth(); // 0-indexed
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      year = y;
      monthIdx = m - 1;
    }
    const monthStart = new Date(year, monthIdx, 1);
    const monthEnd = new Date(year, monthIdx + 1, 1);
    const monthName = `${ARABIC_MONTHS[monthIdx]} ${year}`;

    // Fetch student
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
        level: true,
        specialization: true,
      },
    });
    if (!student) {
      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>الطالب غير موجود</h2></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Fetch institution settings (public — no auth issue since we're already authed)
    const settingKeys = [
      'institution_name', 'institution_tagline', 'institution_logo_url',
      'institution_address', 'institution_phone', 'institution_email', 'institution_footer',
    ];
    const settings = await db.setting.findMany({ where: { key: { in: settingKeys } } });
    const getSetting = (k: string, def = '') => settings.find(s => s.key === k)?.value || def;
    const instName = getSetting('institution_name', 'مؤسسة تعليمية');
    const instTagline = getSetting('institution_tagline', '');
    const instLogo = getSetting('institution_logo_url', '');
    const instAddress = getSetting('institution_address', '');
    const instPhone = getSetting('institution_phone', '');
    const instEmail = getSetting('institution_email', '');
    const instFooter = getSetting('institution_footer', '');

    // Fetch payments in this month
    const payments = await db.studentPayment.findMany({
      where: {
        studentId,
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Fetch attendance in this month (only individual scans with studentId)
    const attendances = await db.attendance.findMany({
      where: {
        studentId,
        date: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { date: 'asc' },
    });

    // Fetch installment plan (for total due / paid)
    const installments = await db.installmentPlan.findMany({
      where: { studentId },
      orderBy: { monthNumber: 'asc' },
    });

    // Compute totals
    const totalPaidThisMonth = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpected = installments.reduce((s, i) => s + i.expectedAmount, 0);
    const totalPaidAll = installments.reduce((s, i) => s + i.paidAmount, 0);
    const totalRemaining = Math.max(0, totalExpected - totalPaidAll);
    const pendingInstallments = installments.filter(i => i.status === 'pending' || i.status === 'late' || i.status === 'partial');
    const overdueInstallments = installments.filter(i => i.status === 'late');

    // For students with no installment plan, use student's totalAmount/initialPayment
    const studentTotalAmount = student.totalAmount || 0;
    const studentInitialPayment = student.initialPayment || 0;
    const hasInstallmentPlan = installments.length > 0;

    // Currency formatter (Latin digits)
    const fmtMoney = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + ' دج';

    // Build HTML
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة شهرية - ${escapeHtml(student.name)} - ${monthName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #1a1a1a; }
    .invoice { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-radius: 8px; }
    @media print {
      body { background: white; padding: 0; }
      .invoice { box-shadow: none; padding: 20px; max-width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; }
    }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 3px solid #1e3a5f; margin-bottom: 25px; }
    .institution { display: flex; align-items: center; gap: 15px; }
    .institution-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 8px; background: #f0f0f0; padding: 4px; }
    .institution-name { font-size: 22px; font-weight: bold; color: #1e3a5f; }
    .institution-tagline { font-size: 12px; color: #666; margin-top: 2px; }
    .institution-contact { font-size: 11px; color: #888; margin-top: 4px; }
    .invoice-meta { text-align: left; }
    .invoice-title { font-size: 18px; font-weight: bold; color: #1e3a5f; }
    .invoice-month { font-size: 14px; color: #666; margin-top: 4px; }
    .invoice-date { font-size: 11px; color: #999; margin-top: 8px; }
    .student-card { background: #f8fafc; padding: 18px; border-radius: 8px; border-right: 4px solid #1e3a5f; margin-bottom: 25px; }
    .student-name { font-size: 20px; font-weight: bold; color: #1e3a5f; margin-bottom: 10px; }
    .student-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 13px; }
    .student-info-item { display: flex; flex-direction: column; }
    .student-info-label { color: #888; font-size: 11px; margin-bottom: 2px; }
    .student-info-value { font-weight: 600; color: #333; }
    .section-title { font-size: 16px; font-weight: bold; color: #1e3a5f; margin: 25px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; display: inline-block; width: 4px; height: 18px; background: #1e3a5f; border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px; }
    th { background: #1e3a5f; color: white; padding: 10px; text-align: right; font-weight: 600; }
    th.num { text-align: center; }
    td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }
    td.num { text-align: center; font-variant-numeric: tabular-nums; }
    tr:nth-child(even) td { background: #fafbfc; }
    .empty-row td { text-align: center; color: #999; padding: 20px; font-style: italic; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .summary-card { padding: 14px; border-radius: 8px; text-align: center; }
    .summary-card-label { font-size: 11px; color: #666; margin-bottom: 4px; }
    .summary-card-value { font-size: 18px; font-weight: bold; font-variant-numeric: tabular-nums; }
    .summary-card.green { background: #ecfdf5; border: 1px solid #10b981; }
    .summary-card.green .summary-card-value { color: #047857; }
    .summary-card.blue { background: #eff6ff; border: 1px solid #3b82f6; }
    .summary-card.blue .summary-card-value { color: #1d4ed8; }
    .summary-card.amber { background: #fffbeb; border: 1px solid #f59e0b; }
    .summary-card.amber .summary-card-value { color: #b45309; }
    .summary-card.red { background: #fef2f2; border: 1px solid #ef4444; }
    .summary-card.red .summary-card-value { color: #b91c1c; }
    .total-row td { font-weight: bold; background: #f1f5f9 !important; border-top: 2px solid #1e3a5f; font-size: 14px; }
    .footer { margin-top: 35px; padding-top: 20px; border-top: 2px dashed #d1d5db; display: flex; justify-content: space-between; font-size: 12px; color: #666; }
    .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
    .signature-box { text-align: center; font-size: 12px; color: #666; }
    .signature-line { width: 200px; border-top: 1px solid #999; margin-top: 50px; padding-top: 4px; }
    .print-button { position: fixed; bottom: 20px; left: 20px; background: #1e3a5f; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; }
    .print-button:hover { background: #2c5282; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-partial { background: #dbeafe; color: #1e40af; }
    .status-late { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Header -->
    <div class="header">
      <div class="institution">
        ${instLogo ? `<img src="${escapeHtml(instLogo)}" class="institution-logo" alt="logo" onerror="this.style.display='none'">` : ''}
        <div>
          <div class="institution-name">${escapeHtml(instName)}</div>
          ${instTagline ? `<div class="institution-tagline">${escapeHtml(instTagline)}</div>` : ''}
          <div class="institution-contact">
            ${instAddress ? escapeHtml(instAddress) : ''}
            ${instAddress && instPhone ? ' • ' : ''}
            ${instPhone ? escapeHtml(instPhone) : ''}
          </div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">فاتورة شهرية</div>
        <div class="invoice-month">${monthName}</div>
        <div class="invoice-date">صدرت في: ${formatDate(new Date())}</div>
      </div>
    </div>

    <!-- Student info -->
    <div class="student-card">
      <div class="student-name">${escapeHtml(student.name)}</div>
      <div class="student-info">
        <div class="student-info-item">
          <span class="student-info-label">رقم الطالب</span>
          <span class="student-info-value num">${escapeHtml(student.studentNumber || '—')}</span>
        </div>
        <div class="student-info-item">
          <span class="student-info-label">القسم</span>
          <span class="student-info-value">${escapeHtml(student.department?.name || '—')}</span>
        </div>
        <div class="student-info-item">
          <span class="student-info-label">المستوى</span>
          <span class="student-info-value">${escapeHtml(student.level?.name || '—')}</span>
        </div>
        <div class="student-info-item">
          <span class="student-info-label">التخصص</span>
          <span class="student-info-value">${escapeHtml(student.specialization?.name || student.specialty || '—')}</span>
        </div>
        <div class="student-info-item">
          <span class="student-info-label">الهاتف</span>
          <span class="student-info-value num">${escapeHtml(student.phone || '—')}</span>
        </div>
        <div class="student-info-item">
          <span class="student-info-label">الحالة</span>
          <span class="student-info-value">
            ${student.status === 'registered' ? 'مسجّل' :
              student.status === 'continuing' ? 'مستمر' :
              student.status === 'graduated' ? 'متخرج' :
              student.status === 'abandoned' ? 'منقطع' :
              student.status === 'postponed' ? 'مؤجّل' : student.status}
          </span>
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="summary-cards">
      <div class="summary-card green">
        <div class="summary-card-label">مدفوع هذا الشهر</div>
        <div class="summary-card-value">${fmtMoney(totalPaidThisMonth)}</div>
      </div>
      <div class="summary-card blue">
        <div class="summary-card-label">عدد الدفعات</div>
        <div class="summary-card-value">${payments.length}</div>
      </div>
      <div class="summary-card amber">
        <div class="summary-card-label">أيام الحضور</div>
        <div class="summary-card-value">${attendances.length}</div>
      </div>
      <div class="summary-card red">
        <div class="summary-card-label">المتبقي${hasInstallmentPlan ? ' (الأقساط)' : ''}</div>
        <div class="summary-card-value">${fmtMoney(hasInstallmentPlan ? totalRemaining : Math.max(0, studentTotalAmount - studentInitialPayment))}</div>
      </div>
    </div>

    <!-- Payments table -->
    <div class="section-title">الدفعات المُجراة في ${monthName}</div>
    ${payments.length === 0 ? `
      <table><tr class="empty-row"><td>لا توجد دفعات في هذا الشهر</td></tr></table>
    ` : `
      <table>
        <thead>
          <tr>
            <th class="num" style="width: 40px">#</th>
            <th>التاريخ</th>
            <th>رقم الوصل</th>
            <th>البيان</th>
            <th class="num">المبلغ</th>
            <th class="num">طريقة الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map((p, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td class="num">${formatDate(p.paymentDate)}</td>
              <td class="num">${escapeHtml(p.receiptNumber)}</td>
              <td>${escapeHtml(p.paymentLabel || (p.paymentType === 'registration' ? 'تسجيل' : p.paymentType === 'full' ? 'دفع كامل' : 'قسط'))}</td>
              <td class="num">${fmtMoney(p.amount)}</td>
              <td class="num">${p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod === 'transfer' ? 'تحويل' : p.paymentMethod === 'cheque' ? 'شيك' : '—'}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="4" style="text-align: left;">الإجمالي المدفوع في ${escapeHtml(monthName)}:</td>
            <td class="num">${fmtMoney(totalPaidThisMonth)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `}

    <!-- Attendance table -->
    <div class="section-title">سجل الحضور في ${monthName}</div>
    ${attendances.length === 0 ? `
      <table><tr class="empty-row"><td>لا توجد سجلات حضور فردية في هذا الشهر (الحضور الجماعي لا يُسجَّل لكل طالب)</td></tr></table>
    ` : `
      <table>
        <thead>
          <tr>
            <th class="num" style="width: 40px">#</th>
            <th>التاريخ</th>
            <th>المادة</th>
            <th class="num">التوقيت</th>
            <th class="num">المدة</th>
          </tr>
        </thead>
        <tbody>
          ${attendances.map((a, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td class="num">${formatDate(a.date)}</td>
              <td>${escapeHtml(a.courseName || '—')}</td>
              <td class="num">${a.startTime && a.endTime ? escapeHtml(`${a.startTime} - ${a.endTime}`) : '—'}</td>
              <td class="num">${a.durationMinutes ? Math.floor(a.durationMinutes / 60) + 'س ' + (a.durationMinutes % 60) + 'د' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `}

    <!-- Installment plan -->
    ${hasInstallmentPlan ? `
      <div class="section-title">حالة خطة الأقساط</div>
      <table>
        <thead>
          <tr>
            <th class="num" style="width: 40px">#</th>
            <th>الشهر</th>
            <th class="num">المبلغ المطلوب</th>
            <th class="num">المدفوع</th>
            <th class="num">المتبقي</th>
            <th>تاريخ الاستحقاق</th>
            <th class="num">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${installments.slice(0, 12).map((inst, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>شهر ${inst.monthNumber}</td>
              <td class="num">${fmtMoney(inst.expectedAmount)}</td>
              <td class="num">${fmtMoney(inst.paidAmount)}</td>
              <td class="num">${fmtMoney(Math.max(0, inst.expectedAmount - inst.paidAmount))}</td>
              <td class="num">${formatDate(inst.expectedDate)}</td>
              <td class="num">
                <span class="status-badge status-${inst.status}">
                  ${inst.status === 'paid' ? 'مدفوع' : inst.status === 'pending' ? 'معلّق' : inst.status === 'partial' ? 'جزئي' : inst.status === 'late' ? 'متأخر' : inst.status}
                </span>
              </td>
            </tr>
          `).join('')}
          ${installments.length > 12 ? `<tr class="empty-row"><td colspan="7">... و ${installments.length - 12} شهر آخر</td></tr>` : ''}
          <tr class="total-row">
            <td colspan="2" style="text-align: left;">الإجمالي:</td>
            <td class="num">${fmtMoney(totalExpected)}</td>
            <td class="num">${fmtMoney(totalPaidAll)}</td>
            <td class="num">${fmtMoney(totalRemaining)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
      ${pendingInstallments.length > 0 ? `
        <p style="margin-top: 10px; font-size: 12px; color: #b45309;">
          ⚠ يوجد ${pendingInstallments.length} قسط غير مدفوع${overdueInstallments.length > 0 ? ` (${overdueInstallments.length} متأخر)` : ''}.
        </p>
      ` : ''}
    ` : ''}

    <!-- Signatures -->
    <div class="signature-area">
      <div class="signature-box">
        <div>توقيع ولي الأمر</div>
        <div class="signature-line"></div>
      </div>
      <div class="signature-box">
        <div>توقيع الإدارة</div>
        <div class="signature-line"></div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>${escapeHtml(instFooter || `© ${new Date().getFullYear()} ${instName}`)}</div>
      <div>طُبع في: ${formatDate(new Date())} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <button class="print-button no-print" onclick="window.print()">
    🖨 طباعة الفاتورة
  </button>

  <script>
    // Auto-print after a short delay (optional — comment out if not desired)
    // setTimeout(() => window.print(), 500);
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('GET /api/invoices/monthly/[studentId] error:', error);
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>خطأ</h2><p>${escapeHtml(error.message || 'حدث خطأ')}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
