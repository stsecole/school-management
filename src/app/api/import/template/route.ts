import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as XLSX from 'xlsx';

/**
 * GET /api/import/template?type=students|payments|attendance
 * تصدير قالب Excel فارغ مع الأعمدة المطلوبة
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'students';

    let headers: string[] = [];
    let sampleRow: any = {};
    let fileName = '';

    if (type === 'students') {
      headers = ['الاسم واللقب', 'الهاتف', 'الجنس', 'البريد الإلكتروني', 'القسم', 'المستوى', 'التخصص', 'الرقم الجامعي', 'تاريخ الميلاد', 'العنوان', 'الحالة'];
      sampleRow = {
        'الاسم واللقب': 'أحمد بن محمد',
        'الهاتف': '0551234567',
        'الجنس': 'ذكر',
        'البريد الإلكتروني': 'ahmed@example.com',
        'القسم': 'التقني سامي',
        'المستوى': 'متوسط - مستوى ثاني',
        'التخصص': 'صيدلة',
        'الرقم الجامعي': 'STU-2026-001',
        'تاريخ الميلاد': '2000-01-15',
        'العنوان': 'الجزائر العاصمة',
        'الحالة': 'registered',
      };
      fileName = 'students-template.xlsx';
    } else if (type === 'payments') {
      headers = ['اسم الطالب', 'الرقم الجامعي', 'المبلغ', 'التاريخ', 'نوع الدفع', 'وصف الدفع', 'طريقة الدفع', 'ملاحظات'];
      sampleRow = {
        'اسم الطالب': 'أحمد بن محمد',
        'الرقم الجامعي': 'STU-2026-001',
        'المبلغ': '2500',
        'التاريخ': '2026-07-04',
        'نوع الدفع': 'installment',
        'وصف الدفع': 'قسط شهر 1',
        'طريقة الدفع': 'cash',
        'ملاحظات': '',
      };
      fileName = 'payments-template.xlsx';
    } else if (type === 'attendance') {
      headers = ['التاريخ', 'اسم المادة', 'الأستاذ', 'الطالب', 'المستوى', 'وقت البداية', 'وقت النهاية', 'عدد الحضور', 'ذكور', 'إناث', 'ملاحظات'];
      sampleRow = {
        'التاريخ': '2026-07-04',
        'اسم المادة': 'اللغة الإنجليزية',
        'الأستاذ': 'أحمد بن علي',
        'الطالب': '',
        'المستوى': '初級 - مستوى أول',
        'وقت البداية': '08:00',
        'وقت النهاية': '10:00',
        'عدد الحضور': '15',
        'ذكور': '8',
        'إناث': '7',
        'ملاحظات': '',
      };
      fileName = 'attendance-template.xlsx';
    } else if (type === 'receipts') {
      headers = ['اسم الطالب', 'الرقم الجامعي', 'المبلغ', 'التاريخ', 'نوع الدفع', 'بيان الوصل', 'طريقة الدفع', 'رقم الوصل', 'ملاحظات'];
      sampleRow = {
        'اسم الطالب': 'أحمد بن محمد',
        'الرقم الجامعي': 'STU-2026-001',
        'المبلغ': '2500',
        'التاريخ': '2026-07-04',
        'نوع الدفع': 'installment',
        'بيان الوصل': 'قسط شهر 1',
        'طريقة الدفع': 'cash',
        'رقم الوصل': '',
        'ملاحظات': '',
      };
      fileName = 'receipts-template.xlsx';
    } else {
      return NextResponse.json({ error: 'نوع غير صالح' }, { status: 400 });
    }

    // أنشئ الـ worksheet
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });

    // اضبط عرض الأعمدة
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));
    (ws as any)['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');

    // أضف ورقة تعليمات
    const instructions = [
      { التعليمات: '📋 هذا ملف قالب للاستيراد. املأ البيانات في ورقة "البيانات".' },
      { التعليمات: '' },
      { التعليمات: '✅ الأعمدة المطلوبة مُشار إليها بعلامة *.' },
      { التعليمات: '📝 الأعمدة الأخرى اختيارية.' },
      { التعليمات: '🌐 يمكنك استخدام أسماء الأعمدة بالعربية أو الإنجليزية.' },
      { التعليمات: '' },
      { التعليمات: '⚠️ تنبيهات:' },
      { التعليمات: '- لا تُغيّر أسماء الأعمدة في الصف الأول.' },
      { التعليمات: '- التواريخ بصيغة: YYYY-MM-DD (مثال: 2026-07-04).' },
      { التعليمات: '- الأرقام بدون مسافات أو رموز.' },
      { التعليمات: '- احذف صف المثال قبل الرفع.' },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(instructions, { header: ['التعليمات'] });
    (wsInfo as any)['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'التعليمات');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/import/template error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
