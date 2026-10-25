import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';
import { DuplicateNameTracker } from '@/lib/name-match';
import * as XLSX from 'xlsx';

/**
 * POST /api/import/payments
 * استيراد دفعات الطلاب من Excel
 *
 * الميزات الجديدة:
 * - اكتشاف الأسماء المتقاربة عند مطابقة الطالب (لا حاجة لتطابق تام)
 * - منع تكرار نفس الدفعة (نفس الطالب + نفس المبلغ + نفس التاريخ)
 *
 * Columns:
 * - studentName * أو studentNumber * (تحديد الطالب)
 * - amount * (المبلغ)
 * - date (تاريخ الدفع)
 * - paymentType (registration/installment/full)
 * - paymentLabel (تسجيل/قسط أول/...)
 * - paymentMethod (cash/transfer/cheque)
 * - notes (ملاحظات)
 * - receiptNumber (رقم الوصل)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 });
    }

    // استخرج خيار "تخطي الدفعات المكررة"
    const url = new URL(request.url);
    const skipDuplicatePayments = url.searchParams.get('skipDuplicates') !== 'false'; // default true

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    if (rows.length > 2000) {
      return NextResponse.json({ error: 'الحد الأقصى 2000 دفعة في المرة' }, { status: 400 });
    }

    // قاموس الأعمدة
    const colMap: Record<string, string> = {
      'studentname': 'studentName', 'اسم الطالب': 'studentName', 'الطالب': 'studentName',
      'studentnumber': 'studentNumber', 'الرقم الجامعي': 'studentNumber', 'رقم التسجيل': 'studentNumber',
      'amount': 'amount', 'المبلغ': 'amount', 'المبلغ المدفوع': 'amount',
      'date': 'date', 'التاريخ': 'date', 'تاريخ الدفع': 'date',
      'paymenttype': 'paymentType', 'نوع الدفع': 'paymentType',
      'paymentlabel': 'paymentLabel', 'وصف الدفع': 'paymentLabel', 'الوصف': 'paymentLabel',
      'paymentmethod': 'paymentMethod', 'طريقة الدفع': 'paymentMethod',
      'notes': 'notes', 'ملاحظات': 'notes',
      'receiptnumber': 'receiptNumber', 'رقم الوصل': 'receiptNumber',
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

    // حمّل الطلاب (مفلترين بالفرع الحالي)
    const branchFilter = await getBranchFilter();
    const students = await db.student.findMany({
      where: branchFilter,
      select: { id: true, name: true, studentNumber: true },
    });

    // استخدم DuplicateNameTracker لمطابقة الأسماء المتقاربة
    const tracker = new DuplicateNameTracker(0.80); // 80% للتطابق التقريبي في الأسماء
    const numToId: Record<string, string> = {};
    for (const s of students) {
      tracker.add(s.name, s.id);
      if (s.studentNumber) numToId[s.studentNumber.toLowerCase().trim()] = s.id;
    }

    // حمّل الدفعات الموجودة لاكتشاف تكرار نفس الدفعة
    const existingPayments = await db.studentPayment.findMany({
      where: branchFilter,
      select: { id: true, studentId: true, amount: true, paymentDate: true, receiptNumber: true },
    });
    // مفتاح مركّب: studentId + amount + date (بالأيام)
    const existingPaymentKeys = new Set<string>();
    for (const p of existingPayments) {
      const dateKey = new Date(p.paymentDate).toISOString().split('T')[0];
      existingPaymentKeys.add(`${p.studentId}|${p.amount}|${dateKey}`);
    }
    // مفتاح رقم الوصل
    const existingReceiptNumbers = new Set(existingPayments.map(p => p.receiptNumber));

    // آخر receiptNumber
    let receiptCounter = 0;
    const lastPayment = existingPayments
      .map(p => p.receiptNumber)
      .filter(Boolean)
      .sort()
      .pop();
    if (lastPayment) {
      const match = lastPayment.match(/(\d+)$/);
      if (match) receiptCounter = parseInt(match[1]);
    }

    let successCount = 0;
    let skipCount = 0;
    let duplicatePaymentCount = 0;
    const branchIdForNew = await getBranchIdForNewRecord();
    const errors: any[] = [];
    const duplicates: any[] = [];

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];
      const studentName = (r.studentName || '').toString().trim();
      const studentNumber = (r.studentNumber || '').toString().trim();

      // ابحث عن الطالب — بـ studentNumber أولاً، ثم بالاسم المتقارب
      let studentId: string | null = null;
      let matchType = '';
      let matchedName = '';

      if (studentNumber) {
        studentId = numToId[studentNumber.toLowerCase()] || null;
        if (studentId) {
          matchType = 'exact-number';
          matchedName = studentNumber;
        }
      }
      if (!studentId && studentName) {
        // استخدم tracker لمطابقة الأسماء المتقاربة
        const match = tracker.findMatch(studentName);
        if (match) {
          studentId = match.id;
          matchType = match.similarity >= 0.99 ? 'exact-name' : 'similar-name';
          matchedName = match.matchedName;
        }
      }
      if (!studentId) {
        errors.push({
          row: i + 2,
          error: `الطالب غير موجود: ${studentName || studentNumber}`,
          suggestion: 'تأكد من كتابة الاسم بشكل صحيح أو أضف الطالب أولاً',
        });
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

      // تحقق من تكرار نفس الدفعة (نفس الطالب + نفس المبلغ + نفس التاريخ)
      const dateKey = paymentDate.toISOString().split('T')[0];
      const paymentKey = `${studentId}|${amount}|${dateKey}`;

      if (skipDuplicatePayments && existingPaymentKeys.has(paymentKey)) {
        duplicatePaymentCount++;
        duplicates.push({
          row: i + 2,
          studentName,
          matchedName,
          matchType,
          amount,
          date: dateKey,
          action: 'skipped-duplicate-payment',
        });
        skipCount++;
        continue;
      }

      receiptCounter++;
      let receiptNumber = r.receiptNumber
        ? r.receiptNumber.toString().trim()
        : `W-${new Date().getFullYear()}-${String(receiptCounter).padStart(4, '0')}`;

      // تحقق من تكرار رقم الوصل
      if (existingReceiptNumbers.has(receiptNumber)) {
        // ولّد رقم جديد تلقائياً
        receiptNumber = `W-${new Date().getFullYear()}-${String(receiptCounter).padStart(4, '0')}`;
      }

      try {
        await db.studentPayment.create({
          data: {
            receiptNumber,
            studentId,
            amount,
            paymentType: (r.paymentType || 'installment').toString().trim(),
            paymentLabel: (r.paymentLabel || '').toString().trim() || null,
            paymentDate,
            paymentMethod: (r.paymentMethod || 'cash').toString().trim(),
            notes: (r.notes || '').toString().trim() || null,
            branchId: branchIdForNew,
          },
        });
        successCount++;
        // أضِف للمجموعات لتجنب التكرار داخل نفس الملف
        existingPaymentKeys.add(paymentKey);
        existingReceiptNumbers.add(receiptNumber);
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
      duplicatePayments: duplicatePaymentCount,
      duplicates: duplicates.slice(0, 50),
      errors: errors.slice(0, 50),
      errorsCount: errors.length,
      message: `تم استيراد ${successCount} دفعة، تخطّي ${skipCount} (${duplicatePaymentCount} مكررة)`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/import/payments error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
