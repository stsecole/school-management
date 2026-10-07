import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const rooms = await db.room.findMany({
      include: { _count: { select: { sessions: true } } },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ rooms });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const room = await db.room.create({
      data: {
        name: body.name,
        code: body.code || null,
        capacity: parseInt(body.capacity) || 30,
        type: body.type || 'classroom',
        building: body.building || null,
        floor: body.floor || null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ room }, { status: 201 });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    console.error('POST room:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
