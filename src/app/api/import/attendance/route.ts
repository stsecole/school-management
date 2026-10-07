import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * POST /api/import/attendance
 * استيراد سجلات الحضور من Excel
 *
 * Columns:
 * - date * (التاريخ)
 * - courseName * (اسم المادة/الدورة)
 * - teacherName (الأستاذ)
 * - studentName (الطالب - اختياري)
 * - level (المستوى)
 * - startTime (08:00)
 * - endTime (10:00)
 * - totalCount (عدد الحضور)
 * - maleCount (ذكور)
 * - femaleCount (إناث)
 * - notes (ملاحظات)
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
      return NextResponse.json({ error: 'الحد الأقصى 2000 سجل في المرة' }, { status: 400 });
    }

    const colMap: Record<string, string> = {
      'date': 'date', 'التاريخ': 'date',
      'coursename': 'courseName', 'المادة': 'courseName', 'الدورة': 'courseName', 'اسم المادة': 'courseName',
      'teachername': 'teacherName', 'الأستاذ': 'teacherName', 'اسم الأستاذ': 'teacherName',
      'studentname': 'studentName', 'الطالب': 'studentName', 'اسم الطالب': 'studentName',
      'level': 'level', 'المستوى': 'level',
      'starttime': 'startTime', 'وقت البداية': 'startTime', 'البداية': 'startTime',
      'endtime': 'endTime', 'وقت النهاية': 'endTime', 'النهاية': 'endTime',
      'totalcount': 'totalCount', 'عدد الحضور': 'totalCount', 'العدد': 'totalCount',
      'malecount': 'maleCount', 'ذكور': 'maleCount',
      'femalecount': 'femaleCount', 'إناث': 'femaleCount',
      'notes': 'notes', 'ملاحظات': 'notes',
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

    // حمّل الأساتذة والطلاب
    const [teachers, students] = await Promise.all([
      db.teacher.findMany({ select: { id: true, name: true } }),
      db.student.findMany({ select: { id: true, name: true } }),
    ]);
    const teacherMap: Record<string, string> = {};
    for (const t of teachers) teacherMap[t.name.toLowerCase().trim()] = t.id;
    const studentMap: Record<string, string> = {};
    for (const s of students) studentMap[s.name.toLowerCase().trim()] = s.id;

    let successCount = 0;
    let skipCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];

      // التاريخ
      let date: Date | null = null;
      if (r.date) {
        try {
          date = new Date(r.date);
          if (isNaN(date.getTime())) date = null;
        } catch {}
      }
      if (!date) {
        errors.push({ row: i + 2, error: 'التاريخ مطلوب' });
        skipCount++;
        continue;
      }

      const courseName = (r.courseName || '').toString().trim();
      if (!courseName) {
        errors.push({ row: i + 2, error: 'اسم المادة مطلوب' });
        skipCount++;
        continue;
      }

      const teacherName = (r.teacherName || '').toString().trim();
      const teacherId = teacherName ? teacherMap[teacherName.toLowerCase()] : null;

      const studentName = (r.studentName || '').toString().trim();
      const studentId = studentName ? studentMap[studentName.toLowerCase()] : null;

      const startTime = (r.startTime || '').toString().trim();
      const endTime = (r.endTime || '').toString().trim();

      const totalCount = parseInt(r.totalCount) || 0;
      const maleCount = parseInt(r.maleCount) || 0;
      const femaleCount = parseInt(r.femaleCount) || 0;

      // احسب المدة بالدقائق
      let durationMinutes = 0;
      if (startTime && endTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(eh)) {
          durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
        }
      }

      try {
        await db.attendance.create({
          data: {
            date,
            courseName,
            teacherId,
            teacherName: teacherName || null,
            studentId,
            level: (r.level || '').toString().trim() || null,
            startTime: startTime || null,
            endTime: endTime || null,
            timeSlot: startTime && endTime ? `${startTime} - ${endTime}` : null,
            totalCount,
            maleCount,
            femaleCount,
            durationMinutes,
            notes: (r.notes || '').toString().trim() || null,
          },
        });
        successCount++;
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
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/import/attendance error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
