// ===== GET/POST /api/job-applications =====
// API متكيّف - يدعم عدة صيغ لـ schema:
// - الصيغة 1: fullName (حقل واحد)
// - الصيغة 2: firstName + lastName (حقلين منفصلين)
// ينشئ الجدول تلقائياً أو يضيف الأعمدة الناقصة

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// اكتشاف الأعمدة الموجودة في الجدول
async function getTableColumns(): Promise<string[]> {
  try {
    const columns = await db.$queryRaw`
      PRAGMA table_info("JobApplication")
    ` as any[];
    return columns.map((c: any) => c.name);
  } catch {
    return [];
  }
}

// التحقق من وجود الجدول
async function tableExists(): Promise<boolean> {
  try {
    const result = await db.$queryRaw`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='JobApplication'
    ` as any[];
    return result.length > 0;
  } catch {
    return false;
  }
}

// دالة لإنشاء جدول JobApplication إذا لم يكن موجوداً
async function ensureJobApplicationTable(): Promise<boolean> {
  try {
    const exists = await tableExists();

    if (!exists) {
      // الجدول غير موجود - أنشئه (بصيغة firstName + lastName)
      console.log('Creating JobApplication table...');
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "JobApplication" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "firstName" TEXT NOT NULL DEFAULT "",
          "lastName" TEXT NOT NULL DEFAULT "",
          "birthDate" DATETIME,
          "phone" TEXT,
          "email" TEXT,
          "address" TEXT,
          "diploma" TEXT,
          "experience" TEXT,
          "schedule" TEXT NOT NULL DEFAULT 'full-time',
          "cvUrl" TEXT,
          "diplomaUrl" TEXT,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "note" TEXT,
          "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        )
      `;
      console.log('JobApplication table created successfully');
    } else {
      // الجدول موجود - تحقق من الأعمدة وأضف الناقصة
      console.log('JobApplication table exists, checking columns...');
      const existingColumns = await getTableColumns();
      console.log('Existing columns:', existingColumns);

      // قائمة محتملة من الأعمدة
      const possibleColumns = [
        { name: 'firstName', type: 'TEXT NOT NULL DEFAULT ""' },
        { name: 'lastName', type: 'TEXT NOT NULL DEFAULT ""' },
        { name: 'fullName', type: 'TEXT NOT NULL DEFAULT ""' },
        { name: 'birthDate', type: 'DATETIME' },
        { name: 'phone', type: 'TEXT' },
        { name: 'email', type: 'TEXT' },
        { name: 'address', type: 'TEXT' },
        { name: 'diploma', type: 'TEXT' },
        { name: 'experience', type: 'TEXT' },
        { name: 'schedule', type: 'TEXT NOT NULL DEFAULT \'full-time\'' },
        { name: 'cvUrl', type: 'TEXT' },
        { name: 'diplomaUrl', type: 'TEXT' },
        { name: 'status', type: 'TEXT NOT NULL DEFAULT \'pending\'' },
        { name: 'note', type: 'TEXT' },
        { name: 'appliedAt', type: 'DATETIME' },
        { name: 'createdAt', type: 'DATETIME' },
        { name: 'updatedAt', type: 'DATETIME' },
      ];

      // أضف الأعمدة الناقصة
      for (const col of possibleColumns) {
        if (!existingColumns.includes(col.name)) {
          console.log(`Adding column: ${col.name}`);
          try {
            await db.$executeRawUnsafe(
              `ALTER TABLE "JobApplication" ADD COLUMN "${col.name}" ${col.type}`
            );
            console.log(`Added column: ${col.name}`);
          } catch (addErr: any) {
            // العمود قد يكون موجوداً فعلاً، تجاهل الخطأ
            console.log(`Column ${col.name} may already exist:`, addErr.message);
          }
        }
      }
    }

    // إنشاء الفهارس
    try {
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "JobApplication_status_idx" ON "JobApplication"("status")`;
    } catch {}
    try {
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "JobApplication_appliedAt_idx" ON "JobApplication"("appliedAt")`;
    } catch {}

    return true;
  } catch (err: any) {
    console.error('Failed to create/update JobApplication table:', err);
    throw new Error(`فشل إنشاء/تحديث الجدول: ${err.message}`);
  }
}

// دالة لقراءة كل طلبات العمل عبر raw SQL
async function getAllApplications(search: string, status: string | null): Promise<any[]> {
  await ensureJobApplicationTable();

  const columns = await getTableColumns();
  const hasFullName = columns.includes('fullName');
  const hasFirstName = columns.includes('firstName');
  // ابحث عن عمود الـ id (قد يكون id, ID, Id, _id)
  const idColumn = columns.find(c => c.toLowerCase() === 'id') || 'id';

  let sql = `SELECT * FROM "JobApplication"`;
  const params: any[] = [];

  const conditions: string[] = [];
  if (search) {
    if (hasFullName) {
      conditions.push(`"fullName" LIKE ?`);
      params.push(`%${search}%`);
    } else if (hasFirstName) {
      conditions.push(`("firstName" LIKE ? OR "lastName" LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (columns.includes('phone')) {
      conditions.push(`"phone" LIKE ?`);
      params.push(`%${search}%`);
    }
    if (columns.includes('email')) {
      conditions.push(`"email" LIKE ?`);
      params.push(`%${search}%`);
    }
  }

  if (status && status !== 'all' && columns.includes('status')) {
    conditions.push(`"status" = ?`);
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (columns.includes('appliedAt')) {
    sql += ` ORDER BY "appliedAt" DESC`;
  } else {
    sql += ` ORDER BY "${idColumn}" DESC`;
  }

  const result = await db.$queryRawUnsafe(sql, ...params) as any[];

  // تطبيع أسماء الأعمدة - ضمان وجود id, firstName, lastName, fullName
  return result.map((row: any) => {
    // ابحث عن الـ id بأي اسم
    const rowId = row.id || row.ID || row.Id || row._id || Object.values(row)[0];
    return {
      ...row,
      id: rowId,  // ضمان وجود id
      firstName: row.firstName || (row.fullName ? row.fullName.split(' ')[0] : ''),
      lastName: row.lastName || (row.fullName ? row.fullName.split(' ').slice(1).join(' ') : ''),
      fullName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
    };
  });
}

// دالة لإنشاء طلب عمل - متكيّفة مع الأعمدة الموجودة
async function createApplication(data: any): Promise<any> {
  await ensureJobApplicationTable();

  const columns = await getTableColumns();
  const hasFullName = columns.includes('fullName');
  const hasFirstName = columns.includes('firstName');
  const hasLastName = columns.includes('lastName');

  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const birthDate = data.birthDate ? new Date(data.birthDate).toISOString() : null;

  // بناء الـ INSERT بناءً على الأعمدة الموجودة فعلياً
  const insertColumns: string[] = ['"id"', '"appliedAt"', '"createdAt"', '"updatedAt"'];
  const insertValues: any[] = [id, now, now, now];

  // إضافة الحقول المناسبة
  if (hasFullName && !hasFirstName) {
    // الصيغة 1: fullName فقط
    insertColumns.push('"fullName"');
    insertValues.push(`${data.firstName || ''} ${data.lastName || ''}`.trim());
  } else if (hasFirstName && hasLastName) {
    // الصيغة 2: firstName + lastName
    insertColumns.push('"firstName"', '"lastName"');
    insertValues.push(data.firstName || '', data.lastName || '');
    // إذا كان fullName موجوداً أيضاً، أضفه
    if (hasFullName) {
      insertColumns.push('"fullName"');
      insertValues.push(`${data.firstName || ''} ${data.lastName || ''}`.trim());
    }
  } else if (hasFullName) {
    // fullName فقط
    insertColumns.push('"fullName"');
    insertValues.push(`${data.firstName || ''} ${data.lastName || ''}`.trim());
  }

  // إضافة بقية الحقول إذا كانت موجودة
  const optionalFields = [
    { key: 'birthDate', value: birthDate },
    { key: 'phone', value: data.phone || null },
    { key: 'email', value: data.email || null },
    { key: 'address', value: data.address || null },
    { key: 'diploma', value: data.diploma || null },
    { key: 'experience', value: data.experience || null },
    { key: 'schedule', value: data.schedule || 'full-time' },
    { key: 'cvUrl', value: data.cvUrl || null },
    { key: 'diplomaUrl', value: data.diplomaUrl || null },
    { key: 'status', value: data.status || 'pending' },
    { key: 'note', value: data.note || null },
  ];

  for (const field of optionalFields) {
    if (columns.includes(field.key)) {
      insertColumns.push(`"${field.key}"`);
      insertValues.push(field.value);
    }
  }

  // بناء الـ SQL
  const placeholders = insertValues.map(() => '?').join(', ');
  const columnsList = insertColumns.join(', ');
  const sql = `INSERT INTO "JobApplication" (${columnsList}) VALUES (${placeholders})`;

  console.log('INSERT SQL:', sql);
  console.log('INSERT values:', insertValues);

  await db.$executeRawUnsafe(sql, ...insertValues);

  // إرجاع السجل المنشأ
  const result: any = {
    id,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
    birthDate,
    phone: data.phone || null,
    email: data.email || null,
    address: data.address || null,
    diploma: data.diploma || null,
    experience: data.experience || null,
    schedule: data.schedule || 'full-time',
    cvUrl: data.cvUrl || null,
    diplomaUrl: data.diplomaUrl || null,
    status: data.status || 'pending',
    note: data.note || null,
    appliedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return result;
}

// GET - قائمة طلبات العمل
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    // محاولة استخدام raw SQL أولاً (الأكثر موثوقية)
    let applications: any[] = [];

    try {
      applications = await getAllApplications(search, status);
    } catch (rawErr: any) {
      console.log('Raw SQL failed, trying Prisma:', rawErr.message);
      // محاولة Prisma كـ fallback
      try {
        applications = await (db as any).jobApplication.findMany({
          orderBy: { appliedAt: 'desc' },
        });
      } catch (prismaErr: any) {
        console.error('Both raw SQL and Prisma failed:', prismaErr.message);
        return NextResponse.json({
          applications: [],
          error: 'تعذر الوصول لجدول طلبات العمل: ' + prismaErr.message,
        }, { status: 500 });
      }
    }

    // ===== ضمان وجود id و fullName في كل سجل =====
    applications = applications.map((app: any, index: number) => {
      // ابحث عن id بأي طريقة
      const appId = app.id || app.ID || app.Id || app._id ||
                    (app.fullName ? `name-${index}` : `row-${index}`);

      // ابحث عن الاسم
      const fullName = app.fullName ||
                       `${app.firstName || ''} ${app.lastName || ''}`.trim() ||
                       `طلب ${index + 1}`;

      return {
        ...app,
        id: appId,  // ضمان وجود id دائماً
        fullName,
        firstName: app.firstName || (fullName ? fullName.split(' ')[0] : ''),
        lastName: app.lastName || (fullName ? fullName.split(' ').slice(1).join(' ') : ''),
      };
    });

    // تطبيق الفلترة اليدوية إذا لزم
    if (search || (status && status !== 'all')) {
      applications = applications.filter(app => {
        let matchesSearch = true;
        let matchesStatus = true;

        if (search) {
          const fn = (app.fullName || '').toLowerCase();
          const phone = (app.phone || '').toLowerCase();
          const email = (app.email || '').toLowerCase();
          matchesSearch = fn.includes(search.toLowerCase()) ||
                         phone.includes(search.toLowerCase()) ||
                         email.includes(search.toLowerCase());
        }

        if (status && status !== 'all') {
          matchesStatus = app.status === status;
        }

        return matchesSearch && matchesStatus;
      });
    }

    console.log(`GET /api/job-applications: returning ${applications.length} records`);
    if (applications.length > 0) {
      console.log('First record id:', applications[0].id, 'fullName:', applications[0].fullName);
    }

    return NextResponse.json({ applications });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/job-applications error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// POST - إضافة طلب عمل جديد
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();

    // التحقق من الاسم
    const hasName = body.firstName || body.lastName || body.fullName;
    if (!hasName) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }

    let application: any;
    let useRawSql = false;

    // محاولة استخدام Prisma client - متكيّف مع الصيغ المختلفة
    try {
      const columns = await getTableColumns();
      const hasFullName = columns.includes('fullName');
      const hasFirstName = columns.includes('firstName');

      const prismaData: any = {};

      if (hasFullName && !hasFirstName) {
        // الصيغة 1: fullName فقط
        prismaData.fullName = body.fullName || `${body.firstName || ''} ${body.lastName || ''}`.trim();
      } else if (hasFirstName) {
        // الصيغة 2: firstName + lastName
        prismaData.firstName = body.firstName || '';
        prismaData.lastName = body.lastName || '';
        if (hasFullName) {
          prismaData.fullName = body.fullName || `${body.firstName || ''} ${body.lastName || ''}`.trim();
        }
      } else {
        // لا نعرف الصيغة، استخدم raw SQL
        throw new Error('No name columns found');
      }

      // أضف الحقول الاختيارية
      if (columns.includes('birthDate')) prismaData.birthDate = body.birthDate ? new Date(body.birthDate) : null;
      if (columns.includes('phone')) prismaData.phone = body.phone || null;
      if (columns.includes('email')) prismaData.email = body.email || null;
      if (columns.includes('address')) prismaData.address = body.address || null;
      if (columns.includes('diploma')) prismaData.diploma = body.diploma || null;
      if (columns.includes('experience')) prismaData.experience = body.experience || null;
      if (columns.includes('schedule')) prismaData.schedule = body.schedule || 'full-time';
      if (columns.includes('cvUrl')) prismaData.cvUrl = body.cvUrl || null;
      if (columns.includes('diplomaUrl')) prismaData.diplomaUrl = body.diplomaUrl || null;
      if (columns.includes('status')) prismaData.status = body.status || 'pending';
      if (columns.includes('note')) prismaData.note = body.note || null;

      application = await (db as any).jobApplication.create({ data: prismaData });
    } catch (prismaErr: any) {
      console.log('Prisma create failed, using raw SQL:', prismaErr.message);
      useRawSql = true;
    }

    if (useRawSql) {
      try {
        application = await createApplication(body);
      } catch (rawErr: any) {
        console.error('Raw SQL insert failed:', rawErr);
        return NextResponse.json({
          error: 'تعذر إنشاء طلب العمل: ' + (rawErr.message || ''),
          details: rawErr.message,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ application }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/job-applications error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
