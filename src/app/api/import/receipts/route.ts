import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * POST /api/import/receipts
 * استيراد الوصولات (الدفعات) من Excel
 *
 * Columns:
 * - studentName * أو studentNumber * (تحديد الطالب)
 * - amount * (المبلغ)
 * - date (تاريخ الدفع)
 * - paymentType (registration/installment/full)
 * - paymentLabel (تسجيل/قسط أول/...)
 * - paymentMethod (cash/transfer/cheque)
 * - notes (ملاحظات)
 * - receiptNumber (رقم الوصل - اختياري، يُولّد تلقائياً إن لم يُحدّد)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    if (rows.length > 2000) {
      return NextResponse.json({ error: 'الحد الأقصى 2000 وصل في المرة' }, { status: 400 });
    }

    const colMap: Record<string, string> = {
      'studentname': 'studentName', 'اسم الطالب': 'studentName', 'الطالب': 'studentName',
      'studentnumber': 'studentNumber', 'الرقم الجامعي': 'studentNumber', 'رقم التسجيل': 'studentNumber',
      'amount': 'amount', 'المبلغ': 'amount', 'المبلغ المدفوع': 'amount',
      'date': 'date', 'التاريخ': 'date', 'تاريخ الدفع': 'date', 'تاريخ الوصل': 'date',
      'paymenttype': 'paymentType', 'نوع الدفع': 'paymentType', 'نوع الوصل': 'paymentType',
      'paymentlabel': 'paymentLabel', 'وصف الدفع': 'paymentLabel', 'الوصف': 'paymentLabel', 'بيان الوصل': 'paymentLabel',
      'paymentmethod': 'paymentMethod', 'طريقة الدفع': 'paymentMethod',
      'notes': 'notes', 'ملاحظات': 'notes',
      'receiptnumber': 'receiptNumber', 'رقم الوصل': 'receiptNumber', 'رقم الإيصال': 'receiptNumber',
    };

    const normalizedRows = rows.map(row => {
      const obj: any = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toString().toLowerCase().trim();
        const mappedKey = colMap[normalizedKey] || colMap[key.toString().trim()];
        if (mappedKey) obj[mappedKey] = value;
      }
      return obj;
    });

    const students = await db.student.findMany({
      select: { id: true, name: true, studentNumber: true },
    });
    const nameToId: Record<string, string> = {};
    const numToId: Record<string, string> = {};
    for (const s of students) {
      if (s.name) nameToId[s.name.toLowerCase().trim()] = s.id;
      if (s.studentNumber) numToId[s.studentNumber.toLowerCase().trim()] = s.id;
    }

    const lastPayment = await db.studentPayment.findFirst({
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    let receiptCounter = 0;
    if (lastPayment?.receiptNumber) {
      const match = lastPayment.receiptNumber.match(/(\d+)$/);
      if (match) receiptCounter = parseInt(match[1]);
    }

    let successCount = 0;
    let skipCount = 0;
    const errors: any[] = [];
    const importedReceipts: any[] = [];

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];
      const studentName = (r.studentName || '').toString().trim();
      const studentNumber = (r.studentNumber || '').toString().trim();

      let studentId: string | null = null;
      if (studentNumber) studentId = numToId[studentNumber.toLowerCase()] || null;
      if (!studentId && studentName) studentId = nameToId[studentName.toLowerCase()] || null;
      if (!studentId) {
        errors.push({ row: i + 2, error: `الطالب غير موجود: ${studentName || studentNumber}` });
        skipCount++;
        continue;
      }

      const amount = parseFloat(r.amount);
      if (isNaN(amount) || amount <= 0) {
        errors.push({ row: i + 2, error: 'المبلغ غير صالح' });
        skipCount++;
        continue;
      }

      let paymentDate = new Date();
      if (r.date) {
        try {
          const d = new Date(r.date);
          if (!isNaN(d.getTime())) paymentDate = d;
        } catch {}
      }

      const paymentType = (r.paymentType || 'installment').toString().trim();
      const validTypes = ['registration', 'installment', 'full'];
      const finalType = validTypes.includes(paymentType) ? paymentType : 'installment';

      receiptCounter++;
      const receiptNumber = r.receiptNumber
        ? r.receiptNumber.toString().trim()
        : `W-${new Date().getFullYear()}-${String(receiptCounter).padStart(4, '0')}`;

      try {
        const payment = await db.studentPayment.create({
          data: {
            receiptNumber,
            studentId,
            amount,
            paymentType: finalType,
            paymentLabel: (r.paymentLabel || '').toString().trim() || null,
            paymentDate,
            paymentMethod: (r.paymentMethod || 'cash').toString().trim(),
            notes: (r.notes || '').toString().trim() || null,
          },
          include: { student: { select: { name: true, studentNumber: true } } },
        });
        successCount++;
        importedReceipts.push({
          receiptNumber: payment.receiptNumber,
          studentName: payment.student.name,
          amount: payment.amount,
          date: payment.paymentDate,
        });
      } catch (e: any) {
        errors.push({ row: i + 2, error: e.message });
        skipCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      success: successCount,
      skipped: skipCount,
      errors: errors.slice(0, 50),
      errorsCount: errors.length,
      importedReceipts: importedReceipts.slice(0, 100),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/import/receipts error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
