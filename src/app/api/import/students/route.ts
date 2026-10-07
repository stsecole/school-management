import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * POST /api/import/students
 * استيراد الطلاب من ملف Excel
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
      'name': 'name', 'الاسم': 'name', 'الاسم واللقب': 'name', 'name': 'name', 'fullname': 'name',
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

    // جهّز الطلاب للإدراج
    const toInsert: any[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];
      const name = (r.name || '').toString().trim();
      if (!name) {
        errors.push({ row: i + 2, error: 'الاسم مطلوب' });
        continue;
      }

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

      toInsert.push({
        name,
        phone: (r.phone || '').toString().trim() || null,
        gender: (r.gender || '').toString().trim() || null,
        email: (r.email || '').toString().trim() || null,
        departmentId: deptId,
        levelId: levelId,
        specializationId: specId,
        studentNumber: (r.studentNumber || '').toString().trim() || null,
        birthDate,
        address: (r.address || '').toString().trim() || null,
        status: finalStatus,
        registrationDate: new Date(),
      });
    }

    // أدرج الطلاب
    for (let i = 0; i < toInsert.length; i++) {
      try {
        await db.student.create({ data: toInsert[i] });
        successCount++;
      } catch (e: any) {
        errors.push({ row: i + 2, name: toInsert[i].name, error: e.message });
        skipCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      success: successCount,
      skipped: skipCount,
      errors: errors.slice(0, 50), // أول 50 خطأ فقط
      errorsCount: errors.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/import/students error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
