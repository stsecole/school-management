// seed.js - سكريبت إنشاء البيانات التجريبية
// طريقة التشغيل: node seed.js

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('بدء إنشاء البيانات...\n');

  // حذف البيانات القديمة
  console.log('حذف البيانات القديمة...');
  await db.studentPayment.deleteMany();
  await db.teacherPayment.deleteMany();
  await db.expense.deleteMany();
  await db.attendance.deleteMany();
  await db.task.deleteMany();
  await db.registration.deleteMany();
  await db.installmentPlan.deleteMany();
  await db.student.deleteMany();
  await db.teacher.deleteMany();
  await db.specialization.deleteMany();
  await db.course.deleteMany();
  await db.level.deleteMany();
  await db.department.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();
  console.log('تم الحذف\n');

  // 1. المستخدمون
  console.log('إنشاء المستخدمين...');
  await db.user.create({
    data: { username: 'admin', password: 'admin123', name: 'المدير', role: 'director', canManageTimetable: true }
  });
  await db.user.create({
    data: { username: 'employee', password: 'emp123', name: 'موظف التسجيل', role: 'employee', canManageTimetable: false }
  });
  await db.setting.create({ data: { key: 'finance_password', value: 'admin123' } });
  await db.setting.create({ data: { key: 'receipt_counter', value: '2000' } });
  console.log('  ✓ 2 مستخدمين\n');

  // 2. الأقسام
  console.log('إنشاء الأقسام...');
  const ts = await db.department.create({
    data: { name: 'التقني سامي', code: 'TS', isFixed: true, hasInstallments: true, installmentMonths: 30, defaultMonthlyAmount: 3000 }
  });
  const lang = await db.department.create({ data: { name: 'اللغات', code: 'LANG', isFixed: true } });
  const sup = await db.department.create({ data: { name: 'الدعم المدرسي', code: 'SUP', isFixed: true } });
  const wom = await db.department.create({ data: { name: 'الدورات النسوية', code: 'WOM', isFixed: true } });
  const qual = await db.department.create({ data: { name: 'الدورات التأهيلية', code: 'QUAL', isFixed: true } });
  const kid = await db.department.create({ data: { name: 'دورات الأطفال', code: 'KID', isFixed: true } });
  console.log('  ✓ 6 أقسام\n');

  // 3. المستويات
  console.log('إنشاء المستويات...');
  const lv0 = await db.level.create({ data: { name: 'بدون مستوى', order: 0 } });
  const lv1 = await db.level.create({ data: { name: 'ابتدائي', order: 1 } });
  const lv2 = await db.level.create({ data: { name: 'متوسط', order: 2 } });
  const lv3 = await db.level.create({ data: { name: 'ثانوي', order: 3 } });
  await db.level.create({ data: { name: 'معهد', order: 4 } });
  await db.level.create({ data: { name: 'جامعي', order: 5 } });
  console.log('  ✓ 6 مستويات\n');

  // 4. التخصصات
  console.log('إنشاء التخصصات...');
  await db.specialization.create({ data: { name: 'صيدلة', departmentId: ts.id } });
  await db.specialization.create({ data: { name: 'مكتبة ومحفوظات', departmentId: ts.id } });
  await db.specialization.create({ data: { name: 'إدارة ومحاسبة', departmentId: ts.id } });
  await db.specialization.create({ data: { name: 'إعلام آلي', departmentId: ts.id } });
  await db.specialization.create({ data: { name: 'اللغة الإنجليزية', departmentId: lang.id } });
  await db.specialization.create({ data: { name: 'اللغة الفرنسية', departmentId: lang.id } });
  await db.specialization.create({ data: { name: 'الابتدائي', departmentId: sup.id } });
  await db.specialization.create({ data: { name: 'المتوسط', departmentId: sup.id } });
  await db.specialization.create({ data: { name: 'الثانوي', departmentId: sup.id } });
  console.log('  ✓ 9 تخصصات\n');

  // 5. الأساتذة
  console.log('إنشاء الأساتذة...');
  const t1 = await db.teacher.create({ data: { name: 'أ. قروي محمد', specialty: 'الصيدلة', departmentId: ts.id, salary: 45000, phone: '0661234567', gender: 'ذكر' } });
  const t2 = await db.teacher.create({ data: { name: 'أ. بن علي فاطمة', specialty: 'المكتبات', departmentId: ts.id, salary: 38000, phone: '0662345678', gender: 'أنثى' } });
  const t3 = await db.teacher.create({ data: { name: 'أ. زيدان أحمد', specialty: 'المحاسبة', departmentId: ts.id, salary: 42000, phone: '0663456789', gender: 'ذكر' } });
  const t4 = await db.teacher.create({ data: { name: 'أ. مرزوق سعاد', specialty: 'الإعلام الآلي', departmentId: ts.id, salary: 40000, phone: '0664567890', gender: 'أنثى' } });
  const t5 = await db.teacher.create({ data: { name: 'أ. بلقاسم يوسف', specialty: 'الرياضيات', departmentId: sup.id, salary: 35000, phone: '0665678901', gender: 'ذكر' } });
  const t6 = await db.teacher.create({ data: { name: 'أ. حملاوي سامية', specialty: 'اللغة الإنجليزية', departmentId: lang.id, salary: 36000, phone: '0666789012', gender: 'أنثى' } });
  console.log('  ✓ 6 أساتذة\n');

  // 6. الطلاب
  console.log('إنشاء الطلاب...');
  const studentNames = [
    'أحمد بن محمد', 'فاطمة الزهراء', 'يوسف العياشي', 'مريم بلقاسم',
    'عبد الرحمن سلمي', 'خديجة بن يحيى', 'محمد الأمين', 'سارة بوزيد',
    'ياسين منصوري', 'نسرين عربي', 'كريم بوذراع', 'أمينة خليفة',
    'سفيان لعماري', 'هدى بوعلام', 'إبراهيم صالحي', 'ليلى مرزوق',
    'أيوب تمرت', 'رقية حسايني'
  ];
  const deptIds = [ts.id, ts.id, ts.id, ts.id, ts.id, lang.id, lang.id, sup.id, sup.id, ts.id, lang.id, sup.id, ts.id, lang.id, sup.id, ts.id, qual.id, wom.id];
  const genders = ['ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى', 'ذكر', 'أنثى'];
  const statuses = ['continuing', 'continuing', 'registered', 'continuing', 'registered', 'registered', 'continuing', 'registered', 'continuing', 'graduated', 'registered', 'continuing', 'registered', 'continuing', 'registered', 'continuing', 'registered', 'registered'];

  for (let i = 0; i < studentNames.length; i++) {
    await db.student.create({
      data: {
        name: studentNames[i],
        phone: '0770' + String(100000 + i * 1111),
        gender: genders[i],
        departmentId: deptIds[i],
        levelId: lv0.id,
        studentNumber: 'STU-2026-' + String(i + 1).padStart(3, '0'),
        status: statuses[i],
        registrationDate: new Date(2026, 0, 15),
      }
    });
  }
  console.log('  ✓ 18 طالب\n');

  // 7. المهام
  console.log('إنشاء المهام...');
  await db.task.create({ data: { title: 'إعداد تقرير المداخيل الشهرية', priority: 'high', priorityLabel: 'عالي', responsible: 'المدير', startDate: new Date(2026, 5, 1), deadline: new Date(2026, 6, 15), completed: false, statusValue: 0 } });
  await db.task.create({ data: { title: 'تحديث قاعدة بيانات الطلاب', priority: 'medium', priorityLabel: 'متوسط', responsible: 'موظف التسجيل', startDate: new Date(2026, 5, 5), deadline: new Date(2026, 5, 20), completed: false, statusValue: 0 } });
  await db.task.create({ data: { title: 'تنظيم اجتماع مع الأساتذة', priority: 'low', priorityLabel: 'منخفض', responsible: 'المدير', startDate: new Date(2026, 5, 10), deadline: new Date(2026, 5, 25), completed: false, statusValue: 0 } });
  await db.task.create({ data: { title: 'تحصيل أقساط الطلاب المتأخرين', priority: 'high', priorityLabel: 'عالي', responsible: 'المدير', startDate: new Date(2026, 4, 1), deadline: new Date(2026, 4, 30), completed: true, statusValue: 1 } });
  await db.task.create({ data: { title: 'تجهيز قائمة الدورات الجديدة', priority: 'medium', priorityLabel: 'متوسط', responsible: 'موظف التسجيل', startDate: new Date(2026, 5, 15), deadline: new Date(2026, 6, 1), completed: false, statusValue: 0 } });
  await db.task.create({ data: { title: 'مراجعة عقود الأساتذة', priority: 'low', priorityLabel: 'منخفض', responsible: 'المدير', startDate: new Date(2026, 5, 1), deadline: new Date(2026, 6, 30), completed: false, statusValue: 0 } });
  console.log('  ✓ 6 مهام\n');

  // 8. الحضور
  console.log('إنشاء سجلات الحضور...');
  const courses = ['الرياضيات', 'الفيزياء', 'الكيمياء', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'علوم الطبيعة'];
  const teachers = [t1, t2, t3, t4, t5, t6];
  for (let day = 1; day <= 15; day++) {
    for (let c = 0; c < 6; c++) {
      const total = 10 + Math.floor(Math.random() * 15);
      const male = Math.floor(total * 0.6);
      await db.attendance.create({
        data: {
          date: new Date(2026, 5, day),
          courseName: courses[c],
          level: 'الثانوي',
          startTime: '08:00',
          endTime: '10:00',
          timeSlot: '08:00 - 10:00',
          teacherName: teachers[c].name,
          teacherId: teachers[c].id,
          totalCount: total,
          maleCount: male,
          femaleCount: total - male,
          durationMinutes: 120,
        }
      });
    }
  }
  console.log('  ✓ 90 سجل حضور\n');

  // 9. المدفوعات
  console.log('إنشاء المدفوعات...');
  const allStudents = await db.student.findMany();
  let receiptCounter = 2001;
  for (const student of allStudents.slice(0, 10)) {
    for (let m = 0; m < 3; m++) {
      await db.studentPayment.create({
        data: {
          receiptNumber: 'W-' + receiptCounter++,
          studentId: student.id,
          amount: 3000 + Math.floor(Math.random() * 2000),
          paymentType: 'installment',
          paymentLabel: 'قسط ' + (m + 1),
          paymentDate: new Date(2026, m, 15),
          paymentMethod: 'cash',
        }
      });
    }
  }
  await db.setting.upsert({ where: { key: 'receipt_counter' }, update: { value: String(receiptCounter) }, create: { key: 'receipt_counter', value: String(receiptCounter) } });
  console.log('  ✓ 30 دفعة\n');

  // 10. مصاريف
  console.log('إنشاء المصاريف...');
  const expenseTypes = ['إيجار', 'كهرباء', 'ماء', 'قرطاسية', 'صيانة', 'إنترنت'];
  for (let m = 0; m < 3; m++) {
    for (const type of expenseTypes) {
      await db.expense.create({
        data: {
          date: new Date(2026, m, 10),
          type: type,
          description: 'مصروف ' + type + ' شهر ' + (m + 1),
          amount: 5000 + Math.floor(Math.random() * 15000),
        }
      });
    }
  }
  console.log('  ✓ 18 مصروف\n');

  // 11. رواتب الأساتذة
  console.log('إنشاء رواتب الأساتذة...');
  for (const teacher of teachers) {
    await db.teacherPayment.create({
      data: {
        receiptNumber: 'W-' + receiptCounter++,
        teacherId: teacher.id,
        amount: teacher.salary,
        month: '2026-03',
        paymentDate: new Date(2026, 2, 28),
        paymentType: 'salary',
        paymentLabel: 'راتب',
      }
    });
  }
  await db.setting.upsert({ where: { key: 'receipt_counter' }, update: { value: String(receiptCounter) }, create: { key: 'receipt_counter', value: String(receiptCounter) } });
  console.log('  ✓ 6 رواتب\n');

  console.log('════════════════════════════════');
  console.log('تم بنجاح! ملخص البيانات:');
  console.log('  المستخدمون: 2');
  console.log('  الأقسام: 6');
  console.log('  المستويات: 6');
  console.log('  التخصصات: 9');
  console.log('  الأساتذة: 6');
  console.log('  الطلاب: 18');
  console.log('  المهام: 6');
  console.log('  الحضور: 90');
  console.log('  المدفوعات: 30');
  console.log('  المصاريف: 18');
  console.log('  رواتب الأساتذة: 6');
  console.log('════════════════════════════════');
  console.log('الدخول: admin / admin123');
  console.log('كلمة مرور المالية: admin123');
}

main().catch(e => { console.error('خطأ:', e); process.exit(1); }).finally(() => db.$disconnect());