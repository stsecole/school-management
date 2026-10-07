// ===== GET /api/reports/student-filters — فلاتر مفصلة للطلاب =====
// يدعم الفلترة حسب: القسم، المستندات، التربص التطبيقي، الشهادة، الطور، الشعبة، السنة، الحالة
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const branchFilter = await getBranchFilter();

    // ===== بناء الفلتر =====
    const where: any = { ...branchFilter };

    // فلتر القسم
    const departmentId = searchParams.get('departmentId');
    if (departmentId && departmentId !== 'all') where.departmentId = departmentId;

    // فلتر الحالة
    const status = searchParams.get('status');
    if (status && status !== 'all') where.status = status;

    // فلتر الجنس
    const gender = searchParams.get('gender');
    if (gender && gender !== 'all') where.gender = gender;

    // ===== فلتر المستندات =====
    const docFilter = searchParams.get('docFilter');
    if (docFilter && docFilter !== 'all') {
      switch (docFilter) {
        case 'photos_missing': where.docPhotos = false; break;
        case 'photos_done': where.docPhotos = true; break;
        case 'birth_missing': where.docBirthCert = false; break;
        case 'birth_done': where.docBirthCert = true; break;
        case 'idcard_missing': where.docIdCard = false; break;
        case 'idcard_done': where.docIdCard = true; break;
        case 'school_missing': where.docSchoolCert = false; break;
        case 'school_done': where.docSchoolCert = true; break;
        case 'medical_missing': where.docMedicalCert = false; break;
        case 'medical_done': where.docMedicalCert = true; break;
        case 'ts_photos_missing': where.docTsPhotos = false; break;
        case 'ts_birth_missing': where.docTsBirthCerts = false; break;
        case 'ts_idcard_missing': where.docTsIdCards = false; break;
        case 'ts_file_complete':
          where.docTsPhotos = true; where.docTsBirthCerts = true;
          where.docTsIdCards = true; where.docSchoolCert = true; where.docMedicalCert = true;
          break;
        case 'ts_file_incomplete':
          where.OR = [
            { docTsPhotos: false }, { docTsBirthCerts: false },
            { docTsIdCards: false }, { docSchoolCert: false }, { docMedicalCert: false },
          ];
          break;
      }
    }

    // ===== فلتر التربص التطبيقي (الدورات الطبية) =====
    const practicalFilter = searchParams.get('practicalFilter');
    if (practicalFilter && practicalFilter !== 'all') {
      switch (practicalFilter) {
        case 'practical_done': where.docPracticalTraining = true; break;
        case 'practical_missing': where.docPracticalTraining = false; break;
        case 'cert_received': where.docCertificateReceived = true; break;
        case 'cert_not_received': where.docCertificateReceived = false; break;
      }
    }

    // ===== فلتر الدعم المدرسي =====
    const educationLevel = searchParams.get('educationLevel');
    if (educationLevel && educationLevel !== 'all') where.educationLevel = educationLevel;

    const schoolStream = searchParams.get('schoolStream');
    if (schoolStream && schoolStream !== 'all') where.schoolStream = schoolStream;

    const schoolYear = searchParams.get('schoolYear');
    if (schoolYear && schoolYear !== 'all') where.schoolYear = schoolYear;

    const schoolName = searchParams.get('schoolName');
    if (schoolName) where.schoolName = { contains: schoolName };

    // ===== فلتر الدفعة (التقني سامي) =====
    const batchMonth = searchParams.get('batchMonth');
    if (batchMonth && batchMonth !== 'all') where.batchMonth = batchMonth;

    // ===== فلتر الغيابات =====
    const absenceFilter = searchParams.get('absenceFilter');
    const absenceDays = searchParams.get('absenceDays');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // ===== جلب النتائج =====
    const students = await db.student.findMany({
      where,
      include: {
        department: { select: { name: true, code: true } },
        level: { select: { name: true } },
        specialization: { select: { name: true } },
        attendances: {
          where: startDate && endDate ? { date: { gte: new Date(startDate), lte: new Date(endDate) } } : undefined,
          select: { date: true, notes: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    // ===== فلترة الغيابات =====
    let filteredStudents = students;
    if (absenceFilter && absenceFilter !== 'all') {
      const minDays = absenceDays ? parseInt(absenceDays) : 3;
      if (absenceFilter === 'frequent_absent') {
        // طلاب غابوا كثيراً (أقل من X سجلات حضور)
        filteredStudents = students.filter(s => s.attendances.length < minDays);
      } else if (absenceFilter === 'never_attended') {
        // طلاب لم يسجّلوا أي حضور
        filteredStudents = students.filter(s => s.attendances.length === 0);
      } else if (absenceFilter === 'good_attendance') {
        // طلاب منتظمون (أكثر من X سجلات)
        filteredStudents = students.filter(s => s.attendances.length >= minDays);
      }
    }

    // ===== إحصائيات سريعة =====
    const stats = {
      total: filteredStudents.length,
      withAllDocs: filteredStudents.filter(s => s.docPhotos && s.docBirthCert && s.docIdCard).length,
      missingDocs: filteredStudents.filter(s => !s.docPhotos || !s.docBirthCert || !s.docIdCard).length,
      practicalDone: filteredStudents.filter(s => s.docPracticalTraining).length,
      practicalMissing: filteredStudents.filter(s => !s.docPracticalTraining).length,
      certReceived: filteredStudents.filter(s => s.docCertificateReceived).length,
      certNotReceived: filteredStudents.filter(s => !s.docCertificateReceived).length,
      tsComplete: filteredStudents.filter(s => s.docTsPhotos && s.docTsBirthCerts && s.docTsIdCards && s.docSchoolCert && s.docMedicalCert).length,
      tsIncomplete: filteredStudents.filter(s => !s.docTsPhotos || !s.docTsBirthCerts || !s.docTsIdCards || !s.docSchoolCert || !s.docMedicalCert).length,
      // إحصائيات الغياب
      neverAttended: students.filter(s => s.attendances.length === 0).length,
      frequentAbsent: students.filter(s => s.attendances.length > 0 && s.attendances.length < (absenceDays ? parseInt(absenceDays) : 3)).length,
      goodAttendance: students.filter(s => s.attendances.length >= (absenceDays ? parseInt(absenceDays) : 3)).length,
    };

    // ===== قوائم الفلاتر المتاحة =====
    const departments = await db.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      students: filteredStudents.map(s => ({
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        phone: s.phone,
        gender: s.gender,
        status: s.status,
        department: s.department?.name,
        departmentCode: s.department?.code,
        level: s.level?.name,
        specialization: s.specialization?.name,
        // المستندات
        docPhotos: s.docPhotos,
        docBirthCert: s.docBirthCert,
        docIdCard: s.docIdCard,
        docSchoolCert: s.docSchoolCert,
        docMedicalCert: s.docMedicalCert,
        // التقني سامي
        docTsPhotos: s.docTsPhotos,
        docTsBirthCerts: s.docTsBirthCerts,
        docTsIdCards: s.docTsIdCards,
        // الطبي
        docPracticalTraining: s.docPracticalTraining,
        practicalStartDate: s.practicalStartDate,
        practicalEndDate: s.practicalEndDate,
        docCertificateReceived: s.docCertificateReceived,
        certificateReceivedDate: s.certificateReceivedDate,
        // الدعم المدرسي
        schoolName: s.schoolName,
        educationLevel: s.educationLevel,
        schoolStream: s.schoolStream,
        schoolYear: s.schoolYear,
        // الحضور
        attendanceCount: s.attendances.length,
      })),
      stats,
      departments,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET /api/reports/student-filters error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
