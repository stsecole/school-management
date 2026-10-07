import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'تم تسجيل الخروج' });
  response.cookies.delete('session');
  return response;
}
