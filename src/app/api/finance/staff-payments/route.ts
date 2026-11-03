import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getBranchFilter, getBranchIdForNewRecord } from '@/lib/branch-filter';

// ===== Auto-create table + add missing columns =====
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    // تحقق من وجود الجدول
    try {
      await (db as any).staffPayment.findFirst({ select: { id: true } });
    } catch {
      // الجدول غير موجود — أنشئه
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "StaffPayment" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "receiptNumber" TEXT NOT NULL UNIQUE,
          "staffName" TEXT NOT NULL,
          "staffRole" TEXT,
          "userId" TEXT,
          "amount" DOUBLE PRECISION NOT NULL,
          "month" TEXT,
          "paymentDate" TIMESTAMP NOT NULL,
          "note" TEXT,
          "isCancelled" BOOLEAN NOT NULL DEFAULT false,
          "cancelledAt" TIMESTAMP,
          "cancelReason" TEXT,
          "branchId" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
    }

    // تحقق من وجود عمود branchId وأضفه إذا لم يكن موجوداً
    try {
      await db.$executeRawUnsafe(`SELECT "branchId" FROM "StaffPayment" LIMIT 1`);
    } catch {
      // عمود branchId غير موجود — أضفه
      console.log('Adding branchId column to StaffPayment...');
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "StaffPayment" ADD COLUMN IF NOT EXISTS "branchId" TEXT`);
        console.log('branchId column added successfully');
      } catch (e: any) {
        // PostgreSQL قد لا يدعم IF NOT EXISTS في ALTER TABLE في بعض الإصدارات
        try {
          await db.$executeRawUnsafe(`ALTER TABLE "StaffPayment" ADD COLUMN "branchId" TEXT`);
          console.log('branchId column added (without IF NOT EXISTS)');
        } catch (e2: any) {
          console.log('branchId column might already exist:', e2.message);
        }
      }
    }

    // أضف indexes
    try {
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StaffPayment_staffName_idx" ON "StaffPayment"("staffName")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StaffPayment_paymentDate_idx" ON "StaffPayment"("paymentDate")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StaffPayment_receiptNumber_idx" ON "StaffPayment"("receiptNumber")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StaffPayment_isCancelled_idx" ON "StaffPayment"("isCancelled")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "StaffPayment_branchId_idx" ON "StaffPayment"("branchId")`;
    } catch {}

    tableEnsured = true;
  } catch (e: any) {
    console.error('ensureTable error:', e.message);
    tableEnsured = true; // لا نعيد المحاولة في كل طلب
  }
}

// GET /api/finance/staff-payments
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    await ensureTable();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const month = searchParams.get('month');
    const userId = searchParams.get('userId');

    const branchFilter = await getBranchFilter();
    // لا نستخدم branchFilter في Prisma where لأن StaffPayment قد لا يكون له branchId في schema المحلي
    // بدلاً من ذلك، نفلتر يدوياً بعد جلب البيانات
    const where: any = {};
    if (search) {
      where.OR = [
        { staffName: { contains: search } },
        { staffRole: { contains: search } },
        { receiptNumber: { contains: search } },
        { note: { contains: search } },
      ];
    }
    if (month && month !== 'all') where.month = month;

    let payments: any[] = [];
    let total = 0;
    try {
      // استخدم raw SQL بدلاً من Prisma findMany
      // لأن Prisma لا يعرف branchId (غير موجود في schema المحلي)
      // raw SQL يرجع كل الأعمدة بما فيها branchId
      const branchIdFilter = (branchFilter as any).branchId;

      if (branchIdFilter !== undefined && branchIdFilter !== null) {
        // فلتر بالفرع عبر SQL مباشرة
        payments = await db.$queryRawUnsafe(
          `SELECT * FROM "StaffPayment" WHERE "branchId" = $1 ORDER BY "paymentDate" DESC`,
          branchIdFilter
        ) as any[];
      } else {
        // كل الفروع (مدير بدون فرع محدد)
        payments = await db.$queryRawUnsafe(
          `SELECT * FROM "StaffPayment" ORDER BY "paymentDate" DESC`
        ) as any[];
      }

      // فلترة بالبحث النصي
      if (search) {
        const q = search.toLowerCase();
        payments = payments.filter((p: any) =>
          (p.staffName || '').toLowerCase().includes(q) ||
          (p.staffRole || '').toLowerCase().includes(q) ||
          (p.receiptNumber || '').toLowerCase().includes(q) ||
          (p.note || '').toLowerCase().includes(q)
        );
      }

      // فلترة بالشهر
      if (month && month !== 'all') {
        payments = payments.filter((p: any) => p.month === month);
      }

      // فلترة بـ userId
      if (userId && userId !== 'all') {
        try {
          const userRecord = await db.user.findUnique({ where: { id: userId } });
          if (userRecord) {
            payments = payments.filter((p: any) => p.staffName === userRecord.name);
          }
        } catch {}
      }

      // استثني الوصولات المشطوبة من المجموع
      total = payments
        .filter((p: any) => !p.isCancelled)
        .reduce((s: number, p: any) => s + p.amount, 0);
    } catch (err: any) {
      console.log('StaffPayment error:', err.message);
      return NextResponse.json({ payments: [], total: 0 });
    }

    // تنسيق البيانات للواجهة
    const formattedPayments = payments.map((p: any) => {
      let paymentType = 'salary';
      let paymentLabel: string | null = null;
      let notes: string | null = p.note;
      if (p.note) {
        const parts = p.note.split(' - ');
        for (const part of parts) {
          if (part.startsWith('(') && part.endsWith(')')) {
            paymentType = part.slice(1, -1);
          } else if (!paymentLabel && part !== p.note) {
            paymentLabel = part;
          }
        }
      }
      return {
        id: p.id,
        receiptNumber: p.receiptNumber || '',
        userId: p.userId || '',
        userName: p.staffName,
        staffName: p.staffName,
        staffRole: p.staffRole,
        amount: p.amount,
        month: p.month || '',
        paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
        paymentType,
        paymentLabel,
        notes,
        note: p.note,
        isCancelled: p.isCancelled || false,
        cancelledAt: p.cancelledAt,
        cancelReason: p.cancelReason,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      };
    });

    return NextResponse.json({ payments: formattedPayments, total });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/finance/staff-payments error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/finance/staff-payments
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await ensureTable();
    const body = await request.json();

    let staffName = body.staffName || body.name || body.employeeName || body.staff_name || body.fullName || '';
    const userId = body.userId || body.user_id || body.employeeId || body.employee_id;
    const amountRaw = body.amount ?? body.paymentAmount ?? body.salary ?? body.value ?? body.price;
    let staffRole = body.staffRole || body.role || body.position || body.staff_role || null;

    // إذا لم يكن هناك staffName مباشرة، لكن هناك userId، اجلب الاسم من جدول User
    if (!staffName && userId) {
      try {
        const userRecord = await db.user.findUnique({ where: { id: userId } });
        if (userRecord) {
          staffName = userRecord.name;
          if (!staffRole) {
            staffRole = userRecord.role === 'director' ? 'مدير' : 'موظف';
          }
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    }

    if (!staffName || !amountRaw || amountRaw === '' || amountRaw === 0) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم الموظف والمبلغ' },
        { status: 400 }
      );
    }

    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw).replace(/[^\d.-]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صالح' }, { status: 400 });
    }

    // Generate receipt number
    let receiptNumber = body.receiptNumber;
    if (!receiptNumber) {
      try {
        const setting = await db.setting.findUnique({ where: { key: 'staff_receipt_counter' } });
        let counter = setting ? parseInt(setting.value) : 5000;
        counter++;
        await db.setting.upsert({
          where: { key: 'staff_receipt_counter' },
          update: { value: String(counter) },
          create: { key: 'staff_receipt_counter', value: String(counter) },
        });
        receiptNumber = `STF-${counter}`;
      } catch {
        receiptNumber = `STF-${Date.now()}`;
      }
    }

    const paymentType = body.paymentType || body.payment_type || null;
    const paymentLabel = body.paymentLabel || body.payment_label || null;
    let noteParts: string[] = [];
    if (paymentLabel) noteParts.push(paymentLabel);
    if (paymentType && paymentType !== 'salary') noteParts.push(`(${paymentType})`);
    if (body.note || body.notes || body.description) noteParts.push(body.note || body.notes || body.description);
    const finalNote = noteParts.join(' - ') || null;

    let payment: any;
    try {
      // استخدم Prisma بدون branchId (لأن الحقل غير موجود في schema المحلي للمستخدم)
      payment = await (db as any).staffPayment.create({
        data: {
          staffName,
          staffRole: staffRole || null,
          amount,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
          month: body.month || body.paymentMonth || null,
          note: finalNote,
          receiptNumber,
          isCancelled: false,
        },
      });

      // أضف branchId عبر raw SQL (لأن Prisma Client لا يعرفه)
      const newBranchId = await getBranchIdForNewRecord();
      if (newBranchId) {
        try {
          await db.$executeRaw`UPDATE "StaffPayment" SET "branchId" = ${newBranchId} WHERE "id" = ${payment.id}`;
        } catch (e: any) {
          console.error('Failed to set branchId on StaffPayment:', e.message);
        }
      }
    } catch (err: any) {
      console.error('StaffPayment model error:', err);
      return NextResponse.json(
        { error: 'فشل إنشاء السجل: ' + (err.message || '') },
        { status: 500 }
      );
    }

    try {
      await db.activityLog.create({
        data: {
          userId: user.id,
          userName: user.name,
          action: 'create',
          module: 'finance',
          description: `صرف راتب لموظف: ${staffName} - ${amount} دج`,
          targetType: 'staff_payment',
          targetId: payment.id,
        },
      });
    } catch (e) {}

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/finance/staff-payments error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
