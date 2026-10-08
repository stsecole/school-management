import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // كلمة المرور المشفّرة لـ "admin123"
    const hashedPassword = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    // تأكد من وجود الجداول، ثم أنشئ المدير
    const admin = await db.user.upsert({
      where: { username: 'admin' },
      update: { password: hashedPassword, role: 'director', name: 'المدير العام' },
      create: {
        id: 'admin_001',
        username: 'admin',
        password: hashedPassword,
        name: 'المدير العام',
        role: 'director',
      },
    });

    return NextResponse.json({
      success: true,
      message: '✅ تم إنشاء حساب المدير بنجاح!',
      credentials: {
        username: 'admin',
        password: 'admin123',
      },
      user: { id: admin.id, name: admin.name, role: admin.role },
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        hint: "إذا فشل، تأكد من تشغيل 'npx prisma db push' لإنشاء الجداول أولاً"
      },
      { status: 500 }
    );
  }
}