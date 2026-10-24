// ===== PUT/DELETE /api/job-applications/[id] =====
// تعديل وحذف طلبات العمل

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter } from '@/lib/branch-filter';

// نسخة مبسطة من ensureTable (لأن الجدول يجب أن يكون موجوداً قبل التحديث/الحذف)
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    await db.jobApplication.findFirst({ select: { id: true } });
    tableEnsured = true;
  } catch (e: any) {
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "JobApplication" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "birthDate" TIMESTAMP,
          "phone" TEXT,
          "email" TEXT,
          "whatsapp" TEXT,
          "diploma" TEXT,
          "experience" TEXT,
          "address" TEXT,
          "note" TEXT,
          "cvUrl" TEXT,
          "diplomaUrl" TEXT,
          "status" TEXT NOT NULL DEFAULT 'pending',
          "branchId" TEXT,
          "appliedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      tableEnsured = true;
    } catch {}
  }
}

// PUT — تعديل طلب (تغيير الحالة، الملاحظة، إلخ)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    await ensureTable();
    const { id } = await params;
    const body = await request.json();
    const branchFilter = await getBranchFilter();

    // التحقق من وجود الطلب ضمن نطاق الفرع
    const existing = await db.jobApplication.findFirst({
      where: { id, ...branchFilter },
    });
    if (!existing) {
      return NextResponse.json({ error: 'الطلب غير موجود أو لا يخص فرعك' }, { status: 404 });
    }

    let birthDate: Date | null = existing.birthDate;
    if (body.birthDate !== undefined) {
      try {
        birthDate = body.birthDate ? new Date(body.birthDate) : null;
        if (birthDate && isNaN(birthDate.getTime())) birthDate = null;
      } catch {}
    }

    const updated = await db.jobApplication.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        birthDate,
        phone: body.phone?.trim() ?? existing.phone,
        email: body.email?.trim() ?? existing.email,
        whatsapp: body.whatsapp?.trim() ?? existing.whatsapp,
        diploma: body.diploma?.trim() ?? existing.diploma,
        experience: body.experience?.trim() ?? existing.experience,
        address: body.address?.trim() ?? existing.address,
        note: body.note?.trim() ?? existing.note,
        cvUrl: body.cvUrl !== undefined ? (body.cvUrl || null) : existing.cvUrl,
        diplomaUrl: body.diplomaUrl !== undefined ? (body.diplomaUrl || null) : existing.diplomaUrl,
        status: body.status || existing.status,
      },
    });

    return NextResponse.json({ application: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('PUT /api/job-applications/[id] error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}

// DELETE — حذف طلب
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    await ensureTable();
    const { id } = await params;
    const branchFilter = await getBranchFilter();

    const existing = await db.jobApplication.findFirst({
      where: { id, ...branchFilter },
    });
    if (!existing) {
      return NextResponse.json({ error: 'الطلب غير موجود أو لا يخص فرعك' }, { status: 404 });
    }

    await db.jobApplication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('DELETE /api/job-applications/[id] error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
