'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';

interface Receipt {
  receiptNumber: string;
  date: string;
  studentName: string;
  studentNumber: string | null;
  department: string | null;
  level: string | null;
  amount: number;
  paymentLabel: string | null;
  paymentMethod: string | null;
  notes: string | null;
  schoolName: string;
  type: string;
}

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

function BatchReceiptsContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    fetch(`/api/finance/student-payments?studentId=${studentId}`)
      .then(r => r.json())
      .then(async (data) => {
        const payments = data.payments || [];
        setStudentName(payments[0]?.student?.name || '');
        const receiptPromises = payments.map((p: any) =>
          fetch(`/api/finance/receipt/${p.id}?type=student`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
        const results = await Promise.all(receiptPromises);
        const validReceipts = results.filter(r => r?.receipt).map(r => r.receipt);
        setReceipts(validReceipts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentId]);

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري تحميل الوصولات...</p>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">لا توجد وصولات</h1>
          <p className="text-muted-foreground">لم يتم العثور على وصولات لهذا الطالب</p>
          <Button className="mt-4" onClick={() => window.close()}>
            <ArrowRight className="w-4 h-4 ml-2" /> إغلاق
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Tajawal', 'Cairo', 'Segoe UI', system-ui, sans-serif !important;
          background: #f5f5f5 !important;
          padding: 20px;
          color: #1a1a1a;
        }
        .batch-header {
          max-width: 800px;
          margin: 0 auto 30px;
          text-align: center;
          background: linear-gradient(135deg, #1e3a5f, #2c5282);
          color: white;
          padding: 20px;
          border-radius: 12px;
        }
        .batch-header h1 { font-size: 24px; font-weight: 700; }
        .batch-header p { font-size: 16px; opacity: 0.9; margin-top: 5px; }
        .batch-summary {
          max-width: 800px;
          margin: 0 auto 30px;
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .batch-summary table { width: 100%; border-collapse: collapse; }
        .batch-summary th, .batch-summary td {
          padding: 10px;
          text-align: right;
          border-bottom: 1px solid #eee;
        }
        .batch-summary th { background: #f8f8f8; font-weight: 600; }
        .batch-summary .total-row td {
          font-weight: 700;
          background: #f0fdf4;
          font-size: 18px;
        }
        .receipt-page {
          max-width: 800px;
          margin: 0 auto 30px;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          page-break-after: always;
        }
        .receipt-header {
          background: linear-gradient(135deg, #1e3a5f, #2c5282);
          color: white;
          padding: 20px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .receipt-header h2 { font-size: 20px; font-weight: 700; }
        .receipt-header .school { font-size: 16px; opacity: 0.9; }
        .receipt-header .receipt-num { font-size: 13px; opacity: 0.8; }
        .receipt-body { padding: 28px; }
        .receipt-row {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-label { width: 200px; color: #666; font-size: 14px; }
        .receipt-value { flex: 1; font-weight: 600; font-size: 15px; }
        .amount-box {
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 2px solid #16a34a;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          text-align: center;
        }
        .amount-label { color: #16a34a; font-size: 14px; margin-bottom: 4px; }
        .amount-value { color: #15803d; font-size: 28px; font-weight: 800; }
        .signature {
          margin-top: 30px;
          display: flex;
          justify-content: space-between;
        }
        .sig-box { text-align: center; color: #666; }
        .sig-line {
          margin-top: 30px;
          border-top: 1px solid #999;
          padding-top: 6px;
          width: 180px;
          font-size: 13px;
        }
        .print-btn {
          position: fixed;
          top: 20px;
          left: 20px;
          background: #1e3a5f;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .print-btn:hover { background: #2c5282; }
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print-btn, .batch-header, .batch-summary { display: none !important; }
          .receipt-page { box-shadow: none !important; margin: 0 0 20px !important; }
        }
      `}</style>
      <button className="print-btn" onClick={() => window.print()}>
        <Printer className="w-4 h-4" /> طباعة الكل
      </button>

      {/* Batch header */}
      <div className="batch-header">
        <h1>جميع وصولات الطالب: {studentName}</h1>
        <p>عدد الوصولات: {receipts.length} | إجمالي المدفوع: {currency(totalAmount)}</p>
      </div>

      {/* Summary table */}
      <div className="batch-summary">
        <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700 }}>ملخص الوصولات</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>رقم الوصل</th>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.receiptNumber}</td>
                <td style={{ fontSize: 13 }}>{new Date(r.date).toLocaleDateString('ar-DZ')}</td>
                <td>{r.paymentLabel}</td>
                <td style={{ fontWeight: 700, color: '#15803d' }}>{currency(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={4} style={{ textAlign: 'left' }}>الإجمالي:</td>
              <td style={{ color: '#15803d' }}>{currency(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Individual receipts */}
      {receipts.map((r, i) => (
        <div key={i} className="receipt-page">
          <div className="receipt-header">
            <div>
              <h2>{r.schoolName}</h2>
              <div className="school">وصل دفع - أقساط طالب (وصل رقم {i + 1} من {receipts.length})</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="receipt-num">رقم الوصل</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{r.receiptNumber}</div>
            </div>
          </div>
          <div className="receipt-body">
            <div className="receipt-row">
              <div className="receipt-label">التاريخ</div>
              <div className="receipt-value">{new Date(r.date).toLocaleDateString('ar-DZ')}</div>
            </div>
            <div className="receipt-row">
              <div className="receipt-label">اسم الطالب</div>
              <div className="receipt-value">{r.studentName}</div>
            </div>
            {r.studentNumber && (
              <div className="receipt-row">
                <div className="receipt-label">رقم الطالب</div>
                <div className="receipt-value" style={{ fontFamily: 'monospace' }}>{r.studentNumber}</div>
              </div>
            )}
            {r.department && (
              <div className="receipt-row">
                <div className="receipt-label">القسم</div>
                <div className="receipt-value">{r.department}</div>
              </div>
            )}
            {r.level && (
              <div className="receipt-row">
                <div className="receipt-label">المستوى</div>
                <div className="receipt-value">{r.level}</div>
              </div>
            )}
            <div className="receipt-row">
              <div className="receipt-label">نوع الدفعة</div>
              <div className="receipt-value">
                {r.paymentLabel}
                {r.paymentMethod && (
                  <span style={{ marginRight: 8, fontSize: 13, color: '#666' }}>
                    ({r.paymentMethod === 'cash' ? 'نقدا' : r.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'شيك'})
                  </span>
                )}
              </div>
            </div>
            <div className="amount-box">
              <div className="amount-label">المبلغ المدفوع</div>
              <div className="amount-value">{currency(r.amount)}</div>
            </div>
            {r.notes && (
              <div className="receipt-row">
                <div className="receipt-label">ملاحظات</div>
                <div className="receipt-value" style={{ fontWeight: 400 }}>{r.notes}</div>
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
        </div>
      ))}
    </>
  );
}

export default function BatchReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      }
    >
      <BatchReceiptsContent />
    </Suspense>
  );
}
