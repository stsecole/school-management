'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';

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
}

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      }
    >
      <ReceiptPageContent />
    </Suspense>
  );
}

function ReceiptPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const type = searchParams.get('type') || 'student';

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/finance/receipt/${id}?type=${type}`)
      .then(async r => {
        if (!r.ok) {
          const data = await r.json();
          throw new Error(data.error || 'تعذر التحميل');
        }
        return r.json();
      })
      .then(data => setReceipt(data.receipt))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, type]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">خطأ</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!receipt) return null;

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
        .receipt {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .receipt-header {
          background: linear-gradient(135deg, #1e3a5f, #2c5282);
          color: white;
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .receipt-header h1 { font-size: 22px; font-weight: 700; }
        .receipt-header .school { font-size: 18px; opacity: 0.9; }
        .receipt-header .receipt-num { font-size: 14px; opacity: 0.8; }
        .receipt-body { padding: 32px; }
        .receipt-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-label { width: 200px; color: #666; font-size: 14px; }
        .receipt-value { flex: 1; font-weight: 600; font-size: 16px; }
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
          color: #666;
          font-size: 13px;
        }
        .signature {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          padding-top: 24px;
        }
        .sig-box { text-align: center; color: #666; }
        .sig-line {
          margin-top: 40px;
          border-top: 1px solid #999;
          padding-top: 8px;
          width: 200px;
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
        }
        .print-btn:hover { background: #2c5282; }
        @media print {
          body { background: white !important; padding: 0 !important; }
          .receipt { box-shadow: none !important; max-width: 100% !important; }
          .print-btn { display: none !important; }
        }
      `}</style>
      <button className="print-btn" onClick={() => window.print()}>طباعة الوصل</button>
      <div className="receipt">
        <div className="receipt-header">
          <div>
            <h1>{receipt.department ? 'مدرسة السلامة' : 'مدرسة السلامة'}</h1>
            <div className="school">{receipt.type === 'student' ? 'وصل دفع - أقساط طالب' : 'وصل دفع - راتب أستاذ'}</div>
          </div>
          <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div className="receipt-num">رقم الوصل</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{receipt.receiptNumber}</div>
            </div>
            <div style={{ background: 'white', padding: '4px', borderRadius: '6px' }}>
              <img
                src={`/api/qr?data=${encodeURIComponent(JSON.stringify({ n: receipt.receiptNumber, t: receipt.type === 'student' ? 'S' : 'T', a: receipt.amount, d: receipt.date.split('T')[0] }))}`}
                alt="QR"
                style={{ width: '60px', height: '60px' }}
              />
            </div>
          </div>
        </div>

        <div className="receipt-body">
          <div className="receipt-row">
            <div className="receipt-label">التاريخ</div>
            <div className="receipt-value">{new Date(receipt.date).toLocaleDateString('ar-DZ')}</div>
          </div>
          <div className="receipt-row">
            <div className="receipt-label">{receipt.type === 'student' ? 'اسم الطالب' : 'اسم الأستاذ'}</div>
            <div className="receipt-value">{receipt.name}</div>
          </div>
          {receipt.studentNumber && (
            <div className="receipt-row">
              <div className="receipt-label">رقم الطالب</div>
              <div className="receipt-value" style={{ fontFamily: 'monospace' }}>{receipt.studentNumber}</div>
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
                <span style={{ marginRight: 8, fontSize: 13, color: '#666' }}>
                  ({receipt.paymentMethod === 'cash' ? 'نقدا' : receipt.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'شيك'})
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
          <div>مدرسة السلامة - جميع الحقوق محفوظة</div>
          <div>طُبع في: {new Date().toLocaleDateString('ar-DZ')}</div>
        </div>
      </div>
    </>
  );
}
