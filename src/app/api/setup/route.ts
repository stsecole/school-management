import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET() {
  const prisma = new PrismaClient();
  try {
    // 1. ابحث عن المستخدم
    const user = await prisma.user.findUnique({ where: { username: 'admin' } });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. تحقق من كلمة المرور
    const passwordValid = await bcrypt.compare('admin123', user.password);
    
    // 3. اعرض النتيجة
    return NextResponse.json({
      success: true,
      user_found: true,
      user: { id: user.id, username: user.username, role: user.role },
      password_correct: passwordValid,
      hash_in_db: user.password.substring(0, 20) + '...',
      hint: passwordValid ? 'كلمة المرور صحيحة! المشكلة في كود الجلسة (Session/Cookie)' : 'كلمة المرور خاطئة! يجب تحديث الـ hash'
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}