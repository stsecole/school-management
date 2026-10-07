/**
 * Seed timetable sample data: rooms, groups, subjects, holidays, work settings, sessions
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding timetable data...');

  // Rooms
  const rooms = [
    { name: 'قاعة 1', code: 'R1', capacity: 30, type: 'classroom', building: 'المبنى الرئيسي', floor: 'الأرضي' },
    { name: 'قاعة 2', code: 'R2', capacity: 30, type: 'classroom', building: 'المبنى الرئيسي', floor: 'الأرضي' },
    { name: 'قاعة 3', code: 'R3', capacity: 40, type: 'classroom', building: 'المبنى الرئيسي', floor: 'الأول' },
    { name: 'مخبر الإعلام الآلي', code: 'LAB1', capacity: 25, type: 'computer_lab', building: 'المبنى الملحق', floor: 'الأول' },
    { name: 'مخبر العلوم', code: 'LAB2', capacity: 20, type: 'lab', building: 'المبنى الملحق', floor: 'الأرضي' },
    { name: 'المدرج الكبير', code: 'AMP1', capacity: 100, type: 'amphitheater', building: 'المبنى الرئيسي', floor: 'الأرضي' },
  ];
  for (const r of rooms) {
    await db.room.upsert({ where: { name: r.name }, update: {}, create: r });
  }
  console.log(`  ✓ ${rooms.length} rooms`);

  // Groups
  const tsDept = await db.department.findUnique({ where: { name: 'التقني سامي' } });
  const langDept = await db.department.findUnique({ where: { name: 'اللغات' } });
  const pharmaSpec = await db.specialization.findFirst({ where: { name: 'صيدلة' } });
  const englishSpec = await db.specialization.findFirst({ where: { name: 'اللغة الإنجليزية' } });

  const groups = [
    { name: 'فوج صيدلة 1', code: 'G1', departmentId: tsDept?.id, specializationId: pharmaSpec?.id, level: 'السنة الأولى', studentCount: 25 },
    { name: 'فوج صيدلة 2', code: 'G2', departmentId: tsDept?.id, specializationId: pharmaSpec?.id, level: 'السنة الأولى', studentCount: 28 },
    { name: 'فوج إنجليزي 1', code: 'G3', departmentId: langDept?.id, specializationId: englishSpec?.id, level: 'مستوى A', studentCount: 20 },
  ];
  for (const g of groups) {
    const existing = await db.group.findUnique({ where: { name: g.name } });
    if (!existing) await db.group.create({ data: g });
  }
  console.log(`  ✓ ${groups.length} groups`);

  // Subjects
  const teachers = await db.teacher.findMany();
  const subjects = [
    { name: 'الكيمياء العضوية', code: 'CHM101', departmentId: tsDept?.id, specializationId: pharmaSpec?.id, weeklyHours: 6, requiredRoomType: 'lab', color: '#3b82f6', teacherId: teachers[0]?.id },
    { name: 'علم الأدوية', code: 'PHM101', departmentId: tsDept?.id, specializationId: pharmaSpec?.id, weeklyHours: 4, requiredRoomType: null, color: '#10b981', teacherId: teachers[1]?.id },
    { name: 'الإعلام الآلي', code: 'INF101', departmentId: tsDept?.id, weeklyHours: 4, requiredRoomType: 'computer_lab', color: '#f59e0b', teacherId: teachers[3]?.id },
    { name: 'اللغة الإنجليزية', code: 'ENG101', departmentId: langDept?.id, weeklyHours: 6, requiredRoomType: null, color: '#8b5cf6', teacherId: teachers[5]?.id },
    { name: 'الرياضيات', code: 'MATH101', departmentId: tsDept?.id, weeklyHours: 4, requiredRoomType: null, color: '#ef4444', teacherId: teachers[4]?.id },
  ];
  for (const s of subjects) {
    const existing = await db.subject.findUnique({ where: { name: s.name } });
    if (!existing) await db.subject.create({ data: s as any });
  }
  console.log(`  ✓ ${subjects.length} subjects`);

  // Work settings (if not exists)
  const existingSettings = await db.workSettings.findFirst();
  if (!existingSettings) {
    await db.workSettings.create({ data: {} });
    console.log('  ✓ Work settings created');
  }

  // Holidays
  const holidays = [
    { name: 'عطلة منتصف الفصل', startDate: new Date(2025, 2, 1), endDate: new Date(2025, 2, 7), type: 'holiday' },
    { name: 'عطلة عيد الفطر', startDate: new Date(2025, 2, 30), endDate: new Date(2025, 3, 2), type: 'holiday' },
  ];
  for (const h of holidays) {
    const existing = await db.holiday.findFirst({ where: { name: h.name } });
    if (!existing) await db.holiday.create({ data: h });
  }
  console.log(`  ✓ ${holidays.length} holidays`);

  // Sample sessions
  const sessionCount = await db.timetableSession.count();
  if (sessionCount === 0) {
    const room1 = await db.room.findUnique({ where: { name: 'قاعة 1' } });
    const room2 = await db.room.findUnique({ where: { name: 'قاعة 2' } });
    const lab1 = await db.room.findUnique({ where: { name: 'مخبر الإعلام الآلي' } });
    const lab2 = await db.room.findUnique({ where: { name: 'مخبر العلوم' } });
    const g1 = await db.group.findUnique({ where: { name: 'فوج صيدلة 1' } });
    const g2 = await db.group.findUnique({ where: { name: 'فوج صيدلة 2' } });
    const g3 = await db.group.findUnique({ where: { name: 'فوج إنجليزي 1' } });
    const sub1 = await db.subject.findUnique({ where: { name: 'الكيمياء العضوية' } });
    const sub2 = await db.subject.findUnique({ where: { name: 'علم الأدوية' } });
    const sub3 = await db.subject.findUnique({ where: { name: 'الإعلام الآلي' } });
    const sub4 = await db.subject.findUnique({ where: { name: 'اللغة الإنجليزية' } });

    const sessions = [
      // Sunday - day 0
      { dayOfWeek: 0, startTime: '08:00', endTime: '10:00', teacherId: teachers[0]?.id, teacherName: teachers[0]?.name, roomId: lab2?.id, roomName: lab2?.name, groupId: g1?.id, groupName: g1?.name, subjectId: sub1?.id, subjectName: sub1?.name, color: sub1?.color },
      { dayOfWeek: 0, startTime: '10:00', endTime: '12:00', teacherId: teachers[1]?.id, teacherName: teachers[1]?.name, roomId: room1?.id, roomName: room1?.name, groupId: g1?.id, groupName: g1?.name, subjectId: sub2?.id, subjectName: sub2?.name, color: sub2?.color },
      { dayOfWeek: 0, startTime: '13:00', endTime: '15:00', teacherId: teachers[3]?.id, teacherName: teachers[3]?.name, roomId: lab1?.id, roomName: lab1?.name, groupId: g2?.id, groupName: g2?.name, subjectId: sub3?.id, subjectName: sub3?.name, color: sub3?.color },
      // Monday - day 1
      { dayOfWeek: 1, startTime: '08:00', endTime: '10:00', teacherId: teachers[5]?.id, teacherName: teachers[5]?.name, roomId: room2?.id, roomName: room2?.name, groupId: g3?.id, groupName: g3?.name, subjectId: sub4?.id, subjectName: sub4?.name, color: sub4?.color },
      { dayOfWeek: 1, startTime: '10:00', endTime: '12:00', teacherId: teachers[0]?.id, teacherName: teachers[0]?.name, roomId: lab2?.id, roomName: lab2?.name, groupId: g2?.id, groupName: g2?.name, subjectId: sub1?.id, subjectName: sub1?.name, color: sub1?.color },
      // Tuesday - day 2
      { dayOfWeek: 2, startTime: '08:00', endTime: '10:00', teacherId: teachers[1]?.id, teacherName: teachers[1]?.name, roomId: room1?.id, roomName: room1?.name, groupId: g2?.id, groupName: g2?.name, subjectId: sub2?.id, subjectName: sub2?.name, color: sub2?.color },
      { dayOfWeek: 2, startTime: '13:00', endTime: '15:00', teacherId: teachers[3]?.id, teacherName: teachers[3]?.name, roomId: lab1?.id, roomName: lab1?.name, groupId: g1?.id, groupName: g1?.name, subjectId: sub3?.id, subjectName: sub3?.name, color: sub3?.color },
      // Wednesday - day 3
      { dayOfWeek: 3, startTime: '10:00', endTime: '12:00', teacherId: teachers[5]?.id, teacherName: teachers[5]?.name, roomId: room2?.id, roomName: room2?.name, groupId: g3?.id, groupName: g3?.name, subjectId: sub4?.id, subjectName: sub4?.name, color: sub4?.color },
      // Thursday - day 4
      { dayOfWeek: 4, startTime: '08:00', endTime: '10:00', teacherId: teachers[0]?.id, teacherName: teachers[0]?.name, roomId: lab2?.id, roomName: lab2?.name, groupId: g1?.id, groupName: g1?.name, subjectId: sub1?.id, subjectName: sub1?.name, color: sub1?.color },
    ];

    for (const s of sessions) {
      if (s.teacherId && s.roomId && s.groupId && s.subjectId) {
        await db.timetableSession.create({ data: s as any });
      }
    }
    console.log(`  ✓ ${sessions.length} sample sessions`);
  }

  await db.$disconnect();
  console.log('✅ Done!');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
