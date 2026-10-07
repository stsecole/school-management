// ===== GET /api/institution-settings =====
// ===== PUT /api/institution-settings =====
// يدير إعدادات المؤسسة: الشعار، الاسم، الشعار النصي، العنوان، الهاتف، البريد
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDirector } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS = [
  'institution_name',        // اسم المؤسسة
  'institution_tagline',     // الشعار النصي / الوصف المختصر
  'institution_logo_url',    // رابط الشعار
  'institution_address',     // العنوان
  'institution_phone',       // الهاتف
  'institution_email',       // البريد
  'institution_footer',      // نص التذييل
];

const DEFAULTS: Record<string, string> = {
  institution_name: 'نظام إدارة المؤسسة التعليمية',
  institution_tagline: 'منصة الإدارة المتكاملة',
  institution_logo_url: '',
  institution_address: '',
  institution_phone: '',
  institution_email: '',
  institution_footer: '',
};

export async function GET() {
  try {
    await requireAuth();
    const rows = await db.setting.findMany({ where: { key: { in: KEYS } } });
    const result: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) result[r.key] = r.value;
    return NextResponse.json({ settings: result });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('GET /api/institution-settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    // Save each known key
    const updates: Promise<any>[] = [];
    for (const key of KEYS) {
      const value = body[key] !== undefined ? String(body[key]) : '';
      updates.push(
        db.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      );
    }
    await Promise.all(updates);
    return NextResponse.json({ ok: true, message: 'تم حفظ الإعدادات' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'هذه العملية متاحة للمدير فقط' }, { status: 403 });
    }
    console.error('PUT /api/institution-settings error:', error);
    return NextResponse.json({ error: 'حدث خطأ: ' + (error.message || '') }, { status: 500 });
  }
}
