import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * POST /api/branches/import?id=xxx
 * Body: multipart/form-data with `file` field (xlsx file)
 *
 * Imports data from an Excel workbook into a specific branch.
 * Expected sheets (optional, only present sheets are imported):
 *   - "الطلاب"        → students (creates new students with branchId)
 *   - "الأساتذة"      → teachers (creates new teachers with branchId)
 *   - "المصاريف"      → expenses
 *   - "المهام"        → tasks
 *
 * Notes:
 *   - Students/teachers are MATCHED by name — if a student with the same name
 *     already exists in this branch, it is skipped (no duplicates).
 *   - Payments are NOT imported (to avoid duplicate receipt numbers).
 *   - The branch info sheet is ignored.
 *
 * Director-only access.
 */
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Branch ID required (?id=xxx)' }, { status: 400 });
    }

    const branch = await db.branch.findUnique({ where: { id } });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'File must be an Excel file (.xlsx or .xls)' }, { status: 400 });
    }

    // Parse the Excel file
    const bytes = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(bytes), { type: 'array' });

    const stats = {
      studentsImported: 0,
      studentsSkipped: 0,
      teachersImported: 0,
      teachersSkipped: 0,
      expensesImported: 0,
      tasksImported: 0,
      sheetsProcessed: [] as string[],
    };

    // Pre-fetch departments and levels for matching by name
    const departments = await db.department.findMany();
    const levels = await db.level.findMany();
    const specializations = await db.specialization.findMany();

    // ===== Sheet 1: Students (الطلاب) =====
    if (wb.SheetNames.includes('الطلاب')) {
      stats.sheetsProcessed.push('الطلاب');
      const ws = wb.Sheets['الطلاب'];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (const row of rows) {
        const name = (row['الاسم'] || '').toString().trim();
        if (!name) continue;

        // Check if student with same name exists in this branch
        const existing = await db.student.findFirst({
          where: { name, branchId: id },
        });
        if (existing) {
          stats.studentsSkipped++;
          continue;
        }

        // Match department, level, specialization by name
        const deptName = (row['القسم'] || '').toString().trim();
        const levelName = (row['المستوى'] || '').toString().trim();
        const specName = (row['التخصص'] || '').toString().trim();

        const department = departments.find(d => d.name === deptName);
        const level = levels.find(l => l.name === levelName);
        const specialization = specializations.find(s => s.name === specName);

        try {
          await db.student.create({
            data: {
              studentNumber: (row['رقم الطالب'] || '').toString().trim() || null,
              name,
              email: (row['البريد'] || '').toString().trim() || null,
              phone: (row['الهاتف'] || '').toString().trim() || null,
              gender: (row['الجنس'] || '').toString().trim() || null,
              birthDate: row['تاريخ الميلاد'] ? new Date(row['تاريخ الميلاد']) : null,
              address: (row['العنوان'] || '').toString().trim() || null,
              departmentId: department?.id || null,
              levelId: level?.id || null,
              specializationId: specialization?.id || null,
              status: (row['الحالة'] || '').toString().trim() || 'registered',
              registrationDate: row['تاريخ التسجيل'] ? new Date(row['تاريخ التسجيل']) : new Date(),
              totalAmount: parseFloat(row['المبلغ الإجمالي']) || null,
              initialPayment: parseFloat(row['الدفعة الأولية']) || 0,
              branchId: id,
            },
          });
          stats.studentsImported++;
        } catch (e) {
          // Skip on individual row errors
          stats.studentsSkipped++;
        }
      }
    }

    // ===== Sheet 2: Teachers (الأساتذة) =====
    if (wb.SheetNames.includes('الأساتذة')) {
      stats.sheetsProcessed.push('الأساتذة');
      const ws = wb.Sheets['الأساتذة'];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (const row of rows) {
        const name = (row['الاسم'] || '').toString().trim();
        if (!name) continue;

        // Check if teacher with same name exists in this branch
        const existing = await db.teacher.findFirst({
          where: { name, branchId: id },
        });
        if (existing) {
          stats.teachersSkipped++;
          continue;
        }

        const deptName = (row['القسم'] || '').toString().trim();
        const department = departments.find(d => d.name === deptName);

        try {
          await db.teacher.create({
            data: {
              name,
              email: (row['البريد'] || '').toString().trim() || null,
              phone: (row['الهاتف'] || '').toString().trim() || null,
              gender: (row['الجنس'] || '').toString().trim() || null,
              specialty: (row['التخصص'] || '').toString().trim() || null,
              departmentId: department?.id || null,
              salary: parseFloat(row['الراتب']) || 0,
              hireDate: row['تاريخ التوظيف'] ? new Date(row['تاريخ التوظيف']) : null,
              status: (row['الحالة'] || '').toString().trim() || 'active',
              branchId: id,
            },
          });
          stats.teachersImported++;
        } catch (e) {
          stats.teachersSkipped++;
        }
      }
    }

    // ===== Sheet 3: Expenses (المصاريف) =====
    if (wb.SheetNames.includes('المصاريف')) {
      stats.sheetsProcessed.push('المصاريف');
      const ws = wb.Sheets['المصاريف'];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (const row of rows) {
        const type = (row['النوع'] || '').toString().trim();
        const amount = parseFloat(row['المبلغ']);
        if (!type || !amount) continue;

        try {
          await db.expense.create({
            data: {
              date: row['التاريخ'] ? new Date(row['التاريخ']) : new Date(),
              type,
              description: (row['الوصف'] || '').toString().trim() || null,
              amount,
              branchId: id,
            },
          });
          stats.expensesImported++;
        } catch (e) {
          // Skip on individual row errors
        }
      }
    }

    // ===== Sheet 4: Tasks (المهام) =====
    if (wb.SheetNames.includes('المهام')) {
      stats.sheetsProcessed.push('المهام');
      const ws = wb.Sheets['المهام'];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const priorityMap: Record<string, string> = {
        'عالي': 'high', 'متوسط': 'medium', 'منخفض': 'low',
      };

      for (const row of rows) {
        const title = (row['العنوان'] || '').toString().trim();
        if (!title) continue;

        const priorityLabel = (row['الأولوية'] || '').toString().trim();
        const priority = priorityMap[priorityLabel] || 'medium';

        try {
          await db.task.create({
            data: {
              title,
              priority,
              priorityLabel,
              responsible: (row['المسؤول'] || '').toString().trim() || null,
              startDate: row['تاريخ البداية'] ? new Date(row['تاريخ البداية']) : null,
              deadline: row['الأجل'] ? new Date(row['الأجل']) : null,
              completed: row['مكتملة'] === 'نعم' || row['مكتملة'] === true,
              status: (row['الحالة'] || '').toString().trim() || 'pending',
              notes: (row['ملاحظات'] || '').toString().trim() || null,
              branchId: id,
            },
          });
          stats.tasksImported++;
        } catch (e) {
          // Skip on individual row errors
        }
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      branch: branch.name,
      stats,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('POST /api/branches/import error:', error);
    return NextResponse.json(
      { error: 'Server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
