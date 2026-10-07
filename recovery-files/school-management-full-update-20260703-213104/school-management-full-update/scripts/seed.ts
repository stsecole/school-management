/**
 * Seed script for the educational institution management system.
 * - Creates default users (director + employee)
 * - Imports data from uploaded Excel files (tasks, attendance, registrations)
 * - Adds sample data for students, teachers, departments, payments
 *
 * Usage: bun run /home/z/my-project/scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const db = new PrismaClient();

// Default credentials
const DIRECTOR_USERNAME = 'admin';
const DIRECTOR_PASSWORD = 'admin123';
const EMPLOYEE_USERNAME = 'employee';
const EMPLOYEE_PASSWORD = 'emp123';

const UPLOAD_DIR = '/home/z/my-project/upload';

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create users
  console.log('→ Creating users...');
  await db.user.upsert({
    where: { username: DIRECTOR_USERNAME },
    update: {},
    create: {
      username: DIRECTOR_USERNAME,
      password: DIRECTOR_PASSWORD,
      name: 'المدير',
      role: 'director',
    },
  });
  await db.user.upsert({
    where: { username: EMPLOYEE_USERNAME },
    update: {},
    create: {
      username: EMPLOYEE_USERNAME,
      password: EMPLOYEE_PASSWORD,
      name: 'موظف التسجيل',
      role: 'employee',
    },
  });
  console.log(`  ✓ Director: ${DIRECTOR_USERNAME} / ${DIRECTOR_PASSWORD}`);
  console.log(`  ✓ Employee: ${EMPLOYEE_USERNAME} / ${EMPLOYEE_PASSWORD}`);

  // 2. Create departments
  console.log('→ Creating departments...');
  const departments = [
    { name: 'تقني سامي', code: 'TS', description: 'تقني سامي في الصيدلة' },
    { name: 'مكتبة ومحفوظات', code: 'ARC', description: 'تسيير المكتبات والأرشيف' },
    { name: 'إدارة ومحاسبة', code: 'MGMT', description: 'التسيير الإداري والمحاسبي' },
    { name: 'إعلام آلي', code: 'IT', description: 'الإعلام الآلي والشبكات' },
  ];
  const deptRecords = [];
  for (const dept of departments) {
    const rec = await db.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    deptRecords.push(rec);
  }
  console.log(`  ✓ ${deptRecords.length} departments`);

  // 3. Create levels
  console.log('→ Creating levels...');
  const levels = [
    { name: 'السنة الأولى', order: 1 },
    { name: 'السنة الثانية', order: 2 },
    { name: 'السنة الثالثة', order: 3 },
  ];
  const levelRecords = [];
  for (const lvl of levels) {
    const rec = await db.level.upsert({
      where: { name: lvl.name },
      update: {},
      create: lvl,
    });
    levelRecords.push(rec);
  }
  console.log(`  ✓ ${levelRecords.length} levels`);

  // 4. Create teachers
  console.log('→ Creating teachers...');
  const teachersData = [
    { name: 'أ. قروي محمد', specialty: 'الصيدلة', departmentId: deptRecords[0].id, salary: 45000, phone: '0661234567', gender: 'ذكر' },
    { name: 'أ. بن علي فاطمة', specialty: 'المكتبات', departmentId: deptRecords[1].id, salary: 38000, phone: '0662345678', gender: 'أنثى' },
    { name: 'أ. زيدان أحمد', specialty: 'المحاسبة', departmentId: deptRecords[2].id, salary: 42000, phone: '0663456789', gender: 'ذكر' },
    { name: 'أ. مرزوق سعاد', specialty: 'الإعلام الآلي', departmentId: deptRecords[3].id, salary: 50000, phone: '0664567890', gender: 'أنثى' },
    { name: 'أ. بلقاسم يوسف', specialty: 'الرياضيات', departmentId: deptRecords[3].id, salary: 40000, phone: '0665678901', gender: 'ذكر' },
    { name: 'أ. حساني ليلى', specialty: 'اللغات', departmentId: deptRecords[0].id, salary: 36000, phone: '0666789012', gender: 'أنثى' },
  ];
  const teacherRecords = [];
  for (const t of teachersData) {
    const rec = await db.teacher.create({ data: t });
    teacherRecords.push(rec);
  }
  console.log(`  ✓ ${teacherRecords.length} teachers`);

  // 5. Create courses
  console.log('→ Creating courses...');
  const coursesData = [
    { name: 'دورة الصيدلة', departmentId: deptRecords[0].id, levelId: levelRecords[0].id, teacherId: teacherRecords[0].id, price: 8000, duration: 60 },
    { name: 'دورة المكتبات', departmentId: deptRecords[1].id, levelId: levelRecords[0].id, teacherId: teacherRecords[1].id, price: 6000, duration: 45 },
    { name: 'دورة المحاسبة', departmentId: deptRecords[2].id, levelId: levelRecords[1].id, teacherId: teacherRecords[2].id, price: 7000, duration: 50 },
    { name: 'دورة الإعلام الآلي', departmentId: deptRecords[3].id, levelId: levelRecords[0].id, teacherId: teacherRecords[3].id, price: 9000, duration: 70 },
    { name: 'دورة الرياضيات', departmentId: deptRecords[3].id, levelId: levelRecords[1].id, teacherId: teacherRecords[4].id, price: 5000, duration: 40 },
    { name: 'دورة اللغات', departmentId: deptRecords[0].id, levelId: levelRecords[2].id, teacherId: teacherRecords[5].id, price: 4000, duration: 30 },
  ];
  const courseRecords = [];
  for (const c of coursesData) {
    const rec = await db.course.create({ data: c });
    courseRecords.push(rec);
  }
  console.log(`  ✓ ${courseRecords.length} courses`);

  // 6. Create sample students
  console.log('→ Creating students...');
  const studentsData = [
    { name: 'أحمد بن محمد', gender: 'ذكر', phone: '0770112233', departmentId: deptRecords[0].id, levelId: levelRecords[0].id, specialty: 'صيدلة', section: 'أ' },
    { name: 'فاطمة الزهراء', gender: 'أنثى', phone: '0770223344', departmentId: deptRecords[0].id, levelId: levelRecords[0].id, specialty: 'صيدلة', section: 'أ' },
    { name: 'يوسف العياشي', gender: 'ذكر', phone: '0770334455', departmentId: deptRecords[1].id, levelId: levelRecords[1].id, specialty: 'مكتبات', section: 'ب' },
    { name: 'مريم بوزيد', gender: 'أنثى', phone: '0770445566', departmentId: deptRecords[2].id, levelId: levelRecords[1].id, specialty: 'محاسبة', section: 'أ' },
    { name: 'خالد حمدي', gender: 'ذكر', phone: '0770556677', departmentId: deptRecords[3].id, levelId: levelRecords[0].id, specialty: 'إعلام آلي', section: 'ج' },
    { name: 'سارة بن عيسى', gender: 'أنثى', phone: '0770667788', departmentId: deptRecords[3].id, levelId: levelRecords[0].id, specialty: 'إعلام آلي', section: 'ج' },
    { name: 'عبد الله قاسمي', gender: 'ذكر', phone: '0770778899', departmentId: deptRecords[0].id, levelId: levelRecords[2].id, specialty: 'صيدلة', section: 'ب' },
    { name: 'نسرين مرابط', gender: 'أنثى', phone: '0770889900', departmentId: deptRecords[1].id, levelId: levelRecords[0].id, specialty: 'مكتبات', section: 'أ' },
    { name: 'إسلام بوعلام', gender: 'ذكر', phone: '0770990011', departmentId: deptRecords[2].id, levelId: levelRecords[2].id, specialty: 'محاسبة', section: 'ب' },
    { name: 'هاجر سلطاني', gender: 'أنثى', phone: '0770102233', departmentId: deptRecords[3].id, levelId: levelRecords[1].id, specialty: 'إعلام آلي', section: 'أ' },
    { name: 'محمد أمين شريف', gender: 'ذكر', phone: '0770203344', departmentId: deptRecords[0].id, levelId: levelRecords[1].id, specialty: 'صيدلة', section: 'أ' },
    { name: 'ليلى بن يحيى', gender: 'أنثى', phone: '0770304455', departmentId: deptRecords[2].id, levelId: levelRecords[0].id, specialty: 'محاسبة', section: 'ج' },
  ];
  const studentRecords = [];
  for (let i = 0; i < studentsData.length; i++) {
    const s = studentsData[i];
    const rec = await db.student.create({
      data: {
        ...s,
        studentNumber: `STU-2024-${String(i + 1).padStart(3, '0')}`,
        registrationDate: new Date(2024, 1, 5 + i),
        status: 'active',
      },
    });
    studentRecords.push(rec);
  }
  console.log(`  ✓ ${studentRecords.length} students`);

  // 7. Import tasks from Excel file
  console.log('→ Importing tasks from Excel...');
  const tasksFile = path.join(UPLOAD_DIR, 'متابعة المهام.xlsx');
  if (fs.existsSync(tasksFile)) {
    try {
      const wb = xlsx.readFile(tasksFile);
      const sheet = wb.Sheets['ActionItems'];
      if (sheet) {
        const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1, range: 4 });
        let imported = 0;
        for (const row of rows) {
          const title = row[1];
          if (!title || typeof title !== 'string' || title.trim() === '') continue;
          // Skip rows that look like headers
          if (title === 'المهام' || title === 'Task') continue;
          const priorityLabel = String(row[2] || 'متوسط');
          const priorityMap: Record<string, string> = { 'عالي': 'high', 'متوسط': 'medium', 'منخفض': 'low' };
          const priority = priorityMap[priorityLabel] || 'medium';
          const responsible = row[3] ? String(row[3]) : null;
          const startDate = row[4] ? new Date(row[4]) : null;
          const deadline = row[5] ? new Date(row[5]) : null;
          const completedStr = row[6] ? String(row[6]) : '';
          const completed = completedStr.includes('√') || completedStr === 'true';
          const statusValue = row[7] ? Number(row[7]) || 0 : 0;
          const notes = row[8] ? String(row[8]) : null;

          await db.task.create({
            data: {
              title,
              priority,
              priorityLabel,
              responsible,
              startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
              deadline: deadline && !isNaN(deadline.getTime()) ? deadline : null,
              completed,
              status: completed ? 'done' : 'pending',
              statusValue,
              notes,
            },
          });
          imported++;
        }
        console.log(`  ✓ Imported ${imported} tasks from Excel`);
      }
    } catch (e) {
      console.log(`  ⚠ Could not import tasks: ${(e as Error).message}`);
    }
  }

  // Add some sample tasks if no tasks were imported
  const taskCount = await db.task.count();
  if (taskCount === 0) {
    console.log('→ Adding sample tasks...');
    const sampleTasks = [
      { title: 'مكالمة المسجلين في دورة الصيدلة', priority: 'high', priorityLabel: 'عالي', responsible: 'قروي', startDate: new Date(2025, 0, 2), deadline: new Date(2025, 0, 3), completed: true, status: 'done', statusValue: 1, notes: '' },
      { title: 'تحضير قوائم الحضور لشهر فيفري', priority: 'medium', priorityLabel: 'متوسط', responsible: 'سامي', startDate: new Date(2025, 1, 1), deadline: new Date(2025, 1, 5), completed: false, status: 'in_progress', statusValue: 0, notes: 'يجب الانتهاء قبل بداية الشهر' },
      { title: 'تحصيل أقساط الطلاب المتأخرين', priority: 'high', priorityLabel: 'عالي', responsible: 'المدير', startDate: new Date(2025, 1, 10), deadline: new Date(2025, 1, 20), completed: false, status: 'pending', statusValue: 0, notes: '' },
      { title: 'تنظيم اجتماع مع الأساتذة', priority: 'medium', priorityLabel: 'متوسط', responsible: 'المدير', startDate: new Date(2025, 1, 15), deadline: new Date(2025, 1, 17), completed: false, status: 'pending', statusValue: 0, notes: 'مناقشة نتائج التلميذ' },
      { title: 'تحديث قاعدة بيانات الطلاب', priority: 'low', priorityLabel: 'منخفض', responsible: 'سامي', startDate: new Date(2025, 1, 18), deadline: new Date(2025, 1, 25), completed: false, status: 'pending', statusValue: 0, notes: '' },
      { title: 'إعداد تقرير المداخيل الشهرية', priority: 'high', priorityLabel: 'عالي', responsible: 'المدير', startDate: new Date(2025, 1, 26), deadline: new Date(2025, 1, 28), completed: false, status: 'pending', statusValue: 0, notes: 'تقرير فيفري 2025' },
    ];
    for (const t of sampleTasks) {
      await db.task.create({ data: t });
    }
    console.log(`  ✓ Added ${sampleTasks.length} sample tasks`);
  }

  // 8. Import registrations from Excel file
  console.log('→ Importing registrations from Excel...');
  const regFile = path.join(UPLOAD_DIR, 'تسجيلات-تقني-سامي-فيفري-2023.xlsx');
  if (fs.existsSync(regFile)) {
    try {
      const wb = xlsx.readFile(regFile);
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (sheet) {
        const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1 });
        let imported = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const dateRaw = row[0];
          const name = row[1] ? String(row[1]).trim() : '';
          if (!name) continue;
          const specialty = row[2] ? String(row[2]) : null;
          const level = row[3] ? String(row[3]) : null;
          const number = row[4] ? String(row[4]) : null;
          const note = row[5] ? String(row[5]) : null;
          const date = dateRaw ? new Date(dateRaw) : new Date();

          // Find or create student
          let student = await db.student.findFirst({ where: { name } });
          if (!student) {
            student = await db.student.create({
              data: {
                name,
                specialty,
                studentNumber: number,
                registrationDate: date && !isNaN(date.getTime()) ? date : new Date(),
                status: 'active',
              },
            });
          }
          await db.registration.create({
            data: {
              studentId: student.id,
              courseName: specialty || 'تسجيل عام',
              level,
              specialty,
              date: date && !isNaN(date.getTime()) ? date : new Date(),
              note,
            },
          });
          imported++;
        }
        console.log(`  ✓ Imported ${imported} registrations from Excel`);
      }
    } catch (e) {
      console.log(`  ⚠ Could not import registrations: ${(e as Error).message}`);
    }
  }

  // Add sample registrations for our demo students
  const regCount = await db.registration.count();
  if (regCount === 0) {
    console.log('→ Adding sample registrations...');
    for (let i = 0; i < studentRecords.length; i++) {
      const student = studentRecords[i];
      const course = courseRecords[i % courseRecords.length];
      await db.registration.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          courseName: course.name,
          level: levelRecords[i % levelRecords.length].name,
          specialty: student.specialty,
          date: new Date(2024, 1, 5 + i),
          note: 'تسجيل عادي',
        },
      });
    }
    console.log(`  ✓ Added ${studentRecords.length} sample registrations`);
  }

  // 9. Create sample attendance records
  console.log('→ Creating sample attendance records...');
  const attendanceCount = await db.attendance.count();
  if (attendanceCount === 0) {
    const attendanceData = [];
    for (let day = 1; day <= 15; day++) {
      for (let cIdx = 0; cIdx < courseRecords.length; cIdx++) {
        const course = courseRecords[cIdx];
        const teacher = teacherRecords[cIdx % teacherRecords.length];
        const totalCount = 8 + Math.floor(Math.random() * 15);
        const maleCount = Math.floor(totalCount * 0.5);
        const femaleCount = totalCount - maleCount;
        // Use proper HH:MM time format with computed duration
        const startHour = 8 + (cIdx % 4);
        const endHour = startHour + 2;
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(endHour).padStart(2, '0')}:00`;
        const durationMinutes = (endHour - startHour) * 60;
        attendanceData.push({
          date: new Date(2025, 1, day),
          courseId: course.id,
          courseName: course.name,
          level: levelRecords[day % levelRecords.length].name,
          startTime,
          endTime,
          timeSlot: `${startTime} - ${endTime}`,
          teacherId: teacher.id,
          teacherName: teacher.name,
          totalCount,
          maleCount,
          femaleCount,
          durationMinutes,
          unpaidCount: Math.floor(Math.random() * 3),
          notes: '',
        });
      }
    }
    await db.attendance.createMany({ data: attendanceData });
    console.log(`  ✓ Added ${attendanceData.length} attendance records`);
  }

  // 10. Create sample student payments
  console.log('→ Creating sample student payments...');
  const paymentCount = await db.studentPayment.count();
  if (paymentCount === 0) {
    let receiptCounter = 1000;
    const paymentLabels = ['تسجيل', 'قسط أول', 'قسط ثاني', 'قسط ثالث'];
    const paymentTypes = ['registration', 'installment', 'installment', 'installment'];
    for (const student of studentRecords) {
      const course = courseRecords.find(c => c.departmentId === student.departmentId) || courseRecords[0];
      // Each student pays registration + 2 installments
      for (let p = 0; p < 3; p++) {
        const amount = p === 0 ? course.price * 0.3 : course.price * 0.35;
        const date = new Date(2024, 1 + p, 10);
        await db.studentPayment.create({
          data: {
            receiptNumber: `W-${++receiptCounter}`,
            studentId: student.id,
            amount,
            paymentType: paymentTypes[p],
            paymentLabel: paymentLabels[p],
            paymentDate: date,
            paymentMethod: 'cash',
            notes: '',
          },
        });
      }
    }
    console.log(`  ✓ Added ${receiptCounter - 1000} student payments`);
  }

  // 11. Create sample teacher payments (salaries)
  console.log('→ Creating teacher payments...');
  const teacherPaymentCount = await db.teacherPayment.count();
  if (teacherPaymentCount === 0) {
    let receiptCounter = 5000;
    for (const teacher of teacherRecords) {
      // Pay salary for January and February
      for (const month of ['2025-01', '2025-02']) {
        await db.teacherPayment.create({
          data: {
            receiptNumber: `TS-${++receiptCounter}`,
            teacherId: teacher.id,
            amount: teacher.salary,
            month,
            paymentDate: new Date(month + '-28'),
            paymentType: 'salary',
            paymentLabel: 'راتب',
            notes: `راتب شهر ${month}`,
          },
        });
      }
    }
    console.log(`  ✓ Added ${receiptCounter - 5000} teacher payments`);
  }

  // 12. Set default settings
  console.log('→ Setting system defaults...');
  await db.setting.upsert({
    where: { key: 'finance_password' },
    update: {},
    create: { key: 'finance_password', value: 'admin123' },
  });
  await db.setting.upsert({
    where: { key: 'school_name' },
    update: {},
    create: { key: 'school_name', value: 'مدرسة السلامة' },
  });
  await db.setting.upsert({
    where: { key: 'receipt_counter' },
    update: {},
    create: { key: 'receipt_counter', value: '2000' },
  });

  // Final summary
  const counts = {
    users: await db.user.count(),
    departments: await db.department.count(),
    levels: await db.level.count(),
    teachers: await db.teacher.count(),
    courses: await db.course.count(),
    students: await db.student.count(),
    registrations: await db.registration.count(),
    attendances: await db.attendance.count(),
    tasks: await db.task.count(),
    studentPayments: await db.studentPayment.count(),
    teacherPayments: await db.teacherPayment.count(),
  };
  console.log('\n✅ Seed completed successfully!');
  console.log('Summary:', counts);
  console.log('\n🔐 Login credentials:');
  console.log(`   Director: ${DIRECTOR_USERNAME} / ${DIRECTOR_PASSWORD}`);
  console.log(`   Employee: ${EMPLOYEE_USERNAME} / ${EMPLOYEE_PASSWORD}`);
  console.log(`   Finance password: admin123`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
