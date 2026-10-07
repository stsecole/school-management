import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    
    // إنشاء سجل مباشرة في قاعدة البيانات
    const log = await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        action: 'create',
        module: 'test',
        description: 'اختبار مباشر للتسجيل - ' + new Date().toLocaleTimeString('fr-FR'),
      }
    });

    const count = await db.activityLog.count();

    return NextResponse.json({ 
      ok: true, 
      message: 'تم إنشاء السجل بنجاح!',
      logId: log.id,
      totalLogs: count
    });
  } catch (error: any) {
    console.error('TEST LOG ERROR:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
}