// ===== GET/PUT/DELETE /api/certificates/[id] =====
// Next.js 16: params is a Promise - must be awaited

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

async function ensureTable() {
  try {
    const exists = await db.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='Certificate'
    ` as any[];
    if (exists.length === 0) {
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
    }
  } catch {}
}

async function deleteFile(fileUrl: string | null | undefined) {
  if (!fileUrl) return;
  try {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    let filename: string | null = null;
    if (fileUrl.includes('path=')) {
      const url = new URL(fileUrl, 'http://localhost');
      const pathParam = url.searchParams.get('path');
      if (pathParam) filename = pathParam.split('/').pop();
    } else if (fileUrl.includes('/uploads/certificates/')) {
      filename = fileUrl.split('/').pop();
    } else if (fileUrl.includes('/download/cert-files/')) {
      filename = fileUrl.split('/').pop();
    }
    if (!filename) return;
    const publicPath = path.join(process.cwd(), 'public', 'uploads', 'certificates', filename);
    try { await fs.unlink(publicPath); } catch {}
    const downloadPath = path.join(process.cwd(), 'download', 'cert-files', filename);
    try { await fs.unlink(downloadPath); } catch {}
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await ensureTable();

    const result = await db.$queryRawUnsafe(
      `SELECT * FROM "Certificate" WHERE "id" = ?`,
      id
    ) as any[];
    const certificate = result[0] || null;

    if (!certificate) {
      return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ certificate });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await ensureTable();
    const body = await request.json();

    const columns = await db.$queryRaw`PRAGMA table_info("Certificate")` as any[];
    const existingColumns = columns.map((c: any) => c.name);

    const setClauses: string[] = [];
    const setValues: any[] = [];
    const now = new Date().toISOString();

    const fields = [
      { key: 'studentId', value: body.studentId || null },
      { key: 'studentName', value: body.studentName || '' },
      { key: 'specialization', value: body.specialization || '' },
      { key: 'certificateNumber', value: body.certificateNumber || null },
      { key: 'deliveryDate', value: body.deliveryDate ? new Date(body.deliveryDate).toISOString() : null },
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
      if (f.value !== undefined && existingColumns.includes(f.key)) {
        setClauses.push(`"${f.key}" = ?`);
        setValues.push(f.value);
      }
    }

    if (existingColumns.includes('updatedAt')) {
      setClauses.push(`"updatedAt" = ?`);
      setValues.push(now);
    }

    if (setClauses.length > 0) {
      setValues.push(id);
      const sql = `UPDATE "Certificate" SET ${setClauses.join(', ')} WHERE "id" = ?`;
      await db.$executeRawUnsafe(sql, ...setValues);
    }

    return NextResponse.json({ certificate: { id, ...body, updatedAt: now } });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    await ensureTable();

    // اقرأ السجل أولاً لحذف الملفات
    const result = await db.$queryRawUnsafe(
      `SELECT * FROM "Certificate" WHERE "id" = ?`,
      id
    ) as any[];
    const certificate = result[0] || null;

    if (!certificate) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    // حذف الملفات المرتبطة
    await deleteFile(certificate.diplomaUrl);
    await deleteFile(certificate.tsAccreditationUrl);
    await deleteFile(certificate.tsTranscriptUrl);
    await deleteFile(certificate.tsDiplomaUrl);

    // حذف السجل
    await db.$executeRawUnsafe(`DELETE FROM "Certificate" WHERE "id" = ?`, id);

    return NextResponse.json({
      success: true,
      message: 'تم الحذف بنجاح',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({
      error: error.message || 'حدث خطأ',
      details: error.message,
    }, { status: 500 });
  }
}
