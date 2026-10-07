import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { sendMessage, fillTemplate } from '@/lib/whatsapp';

/**
 * POST /api/whatsapp/bulk
 * إرسال رسائل جماعية
 * body: {
 *   recipients: [{ name, phone, variables? }],
 *   templateName?: string,  // إن استخدمت قالب
 *   message?: string,       // إن كانت رسالة مباشرة
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { recipients, templateName, message } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'قائمة المستلمين مطلوبة' }, { status: 400 });
    }

    if (recipients.length > 100) {
      return NextResponse.json({ error: 'الحد الأقصى 100 رسالة في المرة الواحدة' }, { status: 400 });
    }

    // إن استخدمت قالب، اجلب القالب
    let template: any = null;
    if (templateName) {
      template = await db.whatsAppTemplate.findUnique({ where: { name: templateName } });
      if (!template) {
        return NextResponse.json({ error: 'القالب غير موجود' }, { status: 404 });
      }
    }

    const results: any[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const r of recipients) {
      let msgText = message || '';
      if (template) {
        msgText = fillTemplate(template.body, {
          name: r.name || '',
          amount: r.amount || '',
          date: r.date || '',
          department: r.department || '',
          month: r.month || '',
          message: r.message || '',
          senderName: 'مدرسة السلامة',
          ...r.variables,
        });
      }

      const result = await sendMessage(r.phone, msgText, {
        recipientName: r.name,
        templateName: templateName || undefined,
        sentBy: user.name,
      });

      if (result.ok) sentCount++;
      else failedCount++;

      results.push({
        name: r.name,
        phone: r.phone,
        ok: result.ok,
        link: result.link,
        error: result.error,
      });

      // تأخير بسيط بين الرسائل لتجنّب الحظر
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: failedCount,
      total: recipients.length,
      results,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/whatsapp/bulk error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم: ' + (error.message || '') }, { status: 500 });
  }
}
