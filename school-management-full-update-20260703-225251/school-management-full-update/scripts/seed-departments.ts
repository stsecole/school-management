/**
 * Seed the 6 fixed departments and sample specializations.
 * Also migrate existing students to new status values.
 */

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const FIXED_DEPARTMENTS = [
  {
    name: 'التقني سامي',
    code: 'TS',
    description: 'تقني سامي - 30 شهر مع أقساط شهرية',
    isFixed: true,
    hasInstallments: true,
    installmentMonths: 30,
    defaultMonthlyAmount: 3000,
    specializations: ['صيدلة', 'مكتبة ومحفوظات', 'إدارة ومحاسبة', 'إعلام آلي', 'تسويق', 'موارد بشرية'],
  },
  {
    name: 'اللغات',
    code: 'LANG',
    description: 'دورات اللغات المختلفة',
    isFixed: true,
    hasInstallments: false,
    specializations: ['اللغة الإنجليزية', 'اللغة الفرنسية', 'اللغة الألمانية', 'اللغة الإسبانية', 'اللغة الإيطالية'],
  },
  {
    name: 'الدعم المدرسي',
    code: 'SUP',
    description: 'دعم مدرسي لكل المستويات',
    isFixed: true,
    hasInstallments: false,
    specializations: ['الابتدائي', 'المتوسط', 'الثانوي', 'البكالوريا'],
  },
  {
    name: 'الدورات النسوية',
    code: 'WOM',
    description: 'دورات مهنية نسوية',
    isFixed: true,
    hasInstallments: false,
    specializations: ['خياطة وتطريز', 'حلاقة نسائية', 'تجميل', 'طبخ وحلويات', 'ديكور'],
  },
  {
    name: 'الدورات التأهيلية',
    code: 'QUAL',
    description: 'دورات تأهيلية مهنية',
    isFixed: true,
    hasInstallments: false,
    specializations: ['صيانة الهواتف', 'صيانة الحاسوب', 'كهرباء', 'سباكة', 'نجارة', 'لحام'],
  },
  {
    name: 'دورات الأطفال',
    code: 'KID',
    description: 'دورات تعليمية للأطفال',
    isFixed: true,
    hasInstallments: false,
    specializations: ['تحفيظ القرآن', 'اللغة الإنجليزية للأطفال', 'الرسم', 'الروبوتيك', 'تنمية المهارات'],
  },
];

async function main() {
  console.log('🌱 Seeding fixed departments and specializations...');

  for (const dept of FIXED_DEPARTMENTS) {
    const { specializations, ...deptData } = dept;
    const existing = await db.department.findUnique({ where: { name: dept.name } });
    if (existing) {
      // Update existing department with new fields
      await db.department.update({
        where: { id: existing.id },
        data: {
          code: deptData.code,
          description: deptData.description,
          isFixed: true,
          hasInstallments: deptData.hasInstallments || false,
          installmentMonths: deptData.installmentMonths || null,
          defaultMonthlyAmount: deptData.defaultMonthlyAmount || null,
        },
      });
      console.log(`  ✓ Updated department: ${dept.name}`);
    } else {
      const created = await db.department.create({ data: { ...deptData, isFixed: true } });
      console.log(`  ✓ Created department: ${dept.name}`);
    }

    // Add specializations
    const deptRecord = await db.department.findUnique({ where: { name: dept.name } });
    if (deptRecord) {
      for (const specName of specializations) {
        const existingSpec = await db.specialization.findFirst({
          where: { name: specName, departmentId: deptRecord.id },
        });
        if (!existingSpec) {
          await db.specialization.create({
            data: { name: specName, departmentId: deptRecord.id },
          });
        }
      }
      console.log(`    → ${specializations.length} specializations for ${dept.name}`);
    }
  }

  // Remove old departments that are not in the fixed list (only non-fixed ones)
  const fixedNames = FIXED_DEPARTMENTS.map(d => d.name);
  const oldDepts = await db.department.findMany({
    where: { name: { notIn: fixedNames } },
  });
  for (const old of oldDepts) {
    // Unlink students/teachers/courses first
    await db.student.updateMany({ where: { departmentId: old.id }, data: { departmentId: null } });
    await db.teacher.updateMany({ where: { departmentId: old.id }, data: { departmentId: null } });
    await db.course.updateMany({ where: { departmentId: old.id }, data: { departmentId: null } });
    await db.department.delete({ where: { id: old.id } });
    console.log(`  ✗ Removed old department: ${old.name}`);
  }

  // Migrate existing student statuses
  const statusMap: Record<string, string> = {
    'active': 'continuing',
    'inactive': 'abandoned',
    'graduated': 'graduated',
  };
  const students = await db.student.findMany();
  for (const s of students) {
    const newStatus = statusMap[s.status] || 'registered';
    if (newStatus !== s.status) {
      await db.student.update({ where: { id: s.id }, data: { status: newStatus } });
    }
  }
  console.log(`  ✓ Migrated ${students.length} student statuses`);

  // Summary
  const deptCount = await db.department.count();
  const specCount = await db.specialization.count();
  console.log(`\n✅ Done! ${deptCount} departments, ${specCount} specializations`);

  await db.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
