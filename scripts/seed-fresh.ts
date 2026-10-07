/**
 * سكريبت إدخال البيانات + تصفير القاعدة
 * Run: npx tsx scripts/seed-fresh.ts
 *
 * يحذف كل البيانات الموجودة ثم يُدخل بيانات نظيفة
 * ⚠️ استخدمه فقط إذا أردت البدء من جديد
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('⚠️  تحذير: سيتم حذف كل البيانات الموجودة!');
  console.log('');

  // 1. حذف كل البيانات (بالترتيب الصحيح للعلاقات)
  console.log('🗑️  حذف البيانات الموجودة...');
  await db.aIMessage.deleteMany({});
  await db.aIConversation.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.leadFollowUp.deleteMany({});
  await db.lead.deleteMany({});
  await db.grade.deleteMany({});
  await db.exam.deleteMany({});
  await db.employeeTimesheet.deleteMany({});
  await db.timetableSession.deleteMany({});
  await db.studentPayment.deleteMany({});
  await db.teacherPayment.deleteMany({});
  await db.installmentPlan.deleteMany({});
  await db.expense.deleteMany({});
  await db.task.deleteMany({});
  await db.attendance.deleteMany({});
  await db.registration.deleteMany({});
  await db.student.deleteMany({});
  await db.teacher.deleteMany({});
  await db.subject.deleteMany({});
  await db.group.deleteMany({});
  await db.timeSlot.deleteMany({});
  await db.holiday.deleteMany({});
  await db.workSettings.deleteMany({});
  await db.room.deleteMany({});
  await db.course.deleteMany({});
  await db.specialization.deleteMany({});
  await db.level.deleteMany({});
  await db.department.deleteMany({});
  await db.user.deleteMany({});
  // إعدادات النظام احذفها أيضاً
  await db.setting.deleteMany({});
  console.log('   ✅ تم الحذف');

  // 2. إنشاء admin
  console.log('\n👤 إنشاء المستخدمين...');
  const admin = await db.user.create({
    data: {
      username: 'admin',
      password: 'admin123',
      name: 'المدير العام',
      role: 'director',
      canManageTimetable: true,
    },
  });
  console.log(`   ✅ admin / admin123`);

  await db.user.create({
    data: {
      username: 'employee',
      password: 'emp123',
      name: 'موظف التسجيل',
      role: 'employee',
      canManageTimetable: false,
    },
  });
  console.log(`   ✅ employee / emp123`);

  // 3. الأقسام
  console.log('\n🏫 إنشاء الأقسام...');
  const deptData = [
    { name: 'اللغات', code: 'LANG', isFixed: true },
    { name: 'الدورات النسوية', code: 'WOMEN', isFixed: true },
    { name: 'الدورات التأهيلية', code: 'QUAL', isFixed: true },
    { name: 'التقني سامي', code: 'TS', isFixed: true, hasInstallments: true, installmentMonths: 30, defaultMonthlyAmount: 2500 },
    { name: 'الإعلام الآلي', code: 'INFO', isFixed: true },
    { name: 'التسيير', code: 'MGMT', isFixed: true },
  ];
  const deptMap: Record<string, string> = {};
  for (const d of deptData) {
    const dept = await db.department.create({ data: d });
    deptMap[d.name] = dept.id;
    console.log(`   ✅ ${dept.name}`);
  }

  // 4. المستويات
  console.log('\n📊 إنشاء المستويات...');
  const levelData = [
    { name: '初級 - مستوى أول', order: 1 },
    { name: 'متوسط - مستوى ثاني', order: 2 },
    { name: 'متقدم - مستوى ثالث', order: 3 },
    { name: 'تقني سامي سنة أولى', order: 4 },
    { name: 'تقني سامي سنة ثانية', order: 5 },
  ];
  for (const l of levelData) {
    await db.level.create({ data: l });
  }
  console.log(`   ✅ ${levelData.length} مستويات`);

  // 5. التخصصات
  console.log('\n📚 إنشاء التخصصات...');
  const specData = [
    { name: 'اللغة الإنجليزية', dept: 'اللغات' },
    { name: 'اللغة الفرنسية', dept: 'اللغات' },
    { name: 'اللغة الإسبانية', dept: 'اللغات' },
    { name: 'خياطة وتطريز', dept: 'الدورات النسوية' },
    { name: 'ديكور', dept: 'الدورات النسوية' },
    { name: 'صيدلة', dept: 'الدورات التأهيلية' },
    { name: 'تسويق', dept: 'التسيير' },
    { name: 'محاسبة', dept: 'التسيير' },
    { name: 'تنمية المهارات', dept: 'الدورات التأهيلية' },
    { name: 'سباكة', dept: 'الدورات التأهيلية' },
  ];
  for (const s of specData) {
    await db.specialization.create({ data: { name: s.name, departmentId: deptMap[s.dept] } });
  }
  console.log(`   ✅ ${specData.length} تخصصات`);

  // 6. الأساتذة (6)
  console.log('\n👨‍🏫 إنشاء الأساتذة...');
  const teacherData = [
    { name: 'أحمد بن علي', gender: 'ذكر', specialty: 'اللغة الإنجليزية', salary: 35000, dept: 'اللغات' },
    { name: 'فاطمة الزهراء', gender: 'أنثى', specialty: 'خياطة وتطريز', salary: 30000, dept: 'الدورات النسوية' },
    { name: 'محمد قاسمي', gender: 'ذكر', specialty: 'الإعلام الآلي', salary: 40000, dept: 'الإعلام الآلي' },
    { name: 'سعاد بوزيد', gender: 'أنثى', specialty: 'صيدلة', salary: 38000, dept: 'الدورات التأهيلية' },
    { name: 'يوسف حمدي', gender: 'ذكر', specialty: 'تسويق', salary: 35000, dept: 'التسيير' },
    { name: 'خالد مرابط', gender: 'ذكر', specialty: 'ديكور', salary: 32000, dept: 'الدورات النسوية' },
  ];
  const teacherMap: Record<string, string> = {};
  for (const t of teacherData) {
    const teacher = await db.teacher.create({
      data: {
        name: t.name,
        gender: t.gender,
        specialty: t.specialty,
        salary: t.salary,
        departmentId: deptMap[t.dept],
        status: 'active',
        hireDate: new Date(),
      },
    });
    teacherMap[t.name] = teacher.id;
    console.log(`   ✅ ${teacher.name}`);
  }

  // 7. الطلاب (18 طالب)
  console.log('\n👥 إنشاء الطلاب (18 طالب)...');
  const studentData = [
    { name: 'أحمد بن محمد', gender: 'ذكر', dept: 'التقني سامي', spec: 'صيدلة', phone: '0551234567' },
    { name: 'فاطمة الزهراء', gender: 'أنثى', dept: 'الدورات النسوية', spec: 'خياطة وتطريز', phone: '0552345678' },
    { name: 'يوسف العياشي', gender: 'ذكر', dept: 'الإعلام الآلي', spec: 'تنمية المهارات', phone: '0553456789' },
    { name: 'مريم بوزيد', gender: 'أنثى', dept: 'الدورات التأهيلية', spec: 'صيدلة', phone: '0554567890' },
    { name: 'خالد حمدي', gender: 'ذكر', dept: 'اللغات', spec: 'اللغة الإنجليزية', phone: '0555678901' },
    { name: 'سارة بن علي', gender: 'أنثى', dept: 'التسيير', spec: 'تسويق', phone: '0556789012' },
    { name: 'عبد الرحمن قاسمي', gender: 'ذكر', dept: 'التقني سامي', spec: 'تنمية المهارات', phone: '0557890123' },
    { name: 'نور الهدى', gender: 'أنثى', dept: 'الدورات النسوية', spec: 'ديكور', phone: '0558901234' },
    { name: 'محمد أمين', gender: 'ذكر', dept: 'الإعلام الآلي', spec: 'تنمية المهارات', phone: '0559012345' },
    { name: 'أمينة حداد', gender: 'أنثى', dept: 'اللغات', spec: 'اللغة الفرنسية', phone: '0550123456' },
    { name: 'بلال شريف', gender: 'ذكر', dept: 'التسيير', spec: 'محاسبة', phone: '0561234567' },
    { name: 'خديجة بن صالح', gender: 'أنثى', dept: 'الدورات التأهيلية', spec: 'سباكة', phone: '0562345678' },
    { name: 'إبراهيم مزياني', gender: 'ذكر', dept: 'التقني سامي', spec: 'صيدلة', phone: '0563456789' },
    { name: 'سمية عمراني', gender: 'أنثى', dept: 'الدورات النسوية', spec: 'خياطة وتطريز', phone: '0564567890' },
    { name: 'رياض بلقاسم', gender: 'ذكر', dept: 'الإعلام الآلي', spec: 'تنمية المهارات', phone: '0565678901' },
    { name: 'ليلى مرابط', gender: 'أنثى', dept: 'اللغات', spec: 'اللغة الإسبانية', phone: '0566789012' },
    { name: 'حمزة زيدان', gender: 'ذكر', dept: 'التسيير', spec: 'تسويق', phone: '0567890123' },
    { name: 'صفاء بوزيدي', gender: 'أنثى', dept: 'الدورات التأهيلية', spec: 'صيدلة', phone: '0568901234' },
  ];

  const studentMap: Record<string, string> = {};
  for (let i = 0; i < studentData.length; i++) {
    const s = studentData[i];
    const deptId = deptMap[s.dept];
    const spec = await db.specialization.findFirst({ where: { name: s.spec, departmentId: deptId } });
    const student = await db.student.create({
      data: {
        name: s.name,
        gender: s.gender,
        phone: s.phone,
        departmentId: deptId,
        specializationId: spec?.id,
        studentNumber: `STU-2026-${String(i + 1).padStart(3, '0')}`,
        status: 'registered',
        registrationDate: new Date(),
      },
    });
    studentMap[s.name] = student.id;
  }
  console.log(`   ✅ ${studentData.length} طالب`);

  // 8. الدفعات (43 دفعة)
  console.log('\n💰 إنشاء الدفعات (43 دفعة)...');
  const studentNames = Object.keys(studentMap);
  const amounts = [1500, 2000, 2500, 3000, 3500, 4000, 5000];
  const paymentLabels = ['تسجيل', 'قسط أول', 'قسط ثاني', 'قسط ثالث', 'قسط رابع'];
  for (let i = 0; i < 43; i++) {
    const studentName = studentNames[i % studentNames.length];
    const receiptNumber = `W-2026-${String(i + 1).padStart(4, '0')}`;
    await db.studentPayment.create({
      data: {
        receiptNumber,
        studentId: studentMap[studentName],
        amount: amounts[i % amounts.length],
        paymentType: i === 0 ? 'registration' : 'installment',
        paymentLabel: paymentLabels[i % paymentLabels.length],
        paymentDate: new Date(Date.now() - i * 86400000),
        paymentMethod: 'cash',
      },
    });
  }
  console.log('   ✅ 43 دفعة');

  // 9. الحضور (90 سجل)
  console.log('\n📅 إنشاء سجلات الحضور (90 سجل)...');
  const courseNames = ['اللغة الإنجليزية', 'خياطة وتطريز', 'الإعلام الآلي', 'صيدلة', 'تسويق', 'ديكور'];
  for (let i = 0; i < 90; i++) {
    const teacher = teacherData[i % teacherData.length];
    const studentName = studentNames[i % studentNames.length];
    await db.attendance.create({
      data: {
        date: new Date(Date.now() - i * 86400000),
        courseName: courseNames[i % courseNames.length],
        level: i % 2 === 0 ? '初級 - مستوى أول' : 'متوسط - مستوى ثاني',
        startTime: '08:00',
        endTime: '10:00',
        timeSlot: '08:00 - 10:00',
        teacherId: teacherMap[teacher.name],
        teacherName: teacher.name,
        totalCount: 8 + (i % 15),
        maleCount: 4 + (i % 7),
        femaleCount: 3 + (i % 8),
        durationMinutes: 120,
        studentId: studentMap[studentName],
      },
    });
  }
  console.log('   ✅ 90 سجل حضور');

  // 10. المهام (6)
  console.log('\n📋 إنشاء المهام...');
  const taskData = [
    { title: 'تحضير امتحانات نهاية الفصل', priority: 'high', label: 'عالي' },
    { title: 'تحصيل أقساط المتأخرين', priority: 'high', label: 'عالي' },
    { title: 'تحديث قاعدة بيانات الطلاب', priority: 'medium', label: 'متوسط' },
    { title: 'صيانة قاعة الإعلام الآلي', priority: 'low', label: 'منخفض' },
    { title: 'تنظيم حفل تخرّج الدفعة', priority: 'medium', label: 'متوسط' },
    { title: 'تحضير تقرير شهري للإدارة', priority: 'medium', label: 'متوسط' },
  ];
  for (const t of taskData) {
    await db.task.create({
      data: {
        title: t.title,
        priority: t.priority,
        priorityLabel: t.label,
        responsible: 'المدير العام',
        startDate: new Date(),
        deadline: new Date(Date.now() + 7 * 86400000),
        status: 'pending',
      },
    });
  }
  console.log('   ✅ 6 مهام');

  // ملخص نهائي
  console.log('\n================================================');
  console.log('  🎉 تم إدخال البيانات بنجاح!');
  console.log('================================================\n');
  console.log('الإحصائيات النهائية:');
  console.log(`   👥 الطلاب: ${await db.student.count()}`);
  console.log(`   👨‍🏫 الأساتذة: ${await db.teacher.count()}`);
  console.log(`   🏫 الأقسام: ${await db.department.count()}`);
  console.log(`   💰 الدفعات: ${await db.studentPayment.count()}`);
  console.log(`   📅 الحضور: ${await db.attendance.count()}`);
  console.log(`   📋 المهام: ${await db.task.count()}`);
  console.log(`   👤 المستخدمون: ${await db.user.count()}`);
  console.log('');
  console.log('تسجيل الدخول: admin / admin123');
}

main()
  .catch((e) => {
    console.error('❌ خطأ:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
