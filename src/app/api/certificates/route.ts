// ===== GET/POST /api/certificates =====
// سجل الشهادات - يدعم:
// - التخصصات الطبية، التأهيلية، التقني سامي
// - حقول إضافية للتقني سامي (رقم التثبيت، كشف النقاط، الدبلوم)
// - رفع ملفات PDF/JPEG/PNG
// ينشئ الجدول تلقائياً إذا لم يكن موجوداً

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// ===== أنواع التخصصات =====
export const SPECIALIZATION_TYPES = {
  medical: 'التخصصات الطبية',
  qualification: 'التخصصات التأهيلية',
  ts: 'التقني سامي',
} as const;

type SpecType = keyof typeof SPECIALIZATION_TYPES;

// ===== التحقق من وجود الجدول وإنشائه =====
async function tableExists(): Promise<boolean> {
  try {
    const result = await db.$queryRaw`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='Certificate'
    ` as any[];
    return result.length > 0;
  } catch {
    return false;
  }
}

async function getTableColumns(): Promise<string[]> {
  try {
    const columns = await db.$queryRaw`PRAGMA table_info("Certificate")` as any[];
    return columns.map((c: any) => c.name);
  } catch {
    return [];
  }
}

async function ensureCertificateTable(): Promise<void> {
  const exists = await tableExists();
  if (!exists) {
    console.log('Creating Certificate table...');
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Certificate" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "studentId" TEXT,
        "studentName" TEXT NOT NULL DEFAULT "",
        "specialization" TEXT NOT NULL,
        "certificateNumber" TEXT,
        "deliveryDate" DATETIME,
        "tsAccreditationNumber" TEXT,
        "tsTranscriptNumber" TEXT,
        "tsDiplomaNumber" TEXT,
        "diplomaUrl" TEXT,
        "tsAccreditationUrl" TEXT,
        "tsTranscriptUrl" TEXT,
        "tsDiplomaUrl" TEXT,
        "notes" TEXT,
        "branchId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      )
    `;
    try {
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Certificate_studentId_idx" ON "Certificate"("studentId")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Certificate_specialization_idx" ON "Certificate"("specialization")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Certificate_branchId_idx" ON "Certificate"("branchId")`;
    } catch {}
    console.log('Certificate table created');
    return;
  }

  // الجدول موجود - أضف الأعمدة الناقصة
  const existingColumns = await getTableColumns();
  const requiredColumns = [
    { name: 'studentId', type: 'TEXT' },
    { name: 'studentName', type: 'TEXT NOT NULL DEFAULT ""' },
    { name: 'specialization', type: 'TEXT NOT NULL DEFAULT ""' },
    { name: 'certificateNumber', type: 'TEXT' },
    { name: 'deliveryDate', type: 'DATETIME' },
    { name: 'tsAccreditationNumber', type: 'TEXT' },
    { name: 'tsTranscriptNumber', type: 'TEXT' },
    { name: 'tsDiplomaNumber', type: 'TEXT' },
    { name: 'diplomaUrl', type: 'TEXT' },
    { name: 'tsAccreditationUrl', type: 'TEXT' },
    { name: 'tsTranscriptUrl', type: 'TEXT' },
    { name: 'tsDiplomaUrl', type: 'TEXT' },
    { name: 'notes', type: 'TEXT' },
    { name: 'branchId', type: 'TEXT' },
    { name: 'createdAt', type: 'DATETIME' },
    { name: 'updatedAt', type: 'DATETIME' },
  ];
  for (const col of requiredColumns) {
    if (!existingColumns.includes(col.name)) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "Certificate" ADD COLUMN "${col.name}" ${col.type}`
        );
        console.log(`Added column: ${col.name}`);
      } catch (e: any) {
        console.log(`Column ${col.name}:`, e.message);
      }
    }
  }
}

// ===== GET - قائمة الشهادات =====
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await ensureCertificateTable();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const specialization = searchParams.get('specialization');

    let sql = `SELECT * FROM "Certificate"`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push(`("studentName" LIKE ? OR "certificateNumber" LIKE ? OR "tsAccreditationNumber" LIKE ? OR "tsTranscriptNumber" LIKE ? OR "tsDiplomaNumber" LIKE ?)`);
      const sp = `%${search}%`;
      params.push(sp, sp, sp, sp, sp);
    }
    if (specialization && specialization !== 'all') {
      conditions.push(`"specialization" = ?`);
      params.push(specialization);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY "createdAt" DESC`;

    const certificates = await db.$queryRawUnsafe(sql, ...params) as any[];

    // تطبيع الأسماء
    const result = certificates.map((c: any, i: number) => ({
      ...c,
      id: c.id || `row-${i}`,
      studentName: c.studentName || '',
      specialization: c.specialization || '',
      certificateNumber: c.certificateNumber || null,
      deliveryDate: c.deliveryDate || null,
      tsAccreditationNumber: c.tsAccreditationNumber || null,
      tsTranscriptNumber: c.tsTranscriptNumber || null,
      tsDiplomaNumber: c.tsDiplomaNumber || null,
      diplomaUrl: c.diplomaUrl || null,
      tsAccreditationUrl: c.tsAccreditationUrl || null,
      tsTranscriptUrl: c.tsTranscriptUrl || null,
      tsDiplomaUrl: c.tsDiplomaUrl || null,
      notes: c.notes || null,
    }));

    return NextResponse.json({ certificates: result });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/certificates error:', error);
    return NextResponse.json({
      error: error.message || 'حدث خطأ',
      certificates: [],
    }, { status: 500 });
  }
}

// ===== POST - إضافة شهادة جديدة =====
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    await ensureCertificateTable();
    const body = await request.json();

    // التحقق من الحقول المطلوبة
    if (!body.studentName && !body.studentId) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 });
    }
    if (!body.specialization) {
      return NextResponse.json({ error: 'التخصص مطلوب' }, { status: 400 });
    }

    // التحقق من صحة التخصص
    const validSpecs = ['medical', 'qualification', 'ts'];
    if (!validSpecs.includes(body.specialization)) {
      return NextResponse.json({ error: 'تخصص غير صالح' }, { status: 400 });
    }

    const id = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate).toISOString() : null;

    const columns = await getTableColumns();
    const insertCols: string[] = ['"id"', '"createdAt"', '"updatedAt"'];
    const insertVals: any[] = [id, now, now];

    const fields = [
      { key: 'studentId', value: body.studentId || null },
      { key: 'studentName', value: body.studentName || '' },
      { key: 'specialization', value: body.specialization },
      { key: 'certificateNumber', value: body.certificateNumber || null },
      { key: 'deliveryDate', value: deliveryDate },
      { key: 'tsAccreditationNumber', value: body.tsAccreditationNumber || null },
      { key: 'tsTranscriptNumber', value: body.tsTranscriptNumber || null },
      { key: 'tsDiplomaNumber', value: body.tsDiplomaNumber || null },
      { key: 'diplomaUrl', value: body.diplomaUrl || null },
      { key: 'tsAccreditationUrl', value: body.tsAccreditationUrl || null },
      { key: 'tsTranscriptUrl', value: body.tsTranscriptUrl || null },
      { key: 'tsDiplomaUrl', value: body.tsDiplomaUrl || null },
      { key: 'notes', value: body.notes || null },
      { key: 'branchId', value: body.branchId || null },
    ];

    for (const f of fields) {
      if (columns.includes(f.key)) {
        insertCols.push(`"${f.key}"`);
        insertVals.push(f.value);
      }
    }

    const placeholders = insertVals.map(() => '?').join(', ');
    const colsList = insertCols.join(', ');
    const sql = `INSERT INTO "Certificate" (${colsList}) VALUES (${placeholders})`;
    await db.$executeRawUnsafe(sql, ...insertVals);

    const certificate = {
      id,
      ...body,
      deliveryDate,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ certificate }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/certificates error:', error);
    return NextResponse.json({
      error: 'تعذر إنشاء الشهادة: ' + (error.message || ''),
    }, { status: 500 });
  }
}
