
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET() {
  // 1. اختبار وجود متغير البيئة
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL is missing in Vercel!' }, { status: 500 });
  }

  // 2. محاولة الاتصال بقاعدة البيانات
  const prisma = new PrismaClient();
  try {
    // محاولة بسيطة لجلب المستخدمين
    const users = await prisma.user.findMany();
    
    return NextResponse.json({
      success: true,
      message: 'الاتصال ناجح!',
      users_count: users.length,
      users: users.map(u => ({ username: u.username, role: u.role }))
    });
  } catch (error: any) {
    // إظهار الخطأ الحقيقي
    return NextResponse.json(
      { 
        error: error.message,
        code: error.code,
        stack: error.stack
      }, 
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}