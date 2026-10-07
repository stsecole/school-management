import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// القيم الافتراضية لإعدادات الوصل
const DEFAULTS: Record<string, string> = {
  receipt_school_name: 'مدرسة السلامة',
  receipt_address: '',
  receipt_phone: '',
  receipt_logo_url: '',
  receipt_primary_color: '#1e3a5f',
  receipt_secondary_color: '#2c5282',
  receipt_accent_color: '#16a34a',
  receipt_footer_text: 'مدرسة السلامة - جميع الحقوق محفوظة',
  receipt_show_logo: 'true',
};

/**
 * GET /api/receipt-settings
 * (أي مستخدم مصادق عليه)
 * يعيد إعدادات الوصل مع القيم الافتراضية عند عدم وجودها
 */
export async function GET() {
  try {
    await requireAuth();
    const settings = await db.setting.findMany({
      where: { key: { startsWith: 'receipt_' } },
    });
    const map: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return NextResponse.json({ settings: map });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/receipt-settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * PUT /api/receipt-settings
 * (المدير فقط)
 * يحفظ إعدادات الوصل في جدول Setting
 */
export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    // المفاتيح المسموح بحفظها فقط
    const allowedKeys = Object.keys(DEFAULTS);
    const updates: Array<{ key: string; value: string }> = [];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates.push({ key, value: String(body[key]) });
      }
    }

    // حفظ كل إعداد عبر upsert
    for (const { key, value } of updates) {
      await db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // إعادة الإعدادات بعد الحفظ
    const settings = await db.setting.findMany({
      where: { key: { startsWith: 'receipt_' } },
    });
    const map: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json({ message: 'تم حفظ إعدادات الوصل', settings: map });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('PUT /api/receipt-settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الحفظ' }, { status: 500 });
  }
}
