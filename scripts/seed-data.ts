/**
 * سكريبت إدخال البيانات التجريبية يدوياً
 * Run: npx tsx scripts/seed-data.ts
 *
 * يُدخل: مستخدم admin + 6 أقسام + مستويات + 6 أساتذة + 18 طالب + 43 دفعة + 90 سجل حضور
 * لا يحذف البيانات الموجودة — فقط يضيف الجديدة
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🌱 بدء إدخال البيانات التجريبية...');
  console.log('');

  // 1. إنشاء admin إن لم يوجد
  console.log('👤 التحقق من المستخدم admin...');
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: { password: 'admin123', role: 'director', name: 'المدير العام', canManageTimetable: true },
    create: { username: 'admin', password: 'admin123', name: 'المدير العام', role: 'director', canManageTimetable: true },
  });
  console.log(`   ✅ admin: ${admin.username} / ${admin.password}`);

  // إنشاء employee إن لم يوجد
  await db.user.upsert({
    where: { username: 'employee' },
    update: {},
    create: { username: 'employee', password: 'emp123', name: 'موظف التسجيل', role: 'employee', canManageTimetable: false },
  });
  console.log('   ✅ employee: employee / emp123');

  // 2. الأقسام الستة الثابتة
  console.log('\n🏫 إنشاء الأقسام...');
  const departments = [
    { name: 'اللغات', code: 'LANG', isFixed: true },
    { name: 'الدورات النسوية', code: 'WOMEN', isFixed: true },
    { name: 'الدورات التأهيلية', code: 'QUAL', isFixed: true },
    { name: 'التقني سامي', code: 'TS', isFixed: true, hasInstallments: true, installmentMonths: 30, defaultMonthlyAmount: 2500 },
    { name: 'الإعلام الآلي', code: 'INFO', isFixed: true },
    { name: 'التسيير', code: 'MGMT', isFixed: true },
  ];

  const deptMap: Record<string, string> = {};
  for (const d of departments) {
    const dept = await db.department.upsert({
      where: { name: d.name },
      update: d,
      create: d,
    });
    deptMap[d.name] = dept.id;
    console.log(`   ✅ ${dept.name} (${dept.code})`);
  }

  // 3. المستويات
  console.log('\n📊 إنشاء المستويات...');
  const levels = [
    { name: '初級 - مستوى أول', order: 1 },
    { name: 'متوسط - مستوى ثاني', order: 2 },
    { name: 'متقدم - مستوى ثالث', order: 3 },
    { name: 'تقني سامي سنة أولى', order: 4 },
    { name: 'تقني سامي سنة ثانية', order: 5 },
  ];
  for (const l of levels) {
    await db.level.upsert({ where: { name: l.name }, update: l, create: l });
  }
  console.log(`   ✅ ${levels.length} مستويات`);

  // 4. التخصصات
  console.log('\n📚 إنشاء التخصصات...');
  const specs = [
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
  for (const s of specs) {
    const deptId = deptMap[s.dept];
    if (!deptId) continue;
    const existing = await db.specialization.findFirst({ where: { name: s.name, departmentId: deptId } });
    if (!existing) {
      await db.specialization.create({ data: { name: s.name, departmentId: deptId } });
    }
  }
  console.log(`   ✅ ${specs.length} تخصصات`);

  // 5. الأساتذة
  console.log('\n👨‍🏫 إنشاء الأساتذة...');
  const teachers = [
    { name: 'أحمد بن علي', gender: 'ذكر', specialty: 'اللغة الإنجليزية', salary: 35000, dept: 'اللغات' },
    { name: 'فاطمة الزهراء', gender: 'أنثى', specialty: 'خياطة وتطريز', salary: 30000, dept: 'الدورات النسوية' },
    { name: 'محمد قاسمي', gender: 'ذكر', specialty: 'الإعلام الآلي', salary: 40000, dept: 'الإعلام الآلي' },
    { name: 'سعاد بوزيد', gender: 'أنثى', specialty: 'صيدلة', salary: 38000, dept: 'الدورات التأهيلية' },
    { name: 'يوسف حمدي', gender: 'ذكر', specialty: 'تسويق', salary: 35000, dept: 'التسيير' },
    { name: 'خالد مرابط', gender: 'ذكر', specialty: 'ديكور', salary: 32000, dept: 'الدورات النسوية' },
  ];
  const teacherMap: Record<string, string> = {};
  for (const t of teachers) {
    const deptId = deptMap[t.dept];
    const existing = await db.teacher.findFirst({ where: { name: t.name } });
    let teacher;
    if (existing) {
      teacher = existing;
    } else {
      teacher = await db.teacher.create({
        data: {
          name: t.name,
          gender: t.gender,
          specialty: t.specialty,
          salary: t.salary,
          departmentId: deptId,
          status: 'active',
          hireDate: new Date(),
        },
      });
    }
    teacherMap[t.name] = teacher.id;
    console.log(`   ✅ ${teacher.name}`);
  }

  // 6. الطلاب (18 طالب)
  console.log('\n👥 إنشاء الطلاب (18 طالب)...');
  const students = [
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
  for (const s of students) {
    const deptId = deptMap[s.dept];
    let specId: string | undefined;
    if (s.spec) {
      const spec = await db.specialization.findFirst({ where: { name: s.spec, departmentId: deptId } });
      specId = spec?.id;
    }

    let student = await db.student.findFirst({ where: { name: s.name, phone: s.phone } });
    if (!student) {
      const studentNumber = `STU-2026-${String(Object.keys(studentMap).length + 1).padStart(3, '0')}`;
      student = await db.student.create({
        data: {
          name: s.name,
          gender: s.gender,
          phone: s.phone,
          departmentId: deptId,
          specializationId: specId,
          studentNumber,
          status: 'registered',
          registrationDate: new Date(),
        },
      });
    }
    studentMap[s.name] = student.id;
  }
  console.log(`   ✅ ${students.length} طالب`);

  // 7. الدفعات (43 دفعة)
  console.log('\n💰 إنشاء الدفعات (43 دفعة)...');
  let receiptCounter = 1;
  const studentNames = Object.keys(studentMap);
  for (let i = 0; i < 43; i++) {
    const student = studentNames[i % studentNames.length];
    const studentId = studentMap[student];
    const amounts = [1500, 2000, 2500, 3000, 3500, 4000, 5000];
    const amount = amounts[i % amounts.length];
    const paymentLabels = ['تسجيل', 'قسط أول', 'قسط ثاني', 'قسط ثالث', 'قسط رابع'];
    const paymentLabel = paymentLabels[i % paymentLabels.length];

    const receiptNumber = `W-${2025 + Math.floor(receiptCounter / 1000)}-${String(receiptCounter).padStart(4, '0')}`;
    receiptCounter++;

    // تحقق إن كان الوصل موجوداً
    const existing = await db.studentPayment.findUnique({ where: { receiptNumber } });
    if (!existing) {
      await db.studentPayment.create({
        data: {
          receiptNumber,
          studentId,
          amount,
          paymentType: i === 0 ? 'registration' : 'installment',
          paymentLabel,
          paymentDate: new Date(Date.now() - i * 86400000),
          paymentMethod: 'cash',
        },
      });
    }
  }
  console.log('   ✅ 43 دفعة');

  // 8. سجلات الحضور (90 سجل)
  console.log('\n📅 إنشاء سجلات الحضور (90 سجل)...');
  const courseNames = ['اللغة الإنجليزية', 'خياطة وتطريز', 'الإعلام الآلي', 'صيدلة', 'تسويق', 'ديكور'];
  for (let i = 0; i < 90; i++) {
    const teacher = teachers[i % teachers.length];
    const teacherId = teacherMap[teacher.name];
    const student = studentNames[i % studentNames.length];
    const studentId = studentMap[student];
    const courseName = courseNames[i % courseNames.length];
    const date = new Date(Date.now() - i * 86400000);

    await db.attendance.create({
      data: {
        date,
        courseName,
        level: i % 2 === 0 ? '初級 - مستوى أول' : 'متوسط - مستوى ثاني',
        startTime: '08:00',
        endTime: '10:00',
        timeSlot: '08:00 - 10:00',
        teacherId,
        teacherName: teacher.name,
        totalCount: 8 + (i % 15),
        maleCount: 4 + (i % 7),
        femaleCount: 3 + (i % 8),
        durationMinutes: 120,
        studentId,
      },
    });
  }
  console.log('   ✅ 90 سجل حضور');

  // 9. المهام (6 مهام)
  console.log('\n📋 إنشاء المهام...');
  const tasks = [
    { title: 'تحضير امتحانات نهاية الفصل', priority: 'high', responsible: 'المدير العام' },
    { title: 'تحصيل أقساط المتأخرين', priority: 'high', responsible: 'موظف التسجيل' },
    { title: 'تحديث قاعدة بيانات الطلاب', priority: 'medium', responsible: 'موظف التسجيل' },
    { title: 'صيانة قاعة الإعلام الآلي', priority: 'low', responsible: 'المدير العام' },
    { title: 'تنظيم حفل تخرّج الدفعة', priority: 'medium', responsible: 'المدير العام' },
    { title: 'تحضير تقرير شهري للإدارة', priority: 'medium', responsible: 'المدير العام' },
  ];
  for (const t of tasks) {
    const existing = await db.task.findFirst({ where: { title: t.title } });
    if (!existing) {
      await db.task.create({
        data: {
          title: t.title,
          priority: t.priority,
          priorityLabel: t.priority === 'high' ? 'عالي' : t.priority === 'low' ? 'منخفض' : 'متوسط',
          responsible: t.responsible,
          startDate: new Date(),
          deadline: new Date(Date.now() + 7 * 86400000),
          status: 'pending',
        },
      });
    }
  }
  console.log(`   ✅ ${tasks.length} مهام`);

  // 10. مصاريف
  console.log('\n💸 إنشاء مصاريف...');
  const expenses = [
    { type: 'إيجار', amount: 25000, description: 'إيجار الشهر' },
    { type: 'كهرباء', amount: 5000, description: 'فاتورة الكهرباء' },
    { type: 'إنترنت', amount: 4000, description: 'اشتراك الإنترنت الشهري' },
    { type: 'قرطاسية', amount: 3000, description: 'مستلزمات قرطاسية' },
  ];
  for (const e of expenses) {
    await db.expense.create({
      data: {
        type: e.type,
        amount: e.amount,
        description: e.description,
        date: new Date(),
      },
    });
  }
  console.log(`   ✅ ${expenses.length} مصاريف`);

  // ملخص نهائي
  console.log('\n================================================');
  console.log('  🎉 تم إدخال البيانات بنجاح!');
  console.log('================================================\n');
  console.log('الإحصائيات:');
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
