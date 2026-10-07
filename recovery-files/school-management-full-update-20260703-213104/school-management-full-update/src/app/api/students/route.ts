import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/students - list all students with filters
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('departmentId');
    const levelId = searchParams.get('levelId');
    const specializationId = searchParams.get('specializationId');
    const status = searchParams.get('status');

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { studentNumber: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (departmentId && departmentId !== 'all') where.departmentId = departmentId;
    if (levelId && levelId !== 'all') where.levelId = levelId;
    if (specializationId && specializationId !== 'all') where.specializationId = specializationId;
    if (status && status !== 'all') where.status = status;

    const students = await db.student.findMany({
      where,
      include: {
        department: true,
        level: true,
        specialization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ students });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/students error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/students - create new student
// If the student's department has hasInstallments=true (e.g. التقني سامي),
// automatically generate the installment plan (e.g. 30 months).
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    // Auto-generate student number if not provided
    let studentNumber = body.studentNumber;
    if (!studentNumber) {
      const count = await db.student.count();
      studentNumber = `STU-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    }

    // Fetch the department to check if installments are required
    let department: any = null;
    if (body.departmentId) {
      department = await db.department.findUnique({ where: { id: body.departmentId } });
    }

    const courseStartDate = body.courseStartDate ? new Date(body.courseStartDate) : new Date();

    // For التقني سامي: totalAmount is the total to pay over 30 months
    // initialPayment is the down payment (دفعة أولية) that is deducted from totalAmount
    // Monthly installment = (totalAmount - initialPayment) / installmentMonths
    const totalAmount = body.totalAmount ? parseFloat(body.totalAmount) : null;
    const initialPayment = body.initialPayment ? parseFloat(body.initialPayment) : 0;

    const student = await db.student.create({
      data: {
        studentNumber,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        gender: body.gender || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        address: body.address || null,
        photoUrl: body.photoUrl || null,
        departmentId: body.departmentId || null,
        levelId: body.levelId || null,
        specializationId: body.specializationId || null,
        section: body.section || null,
        college: body.college || null,
        specialty: body.specialty || null,
        courseStartDate,
        totalAmount,
        initialPayment,
        registrationDate: body.registrationDate ? new Date(body.registrationDate) : new Date(),
        status: body.status || 'registered',
        docPhotos: body.docPhotos === true || body.docPhotos === 'true',
        docBirthCert: body.docBirthCert === true || body.docBirthCert === 'true',
        docIdCard: body.docIdCard === true || body.docIdCard === 'true',
        docTsPhotos: body.docTsPhotos === true || body.docTsPhotos === 'true',
        docTsBirthCerts: body.docTsBirthCerts === true || body.docTsBirthCerts === 'true',
        docTsIdCards: body.docTsIdCards === true || body.docTsIdCards === 'true',
        docSchoolCert: body.docSchoolCert === true || body.docSchoolCert === 'true',
        docMedicalCert: body.docMedicalCert === true || body.docMedicalCert === 'true',
        notes: body.notes || null,
      },
      include: { department: true, level: true, specialization: true },
    });

    // Generate installment plan if department requires it (e.g. التقني سامي = 30 months)
    if (department && department.hasInstallments && department.installmentMonths) {
      const months = department.installmentMonths;
      // Calculate the remaining amount after deducting the initial payment
      const effectiveTotal = (totalAmount || 0) - initialPayment;
      // Monthly installment = remaining amount / months
      let monthlyAmount = 0;
      if (effectiveTotal > 0) {
        monthlyAmount = Math.round((effectiveTotal / months) * 100) / 100;
      } else if (department.defaultMonthlyAmount) {
        monthlyAmount = department.defaultMonthlyAmount;
      }

      const installments = [];
      for (let i = 1; i <= months; i++) {
        const expectedDate = new Date(courseStartDate);
        expectedDate.setMonth(expectedDate.getMonth() + (i - 1));
        installments.push({
          studentId: student.id,
          monthNumber: i,
          expectedAmount: monthlyAmount,
          expectedDate,
          status: 'pending',
        });
      }
      await db.installmentPlan.createMany({ data: installments });

      // If there's an initial payment, record it as a StudentPayment + mark month 1 as paid
      if (initialPayment > 0) {
        // Generate receipt number for initial payment
        const setting = await db.setting.findUnique({ where: { key: 'receipt_counter' } });
        let counter = setting ? parseInt(setting.value) : 2000;
        counter++;
        await db.setting.upsert({
          where: { key: 'receipt_counter' },
          update: { value: String(counter) },
          create: { key: 'receipt_counter', value: String(counter) },
        });

        // Find the first installment to link the payment
        const firstInstallment = await db.installmentPlan.findFirst({
          where: { studentId: student.id, monthNumber: 1 },
        });

        const payment = await db.studentPayment.create({
          data: {
            receiptNumber: `W-${counter}`,
            studentId: student.id,
            amount: initialPayment,
            paymentType: 'registration',
            paymentLabel: 'دفعة أولية',
            paymentDate: new Date(),
            paymentMethod: 'cash',
            installmentId: firstInstallment?.id || null,
            notes: 'الدفعة الأولية عند التسجيل',
          },
        });

        // If first installment exists, mark it as paid (or partial if initial < monthly)
        if (firstInstallment) {
          const newPaidAmount = Math.min(initialPayment, firstInstallment.expectedAmount);
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

    return NextResponse.json({ student }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/students error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
