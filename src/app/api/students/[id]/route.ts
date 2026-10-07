import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/students/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const student = await db.student.findUnique({
      where: { id },
      include: {
        department: true,
        level: true,
        specialization: true,
        payments: { orderBy: { paymentDate: 'desc' } },
        registrations: { orderBy: { date: 'desc' } },
        attendances: { orderBy: { date: 'desc' }, take: 50 },
        installments: { orderBy: { monthNumber: 'asc' } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ student });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/students/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT /api/students/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Fetch existing student to compare department changes
    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    const oldDepartmentId = existing.departmentId;
    const newDepartmentId = body.departmentId || null;

    const courseStartDate = body.courseStartDate ? new Date(body.courseStartDate) : undefined;
    const totalAmount = body.totalAmount !== undefined ? (body.totalAmount ? parseFloat(body.totalAmount) : null) : undefined;
    const initialPayment = body.initialPayment !== undefined ? (body.initialPayment ? parseFloat(body.initialPayment) : 0) : undefined;

    const student = await db.student.update({
      where: { id },
      data: {
        studentNumber: body.studentNumber,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gender: body.gender || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        address: body.address || null,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : undefined,
        departmentId: newDepartmentId,
        levelId: body.levelId || null,
        specializationId: body.specializationId || null,
        section: body.section || null,
        college: body.college || null,
        specialty: body.specialty || null,
        courseStartDate,
        batchMonth: body.batchMonth !== undefined ? (body.batchMonth || null) : undefined,
        totalAmount,
        initialPayment,
        status: body.status,
        docPhotos: body.docPhotos === true || body.docPhotos === 'true',
        docBirthCert: body.docBirthCert === true || body.docBirthCert === 'true',
        docIdCard: body.docIdCard === true || body.docIdCard === 'true',
        docTsPhotos: body.docTsPhotos === true || body.docTsPhotos === 'true',
        docTsBirthCerts: body.docTsBirthCerts === true || body.docTsBirthCerts === 'true',
        docTsIdCards: body.docTsIdCards === true || body.docTsIdCards === 'true',
        docSchoolCert: body.docSchoolCert === true || body.docSchoolCert === 'true',
        docMedicalCert: body.docMedicalCert === true || body.docMedicalCert === 'true',
        docPracticalTraining: body.docPracticalTraining === true || body.docPracticalTraining === 'true',
        practicalStartDate: body.practicalStartDate ? new Date(body.practicalStartDate) : null,
        practicalEndDate: body.practicalEndDate ? new Date(body.practicalEndDate) : null,
        docCertificateReceived: body.docCertificateReceived === true || body.docCertificateReceived === 'true',
        certificateReceivedDate: body.certificateReceivedDate ? new Date(body.certificateReceivedDate) : null,
        schoolName: body.schoolName || null,
        educationLevel: body.educationLevel || null,
        schoolStream: body.schoolStream || null,
        schoolYear: body.schoolYear || null,
        notes: body.notes || null,
      },
      include: { department: true, level: true, specialization: true },
    });

    // If the department changed or totalAmount/initialPayment changed, regenerate the installment plan
    const shouldRegenerate =
      oldDepartmentId !== newDepartmentId ||
      (totalAmount !== undefined && totalAmount !== existing.totalAmount) ||
      (initialPayment !== undefined && initialPayment !== (existing.initialPayment || 0));

    if (shouldRegenerate) {
      // Delete existing installments (and unlink payments)
      await db.studentPayment.updateMany({
        where: { studentId: id, installmentId: { not: null } },
        data: { installmentId: null },
      });
      await db.installmentPlan.deleteMany({ where: { studentId: id } });

      if (newDepartmentId) {
        const department = await db.department.findUnique({ where: { id: newDepartmentId } });
        if (department && department.hasInstallments && department.installmentMonths) {
          const months = department.installmentMonths;
          // Get effective total and initial payment
          const effectiveTotalAmount = totalAmount !== undefined ? totalAmount : existing.totalAmount;
          const effectiveInitial = initialPayment !== undefined ? initialPayment : (existing.initialPayment || 0);
          // Remaining = totalAmount - initialPayment
          const effectiveTotal = (effectiveTotalAmount || 0) - effectiveInitial;
          let monthlyAmount = 0;
          if (effectiveTotal > 0) {
            monthlyAmount = Math.round((effectiveTotal / months) * 100) / 100;
          } else if (department.defaultMonthlyAmount) {
            monthlyAmount = department.defaultMonthlyAmount;
          }
          const startDate = courseStartDate || existing.courseStartDate || new Date();
          const installments = [];
          for (let i = 1; i <= months; i++) {
            const expectedDate = new Date(startDate);
            expectedDate.setMonth(expectedDate.getMonth() + (i - 1));
            installments.push({
              studentId: id,
              monthNumber: i,
              expectedAmount: monthlyAmount,
              expectedDate,
              status: 'pending',
            });
          }
          await db.installmentPlan.createMany({ data: installments });

          // If there's an initial payment, record it as a StudentPayment + mark month 1 as paid
          if (effectiveInitial > 0) {
            const setting = await db.setting.findUnique({ where: { key: 'receipt_counter' } });
            let counter = setting ? parseInt(setting.value) : 2000;
            counter++;
            await db.setting.upsert({
              where: { key: 'receipt_counter' },
              update: { value: String(counter) },
              create: { key: 'receipt_counter', value: String(counter) },
            });

            const firstInstallment = await db.installmentPlan.findFirst({
              where: { studentId: id, monthNumber: 1 },
            });

            await db.studentPayment.create({
              data: {
                receiptNumber: `W-${counter}`,
                studentId: id,
                amount: effectiveInitial,
                paymentType: 'registration',
                paymentLabel: 'دفعة أولية',
                paymentDate: new Date(),
                paymentMethod: 'cash',
                installmentId: firstInstallment?.id || null,
                notes: 'الدفعة الأولية عند التسجيل',
              },
            });

            if (firstInstallment) {
              const newPaidAmount = Math.min(effectiveInitial, firstInstallment.expectedAmount);
              let newStatus = 'pending';
              if (newPaidAmount >= firstInstallment.expectedAmount) {
                newStatus = 'paid';
              } else if (newPaidAmount > 0) {
                newStatus = 'partial';
              }
              await db.installmentPlan.update({
                where: { id: firstInstallment.id },
                data: {
                  paidAmount: newPaidAmount,
                  paidDate: new Date(),
                  status: newStatus,
                  notes: 'دفعة أولية عند التسجيل',
                },
              });
            }
          }
        }
      }
    }

    // سجّل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'update', module: 'students',
          description: 'تعديل طالب: ' + student.name,
        }
      });
    } catch (e) {}

    return NextResponse.json({ student });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/students/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}

// DELETE /api/students/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const student = await db.student.findUnique({ where: { id }, select: { name: true } });
    await db.student.delete({ where: { id } });

    // سجّل النشاط
    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'delete', module: 'students',
          description: 'حذف طالب: ' + (student?.name || id),
        }
      });
    } catch (e) {}

    return NextResponse.json({ message: 'تم حذف الطالب' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/students/[id] error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 });
  }
}
