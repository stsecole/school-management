import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireDirector } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/whatsapp';

/**
 * GET /api/whatsapp/settings
 */
export async function GET() {
  try {
    await requireAuth();
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('[WhatsApp] GET settings error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}

/**
 * PUT /api/whatsapp/settings — تعديل الإعدادات للمدير فقط
 */
export async function PUT(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    await saveSettings(body);
    const settings = await getSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'تعديل إعدادات الواتساب متاح للمدير فقط' }, { status: 403 });
    }
    console.error('[WhatsApp] PUT settings error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
