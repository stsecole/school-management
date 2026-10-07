'use client';

import { useEffect } from 'react';

interface Receipt {
  receiptNumber: string;
  date: string;
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
  schoolName: string;
}

const currency = (n: number) =>
  new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

function paymentMethodLabel(method?: string): string {
  if (!method) return '';
  switch (method) {
    case 'cash': return 'نقداً';
    case 'transfer': return 'تحويل بنكي';
    case 'check': return 'شيك';
    default: return method;
  }
}

/**
 * Client component that renders the receipt HTML (already populated with data
 * from the Server Component) and auto-triggers the print dialog after a short
 * delay so fonts/layout settle. A manual print button is also available.
 *
 * CRITICAL: All styles use `!important` because the root layout applies
 * `bg-background text-foreground` to <body>, and in dark mode `--foreground`
 * is light gray — without `!important` the receipt would render as
 * light text on a light background = invisible (the "empty PDF" bug).
 */
export function ReceiptPrintClient({ receipt }: { receipt: Receipt }) {
  // Auto-print after the page (including fonts) has fully loaded
  useEffect(() => {
    let cancelled = false;
    const trigger = () => {
      if (cancelled) return;
      // Small delay to ensure fonts and layout are settled
      setTimeout(() => {
        if (!cancelled) window.print();
      }, 600);
    };
    if (document.readyState === 'complete') {
      trigger();
    } else {
      window.addEventListener('load', trigger);
      return () => {
        cancelled = true;
        window.removeEventListener('load', trigger);
      };
    }
    return () => { cancelled = true; };
  }, []);

  // Also remove the .dark class from <html> so dark-mode CSS variables
  // don't interfere with our explicit colors.
  useEffect(() => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
    }
  }, []);

  const qrData = JSON.stringify({
    n: receipt.receiptNumber,
    t: receipt.type === 'student' ? 'S' : 'T',
    a: receipt.amount,
    d: receipt.date.split('T')[0],
  });

  return (
    <>
      <style>{`
        /* Override root layout's bg-background text-foreground on <body>.
           Without !important, Tailwind's utility classes (which have class-
           level specificity) beat element-level rules, and in dark mode the
           foreground color is light gray → invisible text on light bg. */
        html, body {
          background: #ffffff !important;
          color: #1a1a1a !important;
          padding: 20px !important;
          margin: 0 !important;
          direction: rtl !important;
          font-family: 'Tajawal', 'Cairo', 'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif !important;
        }
        * { box-sizing: border-box; }

        /* Explicit color on every text-bearing element so nothing inherits
           a wrong color from the app theme. */
        .receipt, .receipt * {
          color: #1a1a1a !important;
        }
        .receipt {
          max-width: 800px;
          margin: 0 auto !important;
          background: #ffffff !important;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
        }
        .receipt-header {
          background: linear-gradient(135deg, #1e3a5f, #2c5282) !important;
          color: #ffffff !important;
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .receipt-header h1 { font-size: 22px; font-weight: 700; color: #ffffff !important; }
        .receipt-header .school { font-size: 18px; opacity: 0.9; color: #ffffff !important; }
        .receipt-header .receipt-num { font-size: 14px; opacity: 0.8; color: #ffffff !important; }
        .receipt-body { padding: 32px; background: #ffffff !important; }
        .receipt-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-label { width: 200px; color: #666666 !important; font-size: 14px; }
        .receipt-value { flex: 1; font-weight: 600; font-size: 16px; color: #1a1a1a !important; }
        .amount-box {
          background: linear-gradient(135deg, #f0fdf4, #dcfce7) !important;
          border: 2px solid #16a34a !important;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
          text-align: center;
        }
        .amount-label { color: #16a34a !important; font-size: 14px; margin-bottom: 4px; }
        .amount-value { color: #15803d !important; font-size: 32px; font-weight: 800; }
        .receipt-footer {
          padding: 24px 32px;
          border-top: 2px dashed #e0e0e0;
          display: flex;
          justify-content: space-between;
          color: #666666 !important;
          font-size: 13px;
          background: #fafafa !important;
        }
        .signature {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          padding-top: 24px;
        }
        .sig-box { text-align: center; color: #666666 !important; }
        .sig-line {
          margin-top: 40px;
          border-top: 1px solid #999999 !important;
          padding-top: 8px;
          width: 200px;
        }
        .print-btn {
          position: fixed;
          top: 20px;
          left: 20px;
          background: #1e3a5f !important;
          color: #ffffff !important;
          border: none !important;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
        }
        .print-btn:hover { background: #2c5282 !important; }
        @media print {
          html, body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .receipt {
            box-shadow: none !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .print-btn { display: none !important; }
        }
      `}</style>
      <button className="print-btn" onClick={() => window.print()}>
        طباعة الوصل
      </button>
      <div className="receipt">
        <div className="receipt-header">
          <div>
            <h1>{receipt.schoolName}</h1>
            <div className="school">
              {receipt.type === 'student' ? 'وصل دفع - أقساط طالب' : 'وصل دفع - راتب أستاذ'}
            </div>
          </div>
          <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div className="receipt-num">رقم الوصل</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{receipt.receiptNumber}</div>
            </div>
            <div style={{ background: '#ffffff', padding: '4px', borderRadius: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr?data=${encodeURIComponent(qrData)}`}
                alt="QR"
                style={{ width: '60px', height: '60px' }}
              />
            </div>
          </div>
        </div>

        <div className="receipt-body">
          <div className="receipt-row">
            <div className="receipt-label">التاريخ</div>
            <div className="receipt-value">
              {new Date(receipt.date).toLocaleDateString('ar-DZ')}
            </div>
          </div>
          <div className="receipt-row">
            <div className="receipt-label">
              {receipt.type === 'student' ? 'اسم الطالب' : 'اسم الأستاذ'}
            </div>
            <div className="receipt-value">{receipt.name}</div>
          </div>
          {receipt.studentNumber && (
            <div className="receipt-row">
              <div className="receipt-label">رقم الطالب</div>
              <div className="receipt-value" style={{ fontFamily: 'monospace' }}>
                {receipt.studentNumber}
              </div>
            </div>
          )}
          {receipt.department && (
            <div className="receipt-row">
              <div className="receipt-label">القسم</div>
              <div className="receipt-value">{receipt.department}</div>
            </div>
          )}
          {receipt.level && (
            <div className="receipt-row">
              <div className="receipt-label">المستوى</div>
              <div className="receipt-value">{receipt.level}</div>
            </div>
          )}
          {receipt.month && (
            <div className="receipt-row">
              <div className="receipt-label">الشهر</div>
              <div className="receipt-value">{receipt.month}</div>
            </div>
          )}
          <div className="receipt-row">
            <div className="receipt-label">نوع الدفعة</div>
            <div className="receipt-value">
              {receipt.label}
              {receipt.paymentMethod && (
                <span style={{ marginRight: 8, fontSize: 13, color: '#666666' }}>
                  ({paymentMethodLabel(receipt.paymentMethod)})
                </span>
              )}
            </div>
          </div>

          <div className="amount-box">
            <div className="amount-label">المبلغ المدفوع</div>
            <div className="amount-value">{currency(receipt.amount)}</div>
          </div>

          {receipt.notes && (
            <div className="receipt-row">
              <div className="receipt-label">ملاحظات</div>
              <div className="receipt-value" style={{ fontWeight: 400 }}>{receipt.notes}</div>
            </div>
          )}

          <div className="signature">
            <div className="sig-box">
              <div className="sig-line">توقيع المستلم</div>
            </div>
            <div className="sig-box">
              <div className="sig-line">توقيع المدير / الختم</div>
            </div>
          </div>
        </div>

        <div className="receipt-footer">
          <div>{receipt.schoolName} - جميع الحقوق محفوظة</div>
          <div>طُبع في: {new Date().toLocaleDateString('ar-DZ')}</div>
        </div>
      </div>
    </>
  );
}
