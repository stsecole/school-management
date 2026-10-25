import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchIdForNewRecord, getBranchFilter } from '@/lib/branch-filter';
import { DuplicateNameTracker } from '@/lib/name-match';
import * as xlsx from 'xlsx';

// POST /api/students/bulk-import (JSON body with base64 file)
// PUT  /api/students/bulk-import (FormData — parse only, returns preview)
// PATCH /api/students/bulk-import (FormData — import with column mapping)

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    if (!body.file) {
      return NextResponse.json({ error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }

    const buffer = Buffer.from(body.file, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = body.sheetName || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: 'الورقة غير موجودة' }, { status: 400 });
    }

    const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1, raw: false, defval: '' });
    if (rows.length < 2) {
      return NextResponse.json({ error: 'الملف فارغ أو يحتوي على عناوين فقط' }, { status: 400 });
    }

    const excelHeaders = rows[0].map((h: any) => String(h || '').trim());
    const dataRows = rows.slice(1);
    const mapping = body.columnMapping || {};

    const results = await processImport(dataRows, mapping);
    return NextResponse.json({ results, excelHeaders });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستيراد: ' + (error.message || '') }, { status: 500 });
  }
}

// PUT — parse only (returns preview + headers)
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'لم يتم إرسال أي ملف' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1, raw: false, defval: '' });

    if (rows.length < 1) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    const headers = rows[0].map((h: any) => String(h || '').trim());
    const preview = rows.slice(1, 6).map((r: any) => r.map((c: any) => String(c || '')));

    return NextResponse.json({ headers, preview, totalRows: rows.length - 1 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('Parse error:', error);
    return NextResponse.json({ error: 'تعذر قراءة الملف' }, { status: 500 });
  }
}

// PATCH — import with column mapping (used by bulk-import-modal)
export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mappingJson = formData.get('columnMapping') as string;

    if (!file || !mappingJson) {
      return NextResponse.json({ error: 'الملف وخريطة الأعمدة مطلوبان' }, { status: 400 });
    }

    const columnMapping = JSON.parse(mappingJson);
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1, raw: false, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    const dataRows = rows.slice(1);
    const results = await processImport(dataRows, columnMapping);
    return NextResponse.json({ results });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PATCH import error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

// ===== منطق الاستيراد المشترك =====
async function processImport(
  dataRows: any[][],
  mapping: Record<string, string>
): Promise<{
  total: number;
  success: number;
  failed: number;
  duplicatesCount: number;
  errors: any[];
  duplicates: any[];
}> {
  const [departments, levels, specializations] = await Promise.all([
    db.department.findMany(),
    db.level.findMany(),
    db.specialization.findMany(),
  ]);

  const branchId = await getBranchIdForNewRecord();
  const branchFilter = await getBranchFilter();

  // حمّل الطلاب الموجودين لاكتشاف التكرار
  const existingStudents = await db.student.findMany({
    where: branchFilter,
    select: { id: true, name: true, studentNumber: true, phone: true },
  });
  const tracker = new DuplicateNameTracker(0.92); // 92% threshold
  const numToId: Record<string, string> = {};
  const phoneToId: Record<string, string> = {};
  for (const s of existingStudents) {
    tracker.add(s.name, s.id);
    if (s.studentNumber) numToId[s.studentNumber.toLowerCase().trim()] = s.id;
    if (s.phone) phoneToId[s.phone.trim()] = s.id;
  }

  // تابع للأسماء الجديدة داخل نفس الملف (threshold أعلى لتجنب false positives)
  const inBatchTracker = new DuplicateNameTracker(0.98);

  const results = {
    total: dataRows.length,
    success: 0,
    failed: 0,
    skipped: 0, // duplicates
    duplicatesCount: 0,
    errors: [] as any[],
    duplicates: [] as any[],
  };

  let studentCounter = await db.student.count();

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    try {
      const studentData: any = {
        status: 'registered',
        registrationDate: new Date(),
        branchId, // ← ربط الطالب بالفرع الحالي!
      };

      for (const [excelColIdx, dbField] of Object.entries(mapping)) {
        const colIdx = parseInt(excelColIdx);
        const value = row[colIdx];
        if (value === null || value === undefined || String(value).trim() === '') continue;
        const strValue = String(value).trim();

        switch (dbField) {
          case 'name': studentData.name = strValue; break;
          case 'studentNumber': studentData.studentNumber = strValue; break;
          case 'email': studentData.email = strValue; break;
          case 'phone': studentData.phone = strValue; break;
          case 'gender':
            studentData.gender = strValue.includes('ذ') ? 'ذكر' : strValue.includes('أن') ? 'أنثى' : strValue;
            break;
          case 'birthDate':
            try { studentData.birthDate = new Date(strValue); } catch {}
            break;
          case 'address': studentData.address = strValue; break;
          case 'section': studentData.section = strValue; break;
          case 'specialty': studentData.specialty = strValue; break;
          case 'college': studentData.college = strValue; break;
          case 'status':
            const sm: Record<string, string> = {
              'مسجل': 'registered', 'مستمر': 'continuing', 'متخلي': 'abandoned',
              'مؤجل': 'postponed', 'متخرج': 'graduated',
            };
            studentData.status = sm[strValue] || strValue;
            break;
          case 'notes': studentData.notes = strValue; break;
          case 'departmentId':
            const d = departments.find(x => x.name === strValue || x.name.includes(strValue) || strValue.includes(x.name));
            if (d) studentData.departmentId = d.id;
            break;
          case 'levelId':
            const l = levels.find(x => x.name === strValue || x.name.includes(strValue) || strValue.includes(x.name));
            if (l) studentData.levelId = l.id;
            break;
          case 'specializationId':
            const s = specializations.find(x => x.name === strValue || x.name.includes(strValue) || strValue.includes(x.name));
            if (s) studentData.specializationId = s.id;
            break;
          case 'courseStartDate':
            try { studentData.courseStartDate = new Date(strValue); } catch {}
            break;
          case 'totalAmount': studentData.totalAmount = parseFloat(strValue) || null; break;
          case 'initialPayment': studentData.initialPayment = parseFloat(strValue) || 0; break;
        }
      }

      // Validate required field
      if (!studentData.name) {
        results.errors.push({ row: rowIdx + 2, error: 'اسم الطالب مطلوب' });
        results.failed++;
        continue;
      }

      // ===== اكتشاف التكرار =====
      // 1) تكرار داخل نفس الملف
      const inBatchMatch = inBatchTracker.findMatch(studentData.name);
      if (inBatchMatch) {
        results.duplicatesCount++;
        results.skipped++;
        results.duplicates.push({
          row: rowIdx + 2,
          name: studentData.name,
          type: 'in-file',
          matchedWith: inBatchMatch.matchedName,
          similarity: inBatchMatch.similarity,
        });
        // أضِف لـ tracker الداخلي
        inBatchTracker.add(studentData.name, 'in-batch-dup');
        continue;
      }

      // 2) تكرار مع قاعدة البيانات (اسم متقارب)
      const dbMatch = tracker.findMatch(studentData.name);
      // 3) تكرار بالرقم الجامعي
      const numMatch = studentData.studentNumber
        ? numToId[studentData.studentNumber.toLowerCase()]
        : null;
      // 4) تكرار بالهاتف
      const phoneMatch = studentData.phone
        ? phoneToId[studentData.phone.trim()]
        : null;

      if (dbMatch || numMatch || phoneMatch) {
        const matchType = numMatch ? 'same-number' : phoneMatch ? 'same-phone' : 'similar-name';
        results.duplicatesCount++;
        results.skipped++;
        results.duplicates.push({
          row: rowIdx + 2,
          name: studentData.name,
          type: matchType,
          matchedWith: dbMatch?.matchedName || studentData.studentNumber || studentData.phone,
          similarity: dbMatch?.similarity,
        });
        // أضِف لـ tracker الداخلي
        inBatchTracker.add(studentData.name, dbMatch?.id || numMatch || phoneMatch || 'db-dup');
        continue;
      }

      // Auto-generate student number if not provided
      if (!studentData.studentNumber) {
        studentCounter++;
        studentData.studentNumber = `STU-${new Date().getFullYear()}-${String(studentCounter).padStart(3, '0')}`;
      }

      // Create student
      const created = await db.student.create({ data: studentData });
      results.success++;
      // أضِف لـ tracker
      tracker.add(studentData.name, created.id);
      inBatchTracker.add(studentData.name, created.id);
      if (studentData.studentNumber) numToId[studentData.studentNumber.toLowerCase()] = created.id;
      if (studentData.phone) phoneToId[studentData.phone.trim()] = created.id;
    } catch (e: any) {
      results.errors.push({ row: rowIdx + 2, error: e.message || 'خطأ غير متوقع' });
      results.failed++;
    }
  }

  return results;
}
