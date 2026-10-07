// ===== GET/PUT/DELETE /api/job-applications/[id] =====
// Next.js 16: params is now a Promise - must be awaited
// متكيّف مع raw SQL ويدعم كل صيغ schema

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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

async function ensureTable() {
  const exists = await tableExists();
  if (!exists) {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "JobApplication" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "firstName" TEXT NOT NULL DEFAULT "",
        "lastName" TEXT NOT NULL DEFAULT "",
        "fullName" TEXT NOT NULL DEFAULT "",
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
  }
}

// دالة مساعدة: حذف ملف من القرص
async function deleteFile(fileUrl: string | null | undefined) {
  if (!fileUrl) return;
  try {
    const { promises: fs } = await import('fs');
    const path = await import('path');

    let filename: string | null = null;
    if (fileUrl.includes('path=')) {
      const url = new URL(fileUrl, 'http://localhost');
      const pathParam = url.searchParams.get('path');
      if (pathParam) {
        filename = pathParam.split('/').pop();
      }
    } else if (fileUrl.includes('/uploads/jobs/')) {
      filename = fileUrl.split('/').pop();
    } else if (fileUrl.includes('/download/job-files/')) {
      filename = fileUrl.split('/').pop();
    }

    if (!filename) return;

    const publicPath = path.join(process.cwd(), 'public', 'uploads', 'jobs', filename);
    try {
      await fs.unlink(publicPath);
      console.log(`Deleted file: ${publicPath}`);
    } catch {}

    const downloadPath = path.join(process.cwd(), 'download', 'job-files', filename);
    try {
      await fs.unlink(downloadPath);
      console.log(`Deleted file: ${downloadPath}`);
    } catch {}
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}

// ===== GET =====
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;  // ← Next.js 16: await params

    let application: any = null;
    try {
      application = await (db as any).jobApplication.findUnique({
        where: { id },
      });
    } catch {
      await ensureTable();
      const result = await db.$queryRawUnsafe(
        `SELECT * FROM "JobApplication" WHERE "id" = ?`,
        id
      ) as any[];
      application = result[0] || null;
    }

    if (!application) {
      return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ application });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// ===== PUT =====
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;  // ← Next.js 16: await params
    const body = await request.json();

    let application: any;
    try {
      const prismaData: any = {};
      if (body.firstName !== undefined) prismaData.firstName = body.firstName;
      if (body.lastName !== undefined) prismaData.lastName = body.lastName;
      if (body.fullName !== undefined) prismaData.fullName = body.fullName;
      if (body.birthDate !== undefined) prismaData.birthDate = body.birthDate ? new Date(body.birthDate) : null;
      if (body.phone !== undefined) prismaData.phone = body.phone || null;
      if (body.email !== undefined) prismaData.email = body.email || null;
      if (body.address !== undefined) prismaData.address = body.address || null;
      if (body.diploma !== undefined) prismaData.diploma = body.diploma || null;
      if (body.experience !== undefined) prismaData.experience = body.experience || null;
      if (body.schedule !== undefined) prismaData.schedule = body.schedule || 'full-time';
      if (body.cvUrl !== undefined) prismaData.cvUrl = body.cvUrl || null;
      if (body.diplomaUrl !== undefined) prismaData.diplomaUrl = body.diplomaUrl || null;
      if (body.status !== undefined) prismaData.status = body.status || 'pending';
      if (body.note !== undefined) prismaData.note = body.note || null;

      application = await (db as any).jobApplication.update({
        where: { id },
        data: prismaData,
      });
    } catch (prismaErr: any) {
      console.log('Prisma update failed, using raw SQL:', prismaErr.message);
      await ensureTable();

      const columns = await db.$queryRaw`PRAGMA table_info("JobApplication")` as any[];
      const existingColumns = columns.map((c: any) => c.name);

      const setClauses: string[] = [];
      const setValues: any[] = [];
      const now = new Date().toISOString();

      const updateFields = [
        { key: 'firstName', value: body.firstName },
        { key: 'lastName', value: body.lastName },
        { key: 'fullName', value: body.fullName },
        { key: 'phone', value: body.phone || null },
        { key: 'email', value: body.email || null },
        { key: 'address', value: body.address || null },
        { key: 'diploma', value: body.diploma || null },
        { key: 'experience', value: body.experience || null },
        { key: 'schedule', value: body.schedule || 'full-time' },
        { key: 'cvUrl', value: body.cvUrl || null },
        { key: 'diplomaUrl', value: body.diplomaUrl || null },
        { key: 'status', value: body.status || 'pending' },
        { key: 'note', value: body.note || null },
      ];

      if (body.birthDate !== undefined) {
        updateFields.push({
          key: 'birthDate',
          value: body.birthDate ? new Date(body.birthDate).toISOString() : null,
        } as any);
      }

      for (const field of updateFields) {
        if (field.value !== undefined && existingColumns.includes(field.key)) {
          setClauses.push(`"${field.key}" = ?`);
          setValues.push(field.value);
        }
      }

      if (existingColumns.includes('updatedAt')) {
        setClauses.push(`"updatedAt" = ?`);
        setValues.push(now);
      }

      if (setClauses.length > 0) {
        setValues.push(id);
        const sql = `UPDATE "JobApplication" SET ${setClauses.join(', ')} WHERE "id" = ?`;
        await db.$executeRawUnsafe(sql, ...setValues);
      }

      application = { id, ...body, updatedAt: now };
    }

    return NextResponse.json({ application });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/job-applications/[id] error:', error);
    return NextResponse.json({
      error: error.message || 'حدث خطأ',
      details: error.message,
    }, { status: 500 });
  }
}

// ===== DELETE =====
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;  // ← Next.js 16: await params

    console.log('DELETE request for id:', id);

    await ensureTable();

    // اقرأ السجل باستخدام raw SQL أولاً (الأكثر موثوقية)
    let application: any = null;
    try {
      const result = await db.$queryRawUnsafe(
        `SELECT * FROM "JobApplication" WHERE "id" = ?`,
        id
      ) as any[];
      application = result[0] || null;
      console.log('Found application:', application ? 'yes' : 'no');
    } catch (rawErr: any) {
      console.log('Raw SQL select failed, trying Prisma:', rawErr.message);
      try {
        application = await (db as any).jobApplication.findUnique({
          where: { id },
        });
      } catch (prismaErr: any) {
        console.error('Both raw SQL and Prisma failed:', prismaErr.message);
      }
    }

    if (!application) {
      // تشخيص: اعرض كل السجلات
      let allIds: any[] = [];
      try {
        allIds = await db.$queryRawUnsafe(
          `SELECT "id" FROM "JobApplication" LIMIT 10`
        ) as any[];
      } catch {}
      return NextResponse.json({
        error: `السجل غير موجود (id: ${id})`,
        details: 'Record not found in JobApplication table',
        receivedId: id,
        sampleIds: allIds.map((r: any) => r.id),
      }, { status: 404 });
    }

    // حذف الملفات المرتبطة من القرص
    await deleteFile(application.cvUrl);
    await deleteFile(application.diplomaUrl);

    // حذف السجل من قاعدة البيانات
    try {
      await db.$executeRawUnsafe(
        `DELETE FROM "JobApplication" WHERE "id" = ?`,
        id
      );
      console.log('Deleted successfully:', id);
    } catch (rawErr: any) {
      console.log('Raw SQL delete failed, trying Prisma:', rawErr.message);
      try {
        await (db as any).jobApplication.delete({
          where: { id },
        });
      } catch (prismaErr: any) {
        console.error('Both delete methods failed:', prismaErr.message);
        return NextResponse.json({
          error: 'تعذر حذف السجل: ' + (prismaErr.message || rawErr.message),
          details: prismaErr.message || rawErr.message,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم الحذف بنجاح',
      deletedFiles: {
        cv: application.cvUrl ? true : false,
        diploma: application.diplomaUrl ? true : false,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/job-applications/[id] error:', error);
    return NextResponse.json({
      error: error.message || 'حدث خطأ',
      details: error.message,
    }, { status: 500 });
  }
}
