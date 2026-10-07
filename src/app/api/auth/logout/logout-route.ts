import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const user = await requireAuth();
    try { await db.activityLog.create({ data: { userId: user.id, userName: user.name, action: 'logout', module: 'auth', description: 'تسجيل الخروج: ' + user.username } }); } catch (e) {}
    const response = NextResponse.json({ ok: true });
    response.cookies.delete('session');
    return response;
  } catch (error: any) {
    return NextResponse.json({ ok: true });
  }
}
