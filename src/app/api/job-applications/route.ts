// ===== GET/POST /api/job-applications =====
// إدارة طلبات العمل

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

// ===== Auto-create table fallback =====
// إذا لم يُشغّل المستخدم `npx prisma db push` بعد، الجدول غير موجود.
// نحاول إنشاءه تلقائياً (متوافق مع PostgreSQL و SQLite).
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    // اختبار سريع: هل الجدول موجود؟
    await db.jobApplication.findFirst({ select: { id: true } });
    tableEnsured = true;
  } catch (e: any) {
    console.log('JobApplication table not found, attempting to create it...');
    // محاولة CREATE TABLE IF NOT EXISTS
    // ملاحظة: هذا SQL عام يعمل على PostgreSQL و SQLite
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
      // إنشاء index اختياري (يتجاهل الأخطاء لو موجود)
      try {
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "JobApplication_branchId_idx" ON "JobApplication"("branchId")`;
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "JobApplication_status_idx" ON "JobApplication"("status")`;
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "JobApplication_appliedAt_idx" ON "JobApplication"("appliedAt")`;
      } catch {}
      tableEnsured = true;
      console.log('JobApplication table created successfully');
    } catch (createErr: any) {
      console.error('Failed to create JobApplication table:', createErr.message);
      // لا نُعيد throw — نترك الخطأ الأصلي يظهر للمستخدم
    }
  }
}

// GET — قائمة الطلبات (مفلترة بالفرع)
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };
    if (search) {
      // استخدم contains بدون mode: 'insensitive' (متوافق مع SQLite و PostgreSQL)
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { whatsapp: { contains: search } },
        { diploma: { contains: search } },
      ];
    }
    if (status && status !== 'all') where.status = status;

    const applications = await db.jobApplication.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
    });

    return NextResponse.json({ applications });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/job-applications error:', error);
    const hint = error.message && error.message.includes('does not exist')
      ? ' — يجب تشغيل: npx prisma db push لإنشاء الجدول'
      : '';
    return NextResponse.json({
      error: 'خطأ في الخادم: ' + (error.message || '') + hint,
    }, { status: 500 });
  }
}

// POST — إضافة طلب جديد
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'الاسم واللقب مطلوبان' }, { status: 400 });
    }

    const branchId = await getBranchIdForNewRecord();

    let birthDate: Date | null = null;
    if (body.birthDate) {
      try {
        birthDate = new Date(body.birthDate);
        if (isNaN(birthDate.getTime())) birthDate = null;
      } catch {}
    }

    const application = await db.jobApplication.create({
      data: {
        name: body.name.trim(),
        birthDate,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        whatsapp: body.whatsapp?.trim() || null,
        diploma: body.diploma?.trim() || null,
        experience: body.experience?.trim() || null,
        address: body.address?.trim() || null,
        note: body.note?.trim() || null,
        cvUrl: body.cvUrl || null,
        diplomaUrl: body.diplomaUrl || null,
        status: body.status || 'pending',
        branchId,
      },
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/job-applications error:', error);
    const hint = error.message && error.message.includes('does not exist')
      ? ' — يجب تشغيل: npx prisma db push لإنشاء الجدول'
      : '';
    return NextResponse.json({
      error: 'خطأ في الخادم: ' + (error.message || '') + hint,
    }, { status: 500 });
  }
}
