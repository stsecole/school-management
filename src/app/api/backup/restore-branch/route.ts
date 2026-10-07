// ===== POST /api/backup/restore-branch =====
// (المدير فقط) - استرجاع بيانات فرع محدد من نسخة احتياطية
// لا يمسح بيانات الفروع الأخرى
//
// الخطوات:
// 1. الاتصال بنسختين: الحالية والاحتياطية
// 2. حذف بيانات الفرع المحدد من القاعدة الحالية
// 3. نسخ بيانات الفرع من النسخة الاحتياطية
// 4. الحفاظ على بيانات الفروع الأخرى

import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { db } from '@/lib/db';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let backupDb: PrismaClient | null = null;

  try {
    const user = await requireDirector();
    const body = await request.json();
    const { filename, branchId, confirmDelete } = body;

    // التحقق من المدخلات
    if (!filename) {
      return NextResponse.json({ error: 'اسم الملف مطلوب' }, { status: 400 });
    }
    if (!branchId) {
      return NextResponse.json({ error: 'معرف الفرع مطلوب' }, { status: 400 });
    }
    if (!confirmDelete) {
      return NextResponse.json({ error: 'يجب تأكيد الحذف' }, { status: 400 });
    }

    // Validate filename — accept all backup types
    if (!/^backup-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^backup-[a-zA-Z0-9_]+-\d{8}-\d{6}\.db$/.test(filename) &&
        !/^uploaded-.+\.db$/.test(filename) &&
        !/^backup-cloud-.+\.db$/.test(filename)) {
      return NextResponse.json({ error: 'اسم الملف غير صالح' }, { status: 400 });
    }

    const backupPath = path.join(process.cwd(), 'download', 'backups', filename);

    // Verify file exists
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json({ error: 'النسخة الاحتياطية غير موجودة' }, { status: 404 });
    }

    // التحقق من وجود الفرع في النسخة الاحتياطية
    backupDb = new PrismaClient({
      datasources: { db: { url: `file:${backupPath}` } },
    });

    // الحالة الخاصة: "no-branch" للبيانات القديمة بدون فرع
    let branchInBackup: any = null;
    let isLegacyMode = false;

    if (branchId === 'no-branch') {
      // وضع البيانات القديمة - استرجاع كل السجلات بدون branchId
      isLegacyMode = true;
      branchInBackup = {
        id: 'no-branch',
        name: 'بيانات بدون فرع (نسخة قديمة)',
        code: 'LEGACY',
      };
    } else {
      branchInBackup = await backupDb.branch.findUnique({
        where: { id: branchId },
      });

      if (!branchInBackup) {
        return NextResponse.json({ error: 'الفرع غير موجود في النسخة الاحتياطية' }, { status: 404 });
      }
    }

    // التحقق من وجود الفرع في القاعدة الحالية (للأفراع الحقيقية فقط)
    let branchInCurrent: any = null;
    if (!isLegacyMode) {
      branchInCurrent = await db.branch.findUnique({
        where: { id: branchId },
      });

      if (!branchInCurrent) {
        return NextResponse.json({
          error: 'الفرع غير موجود في القاعدة الحالية. يجب إنشاء الفرع أولاً.',
        }, { status: 400 });
      }
    } else {
      // في الوضع القديم، نتحقق فقط من وجود جدول Branch فارغ أو ننشئ فرع افتراضي
      branchInCurrent = { id: 'no-branch', name: 'بيانات قديمة' };
    }

    // ===== بدء العملية =====
    const startTime = Date.now();
    const stats = {
      deleted: { students: 0, teachers: 0, payments: 0, expenses: 0, attendances: 0, tasks: 0, registrations: 0, documents: 0, exams: 0, leads: 0 },
      restored: { students: 0, teachers: 0, payments: 0, expenses: 0, attendances: 0, tasks: 0, registrations: 0, documents: 0, exams: 0, leads: 0 },
    };

    // ===== 1. حذف بيانات الفرع الحالية (بالترتيب الصحيح للأسبقية) =====

    // حذف الوثائق أولاً (لها foreign key للطالب)
    try {
      const deletedDocs = await db.document.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.documents = deletedDocs.count;
    } catch (e) { console.log('Skip documents delete:', e.message); }

    // حذف مدفوعات الطلاب
    try {
      const deletedPayments = await db.studentPayment.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.payments = deletedPayments.count;
    } catch (e) { console.log('Skip payments delete:', e.message); }

    // حذف الحضور
    try {
      const deletedAttendance = await db.attendance.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.attendances = deletedAttendance.count;
    } catch (e) { console.log('Skip attendance delete:', e.message); }

    // حذف التسجيلات
    try {
      const deletedRegs = await db.registration.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.registrations = deletedRegs.count;
    } catch (e) { console.log('Skip registrations delete:', e.message); }

    // حذف المهام
    try {
      const deletedTasks = await db.task.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.tasks = deletedTasks.count;
    } catch (e) { console.log('Skip tasks delete:', e.message); }

    // حذف المصاريف
    try {
      const deletedExpenses = await db.expense.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.expenses = deletedExpenses.count;
    } catch (e) { console.log('Skip expenses delete:', e.message); }

    // حذف الامتحانات
    try {
      const deletedExams = await db.exam.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.exams = deletedExams.count;
    } catch (e) { console.log('Skip exams delete:', e.message); }

    // حذف العملاء المحتملين
    try {
      const deletedLeads = await db.lead.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.leads = deletedLeads.count;
    } catch (e) { console.log('Skip leads delete:', e.message); }

    // حذف الطلاب (بعد حذف التبعيات)
    try {
      const deletedStudents = await db.student.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.students = deletedStudents.count;
    } catch (e) { console.log('Skip students delete:', e.message); }

    // حذف الأساتذة
    try {
      const deletedTeachers = await db.teacher.deleteMany({ where: { branchId: isLegacyMode ? null : branchId } });
      stats.deleted.teachers = deletedTeachers.count;
    } catch (e) { console.log('Skip teachers delete:', e.message); }

    // ===== 2. نسخ البيانات من النسخة الاحتياطية =====

    // نسخ الأساتذة أولاً (لأن الطلاب قد يعتمدون عليهم)
    try {
      const teachers = await backupDb.teacher.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const t of teachers) {
        try {
          await db.teacher.create({
            data: {
              id: t.id,
              name: t.name,
              email: t.email,
              phone: t.phone,
              gender: t.gender,
              specialty: t.specialty,
              departmentId: t.departmentId,
              salary: t.salary,
              hireDate: t.hireDate,
              status: t.status,
              branchId: t.branchId,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            },
          });
          stats.restored.teachers++;
        } catch (e) {
          console.log('Skip teacher restore:', t.id, e.message);
        }
      }
    } catch (e) { console.log('Teachers restore failed:', e.message); }

    // نسخ الطلاب
    try {
      const students = await backupDb.student.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const s of students) {
        try {
          await db.student.create({
            data: {
              id: s.id,
              studentNumber: s.studentNumber,
              name: s.name,
              email: s.email,
              phone: s.phone,
              gender: s.gender,
              birthDate: s.birthDate,
              address: s.address,
              photoUrl: s.photoUrl,
              departmentId: s.departmentId,
              levelId: s.levelId,
              specializationId: s.specializationId,
              section: s.section,
              college: s.college,
              specialty: s.specialty,
              courseStartDate: s.courseStartDate,
              totalAmount: s.totalAmount,
              initialPayment: s.initialPayment,
              registrationDate: s.registrationDate,
              status: s.status,
              docPhotos: s.docPhotos,
              docBirthCert: s.docBirthCert,
              docIdCard: s.docIdCard,
              docTsPhotos: s.docTsPhotos,
              docTsBirthCerts: s.docTsBirthCerts,
              docTsIdCards: s.docTsIdCards,
              docSchoolCert: s.docSchoolCert,
              docMedicalCert: s.docMedicalCert,
              docPracticalTraining: s.docPracticalTraining,
              practicalStartDate: s.practicalStartDate,
              practicalEndDate: s.practicalEndDate,
              docCertificateReceived: s.docCertificateReceived,
              certificateReceivedDate: s.certificateReceivedDate,
              schoolName: s.schoolName,
              educationLevel: s.educationLevel,
              schoolStream: s.schoolStream,
              schoolYear: s.schoolYear,
              notes: s.notes,
              branchId: s.branchId,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            },
          });
          stats.restored.students++;
        } catch (e) {
          console.log('Skip student restore:', s.id, e.message);
        }
      }
    } catch (e) { console.log('Students restore failed:', e.message); }

    // نسخ مدفوعات الطلاب
    try {
      const payments = await backupDb.studentPayment.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const p of payments) {
        try {
          await db.studentPayment.create({
            data: {
              id: p.id,
              receiptNumber: p.receiptNumber + '-R' + Date.now().toString().slice(-4), // تجنب تكرار رقم الوصل
              studentId: p.studentId,
              amount: p.amount,
              paymentType: p.paymentType,
              paymentLabel: p.paymentLabel,
              paymentDate: p.paymentDate,
              paymentMethod: p.paymentMethod,
              installmentId: p.installmentId,
              notes: p.notes,
              branchId: p.branchId,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            },
          });
          stats.restored.payments++;
        } catch (e) {
          console.log('Skip payment restore:', p.id, e.message);
        }
      }
    } catch (e) { console.log('Payments restore failed:', e.message); }

    // نسخ المصاريف
    try {
      const expenses = await backupDb.expense.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const e of expenses) {
        try {
          await db.expense.create({
            data: {
              id: e.id,
              date: e.date,
              type: e.type,
              description: e.description,
              amount: e.amount,
              branchId: e.branchId,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt,
            },
          });
          stats.restored.expenses++;
        } catch (err) {
          console.log('Skip expense restore:', e.id, err.message);
        }
      }
    } catch (e) { console.log('Expenses restore failed:', e.message); }

    // نسخ الحضور
    try {
      const attendances = await backupDb.attendance.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const a of attendances) {
        try {
          await db.attendance.create({
            data: {
              id: a.id,
              date: a.date,
              courseId: a.courseId,
              courseName: a.courseName,
              level: a.level,
              startTime: a.startTime,
              endTime: a.endTime,
              timeSlot: a.timeSlot,
              teacherId: a.teacherId,
              teacherName: a.teacherName,
              totalCount: a.totalCount,
              maleCount: a.maleCount,
              femaleCount: a.femaleCount,
              durationMinutes: a.durationMinutes,
              unpaidCount: a.unpaidCount,
              notes: a.notes,
              studentId: a.studentId,
              branchId: a.branchId,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            },
          });
          stats.restored.attendances++;
        } catch (e) {
          console.log('Skip attendance restore:', a.id, e.message);
        }
      }
    } catch (e) { console.log('Attendance restore failed:', e.message); }

    // نسخ المهام
    try {
      const tasks = await backupDb.task.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const t of tasks) {
        try {
          await db.task.create({
            data: {
              id: t.id,
              title: t.title,
              priority: t.priority,
              priorityLabel: t.priorityLabel,
              responsible: t.responsible,
              startDate: t.startDate,
              deadline: t.deadline,
              completed: t.completed,
              status: t.status,
              statusValue: t.statusValue,
              notes: t.notes,
              branchId: t.branchId,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            },
          });
          stats.restored.tasks++;
        } catch (e) {
          console.log('Skip task restore:', t.id, e.message);
        }
      }
    } catch (e) { console.log('Tasks restore failed:', e.message); }

    // نسخ التسجيلات
    try {
      const registrations = await backupDb.registration.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const r of registrations) {
        try {
          await db.registration.create({
            data: {
              id: r.id,
              studentId: r.studentId,
              courseId: r.courseId,
              courseName: r.courseName,
              level: r.level,
              specialty: r.specialty,
              date: r.date,
              note: r.note,
              photoUrl: r.photoUrl,
              branchId: r.branchId,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            },
          });
          stats.restored.registrations++;
        } catch (e) {
          console.log('Skip registration restore:', r.id, e.message);
        }
      }
    } catch (e) { console.log('Registrations restore failed:', e.message); }

    // نسخ الوثائق
    try {
      const documents = await backupDb.document.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const d of documents) {
        try {
          await db.document.create({
            data: {
              id: d.id,
              title: d.title,
              type: d.type,
              studentId: d.studentId,
              studentName: d.studentName,
              fileName: d.fileName,
              filePath: d.filePath,
              fileSize: d.fileSize,
              mimeType: d.mimeType,
              description: d.description,
              tags: d.tags,
              uploadedBy: d.uploadedBy,
              branchId: d.branchId,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            },
          });
          stats.restored.documents++;
        } catch (e) {
          console.log('Skip document restore:', d.id, e.message);
        }
      }
    } catch (e) { console.log('Documents restore failed:', e.message); }

    // نسخ الامتحانات
    try {
      const exams = await backupDb.exam.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const ex of exams) {
        try {
          await db.exam.create({
            data: {
              id: ex.id,
              title: ex.title,
              examDate: ex.examDate,
              maxScore: ex.maxScore,
              passingScore: ex.passingScore,
              weight: ex.weight,
              term: ex.term,
              status: ex.status,
              departmentId: ex.departmentId,
              levelId: ex.levelId,
              courseId: ex.courseId,
              notes: ex.notes,
              branchId: ex.branchId,
              createdAt: ex.createdAt,
              updatedAt: ex.updatedAt,
            },
          });
          stats.restored.exams++;
        } catch (e) {
          console.log('Skip exam restore:', ex.id, e.message);
        }
      }
    } catch (e) { console.log('Exams restore failed:', e.message); }

    // نسخ العملاء المحتملين
    try {
      const leads = await backupDb.lead.findMany({ where: { branchId: isLegacyMode ? null : branchId } });
      for (const l of leads) {
        try {
          await db.lead.create({
            data: {
              id: l.id,
              fullName: l.fullName,
              phone: l.phone,
              phone2: l.phone2,
              email: l.email,
              gender: l.gender,
              birthDate: l.birthDate,
              wilaya: l.wilaya,
              baladia: l.baladia,
              address: l.address,
              source: l.source,
              desiredCourse: l.desiredCourse,
              desiredBranch: l.desiredBranch,
              assignedTo: l.assignedTo,
              firstContactDate: l.firstContactDate,
              lastFollowUpDate: l.lastFollowUpDate,
              nextFollowUpDate: l.nextFollowUpDate,
              status: l.status,
              interestLevel: l.interestLevel,
              notes: l.notes,
              convertedToStudentId: l.convertedToStudentId,
              convertedAt: l.convertedAt,
              lastModifiedBy: l.lastModifiedBy,
              branchId: l.branchId,
              createdAt: l.createdAt,
              updatedAt: l.updatedAt,
            },
          });
          stats.restored.leads++;
        } catch (e) {
          console.log('Skip lead restore:', l.id, e.message);
        }
      }
    } catch (e) { console.log('Leads restore failed:', e.message); }

    const duration = Date.now() - startTime;

    // تسجيل في سجل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'restore',
          module: 'backup',
          description: `استرجاع فرع محدد: ${branchInBackup.name} من النسخة ${filename}`,
          targetType: 'branch',
          targetId: branchId,
          details: JSON.stringify(stats),
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      message: `تم استرجاع بيانات فرع "${branchInBackup.name}" بنجاح`,
      branch: {
        id: branchInBackup.id,
        name: branchInBackup.name,
        code: branchInBackup.code,
      },
      stats,
      durationMs: duration,
      warning: 'تم استبدال بيانات هذا الفرع فقط. بيانات الفروع الأخرى لم تتأثر.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('POST /api/backup/restore-branch error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء الاسترجاع: ' + (error.message || ''),
      details: error.message,
    }, { status: 500 });
  } finally {
    if (backupDb) {
      try {
        await backupDb.$disconnect();
      } catch {}
    }
  }
}
