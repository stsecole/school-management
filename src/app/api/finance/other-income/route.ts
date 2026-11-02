import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

const INCOME_SOURCES = [
  'إيجار قاعات',
  'دورات خارجية',
  'تبرعات',
  'بيع مستلزمات',
  'خدمات استشارية',
  'أخرى',
];

// ===== Auto-create table if missing =====
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    await db.otherIncome.findFirst({ select: { id: true } });
    tableEnsured = true;
  } catch {
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "OtherIncome" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "receiptNumber" TEXT NOT NULL UNIQUE,
          "source" TEXT NOT NULL,
          "description" TEXT,
          "amount" DOUBLE PRECISION NOT NULL,
          "date" TIMESTAMP NOT NULL,
          "branchId" TEXT,
          "isCancelled" BOOLEAN NOT NULL DEFAULT false,
          "cancelledAt" TIMESTAMP,
          "cancelReason" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      try {
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "OtherIncome_date_branchId_idx" ON "OtherIncome"("date", "branchId")`;
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "OtherIncome_source_idx" ON "OtherIncome"("source")`;
        await db.$executeRaw`CREATE INDEX IF NOT EXISTS "OtherIncome_isCancelled_idx" ON "OtherIncome"("isCancelled")`;
      } catch {}
      tableEnsured = true;
      console.log('OtherIncome table created successfully');
    } catch (e: any) {
      console.error('Failed to create OtherIncome table:', e.message);
    }
  }
}

// GET /api/finance/other-income
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source');
    const month = searchParams.get('month');

    const branchFilter = await getBranchFilter();
    const where: any = { ...branchFilter };
    if (source && source !== 'all') where.source = source;
    if (search) {
      where.OR = [
        { source: { contains: search } },
        { description: { contains: search } },
        { receiptNumber: { contains: search } },
      ];
    }
    if (month) {
      const start = new Date(month + '-01');
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      where.date = { gte: start, lt: end };
    }

    const incomes = await db.otherIncome.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const total = incomes
      .filter(i => !i.isCancelled)
      .reduce((s, i) => s + i.amount, 0);

    return NextResponse.json({ incomes, total, sources: INCOME_SOURCES });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('GET other-income error:', error);
    return NextResponse.json({ error: 'خطأ: ' + (error.message || '') }, { status: 500 });
  }
}

// POST /api/finance/other-income
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await ensureTable();

    const body = await request.json();

    if (!body.source || !body.amount) {
      return NextResponse.json({ error: 'المصدر والمبلغ مطلوبان' }, { status: 400 });
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
    }

    // توليد رقم وصل
    const setting = await db.setting.findUnique({ where: { key: 'other_income_counter' } });
    let counter = setting ? parseInt(setting.value) : 8000;
    counter++;
    await db.setting.upsert({
      where: { key: 'other_income_counter' },
      update: { value: String(counter) },
      create: { key: 'other_income_counter', value: String(counter) },
    });
    const receiptNumber = body.receiptNumber || `OI-${counter}`;

    const income = await db.otherIncome.create({
      data: {
        receiptNumber,
        source: body.source,
        description: body.description || null,
        amount,
        date: body.date ? new Date(body.date) : new Date(),
        branchId: await getBranchIdForNewRecord(),
      },
    });

    try {
      await db.activityLog.create({
        data: {
          userId: user.id, userName: user.name, action: 'create', module: 'finance',
          description: `مدخل آخر: ${body.source} - ${amount} دج`,
          targetType: 'other_income', targetId: income.id,
        },
      });
    } catch {}

    return NextResponse.json({ income }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST other-income error:', error);
    return NextResponse.json({
      error: 'فشل الحفظ: ' + (error.message || 'خطأ غير معروف'),
      hint: 'إذا استمر الخطأ، شغّل: npx prisma db push',
    }, { status: 500 });
  }
}
