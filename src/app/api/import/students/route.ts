import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchIdForNewRecord, getBranchFilter } from '@/lib/branch-filter';
import { DuplicateNameTracker } from '@/lib/name-match';
import * as XLSX from 'xlsx';

/**
 * POST /api/import/students
 * استيراد الطلاب من ملف Excel
 *
 * الميزات:
 * - اكتشاف التكرار التام (case-insensitive, trimmed)
 * - اكتشاف التطابق التقريبي (Levenshtein) للأسماء المتقاربة
 * - تطبيع الحروف العربية (إزالة التشكيل، توحيد الهمزات)
 * - خيار التحديث بدلاً من الإضافة عند التكرار
 *
 * Columns expected (any order, header names matched):
 * - name * (الاسم واللقب)
 * - phone (الهاتف)
 * - gender (الجنس: ذكر/أنثى)
 * - email (البريد)
 * - department (القسم)
 * - level (المستوى)
 * - specialization (التخصص)
 * - status (الحالة: registered/continuing/graduated)
 * - studentNumber (الرقم الجامعي)
 * - birthDate (تاريخ الميلاد)
 * - address (العنوان)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 });
    }

    // استخرج خيار "تجاوز المكررات" أو "تحديث الموجود" من query params
    const url = new URL(request.url);
    const skipDuplicates = url.searchParams.get('skipDuplicates') !== 'false'; // default true
    const updateExisting = url.searchParams.get('updateExisting') === 'true'; // default false

    // اقرأ ملف Excel
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    if (rows.length > 1000) {
      return NextResponse.json({ error: 'الحد الأقصى 1000 طالب في المرة الواحدة' }, { status: 400 });
    }

    // ابحث عن الأقسام والمستويات والتخصصات الموجودة
    const [departments, levels, specializations] = await Promise.all([
      db.department.findMany(),
      db.level.findMany(),
      db.specialization.findMany(),
    ]);

    const deptMap: Record<string, string> = {};
    for (const d of departments) {
      deptMap[d.name.toLowerCase()] = d.id;
      if (d.code) deptMap[d.code.toLowerCase()] = d.id;
    }
    const levelMap: Record<string, string> = {};
    for (const l of levels) levelMap[l.name.toLowerCase()] = l.id;
    const specMap: Record<string, string> = {};
    for (const s of specializations) specMap[s.name.toLowerCase()] = s.id;

    // قاموس الأعمدة (يدعم العربية والإنجليزية)
    const colMap: Record<string, string> = {
      'name': 'name', 'الاسم': 'name', 'الاسم واللقب': 'name', 'fullname': 'name',
      'phone': 'phone', 'الهاتف': 'phone', 'رقم الهاتف': 'phone', 'tel': 'phone', 'mobile': 'phone',
      'gender': 'gender', 'الجنس': 'gender', 'النوع': 'gender',
      'email': 'email', 'البريد': 'email', 'البريد الإلكتروني': 'email',
      'department': 'department', 'القسم': 'department', 'الشعبة': 'department',
      'level': 'level', 'المستوى': 'level',
      'specialization': 'specialization', 'التخصص': 'specialization',
      'status': 'status', 'الحالة': 'status',
      'studentnumber': 'studentNumber', 'الرقم الجامعي': 'studentNumber', 'رقم التسجيل': 'studentNumber',
      'birthdate': 'birthDate', 'تاريخ الميلاد': 'birthDate', 'الميلاد': 'birthDate',
      'address': 'address', 'العنوان': 'address',
    };

    // طبّق القاموس
    const normalizedRows = rows.map(row => {
      const obj: any = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toString().toLowerCase().trim();
        const mappedKey = colMap[normalizedKey] || colMap[key.toString().trim()];
        if (mappedKey) {
          obj[mappedKey] = value;
        }
      }
      return obj;
    });

    // ===== اكتشاف التكرارات =====
    const branchId = await getBranchIdForNewRecord();
    const branchFilter = await getBranchFilter();

    // حمّل كل الطلاب الموجودين لإنشاء tracker
    const existingStudents = await db.student.findMany({
      where: branchFilter,
      select: { id: true, name: true, studentNumber: true, phone: true },
    });
    const tracker = new DuplicateNameTracker(0.85);
    // خريطات سريعة للرقم الجامعي والهاتف
    const numToId: Record<string, string> = {};
    const phoneToId: Record<string, string> = {};
    for (const s of existingStudents) {
      tracker.add(s.name, s.id);
      if (s.studentNumber) numToId[s.studentNumber.toLowerCase().trim()] = s.id;
      if (s.phone) phoneToId[s.phone.trim()] = s.id;
    }

    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];
    const errors: any[] = [];
    const duplicates: any[] = []; // سجل المكررات للإبلاغ
    let successCount = 0;
    let skipCount = 0;
    let updateCount = 0;

    // تابع للأسماء الجديدة المضافة في نفس الدفعة (لاكتشاف التكرار داخل الملف نفسه)
    const inBatchTracker = new DuplicateNameTracker(0.85);

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];
      const name = (r.name || '').toString().trim();
      if (!name) {
        errors.push({ row: i + 2, error: 'الاسم مطلوب' });
        continue;
      }

      // تحقق من التكرار داخل الملف نفسه (مثلاً: اسم مكرر في صفين)
      const inBatchMatch = inBatchTracker.findMatch(name);
      if (inBatchMatch) {
        duplicates.push({
          row: i + 2,
          name,
          type: 'in-file',
          matchedWith: inBatchMatch.matchedName,
          similarity: inBatchMatch.similarity,
          action: 'skipped',
        });
        skipCount++;
        continue;
      }

      // تحقق من التكرار مع قاعدة البيانات
      const dbMatch = tracker.findMatch(name);
      // تحقق أيضاً بالرقم الجامعي والهاتف
      const studentNumber = (r.studentNumber || '').toString().trim();
      const phone = (r.phone || '').toString().trim();
      const numMatch = studentNumber ? numToId[studentNumber.toLowerCase()] : null;
      const phoneMatch = phone ? phoneToId[phone] : null;

      const existingId = dbMatch?.id || numMatch || phoneMatch;

      if (existingId) {
        // مكرر — سجّله
        duplicates.push({
          row: i + 2,
          name,
          type: dbMatch ? 'similar-name' : numMatch ? 'same-number' : 'same-phone',
          matchedWith: dbMatch?.matchedName || studentNumber || phone,
          similarity: dbMatch?.similarity,
          action: updateExisting ? 'updated' : 'skipped',
        });

        if (updateExisting) {
          // حدّث الطالب الموجود بالبيانات الجديدة
          const deptName = (r.department || '').toString().trim();
          const deptId = deptName ? deptMap[deptName.toLowerCase()] : undefined;
          const levelName = (r.level || '').toString().trim();
          const levelId = levelName ? levelMap[levelName.toLowerCase()] : undefined;
          const specName = (r.specialization || '').toString().trim();
          const specId = specName ? specMap[specName.toLowerCase()] : undefined;

          let birthDate: Date | null = null;
          if (r.birthDate) {
            try {
              birthDate = new Date(r.birthDate);
              if (isNaN(birthDate.getTime())) birthDate = null;
            } catch {}
          }

          const status = (r.status || 'registered').toString().trim();
          const validStatuses = ['registered', 'continuing', 'abandoned', 'postponed', 'graduated'];
          const finalStatus = validStatuses.includes(status) ? status : 'registered';

          toUpdate.push({
            id: existingId,
            data: {
              phone: phone || undefined,
              gender: (r.gender || '').toString().trim() || undefined,
              email: (r.email || '').toString().trim() || undefined,
              departmentId: deptId,
              levelId,
              specializationId: specId,
              studentNumber: studentNumber || undefined,
              birthDate: birthDate || undefined,
              address: (r.address || '').toString().trim() || undefined,
              status: finalStatus,
            },
          });
          updateCount++;
        } else {
          skipCount++;
        }

        // أضِف لقائمة المتابعة الداخلية (لتجنب تكرار داخل الملف)
        inBatchTracker.add(name, existingId);
        continue;
      }

      // ليس مكرر — جهّزه للإدراج
      const deptName = (r.department || '').toString().trim();
      const deptId = deptName ? deptMap[deptName.toLowerCase()] : null;

      const levelName = (r.level || '').toString().trim();
      const levelId = levelName ? levelMap[levelName.toLowerCase()] : null;

      const specName = (r.specialization || '').toString().trim();
      const specId = specName ? specMap[specName.toLowerCase()] : null;

      let birthDate: Date | null = null;
      if (r.birthDate) {
        try {
          birthDate = new Date(r.birthDate);
          if (isNaN(birthDate.getTime())) birthDate = null;
        } catch {}
      }

      const status = (r.status || 'registered').toString().trim();
      const validStatuses = ['registered', 'continuing', 'abandoned', 'postponed', 'graduated'];
      const finalStatus = validStatuses.includes(status) ? status : 'registered';

      const newStudent = {
        name,
        phone: phone || null,
        gender: (r.gender || '').toString().trim() || null,
        email: (r.email || '').toString().trim() || null,
        departmentId: deptId,
        levelId,
        specializationId: specId,
        studentNumber: studentNumber || null,
        birthDate,
        address: (r.address || '').toString().trim() || null,
        status: finalStatus,
        registrationDate: new Date(),
        branchId,
      };
      toInsert.push(newStudent);
      // أضِف لقائمة المتابعة الداخلية
      // (mعرف fake مؤقتاً — سيُحدّث بالـ id الحقيقي بعد الإدراج)
      inBatchTracker.add(name, `pending-${i}`);
    }

    // أدرج الطلاب الجدد
    for (let i = 0; i < toInsert.length; i++) {
      try {
        const created = await db.student.create({ data: toInsert[i] });
        successCount++;
        // حدّث tracker بالـ id الحقيقي (في حال تكرار لاحق)
        tracker.add(toInsert[i].name, created.id);
      } catch (e: any) {
        errors.push({ row: i + 2, name: toInsert[i].name, error: e.message });
        skipCount++;
      }
    }

    // حدّث الطلاب الموجودين (إذا تفعّل updateExisting)
    for (const upd of toUpdate) {
      try {
        // أزِل undefined values
        const cleanData: any = {};
        for (const [k, v] of Object.entries(upd.data)) {
          if (v !== undefined) cleanData[k] = v;
        }
        await db.student.update({ where: { id: upd.id }, data: cleanData });
      } catch (e: any) {
        errors.push({ id: upd.id, error: e.message });
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      success: successCount,
      updated: updateCount,
      skipped: skipCount,
      duplicatesCount: duplicates.length,
      duplicates: duplicates.slice(0, 50), // أول 50 مكرر للعرض
      errors: errors.slice(0, 50),
      errorsCount: errors.length,
      message: duplicates.length > 0
        ? `تم استيراد ${successCount} طالب جديد، تجاوز ${skipCount} مكرر، ${updateCount} محدّث`
        : `تم استيراد ${successCount} طالب بنجاح`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/import/students error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
