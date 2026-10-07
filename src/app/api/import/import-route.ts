import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// POST /api/import - import data from Excel file
// Body: { file: base64-encoded xlsx, type: 'students'|'teachers'|'tasks'|'attendance'|'registrations' }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { file, type, sheetName } = body;

    if (!file || !type) {
      return NextResponse.json({ error: 'الملف والنوع مطلوبان' }, { status: 400 });
    }

    // Dynamic import to keep this endpoint light
    const xlsx = await import('xlsx');
    const buffer = Buffer.from(file, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer' });

    const sheet = sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: 'الورقة غير موجودة' }, { status: 400 });
    }

    const rows = xlsx.utils.sheet_to_json<any>(sheet, { header: 1 });
    if (rows.length < 2) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }

    return NextResponse.json({
      message: 'تم قراءة الملف بنجاح',
      rows: rows.slice(0, 100), // preview first 100 rows
      totalRows: rows.length,
      sheetNames: wb.SheetNames,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستيراد' }, { status: 500 });
  }
}
