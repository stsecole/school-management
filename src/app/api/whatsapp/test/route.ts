// ===== POST /api/whatsapp/test — اختبار اتصال WhatsApp Cloud API =====
import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';
import { testCloudApiSettings } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  try {
    await requireDirector();
    const result = await testCloudApiSettings();
    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ ok: false, message: 'الاختبار متاح للمدير فقط' }, { status: 403 });
    }
    console.error('[WhatsApp] test error:', error);
    return NextResponse.json({ ok: false, message: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
