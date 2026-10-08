import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET() {
  const prisma = new PrismaClient();
  try {
    const plainPassword = 'admin123';
    
    // 1. توليد كلمة مرور مشفّرة جديدة وصحيحة
    const salt = await bcrypt.genSalt(10);
    const correctHash = await bcrypt.hash(plainPassword, salt);

    // 2. تحديث حساب المدير بكلمة المرور الجديدة الصحيحة
    const admin = await prisma.user.update({
      where: { username: 'admin' },
      data: { password: correctHash },
    });

    // 3. التحقق أنها تعمل
    const isValid = await bcrypt.compare(plainPassword, admin.password);

    return NextResponse.json({
      success: true,
      message: '✅ تم تحديث كلمة المرور بنجاح!',
      new_hash: correctHash,
      verification: isValid ? 'كلمة المرور صحيحة وتعمل!' : 'فشل التحقق',
      credentials: {
        username: 'admin',
        password: 'admin123',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}