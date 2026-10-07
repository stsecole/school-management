import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';

// GET /api/school-branches - any authenticated user can list school branches
export async function GET() {
  try {
    await requireAuth();
    const branches = await db.schoolBranch.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ schoolBranches: branches });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/school-branches error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST /api/school-branches - director only can create new school branch
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'اسم الشعبة مطلوب' }, { status: 400 });
    }

    const name = body.name.trim();

    // Check for duplicates (case-insensitive)
    const existing = await db.schoolBranch.findFirst({
      where: { name: { contains: name } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'توجد شعبة بنفس الاسم مسبقاً' },
        { status: 400 }
      );
    }

    const branch = await db.schoolBranch.create({
      data: { name },
    });
    return NextResponse.json({ schoolBranch: branch }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'غير مصرح - يلزم صلاحية المدير' }, { status: 403 });
    }
    console.error('POST /api/school-branches error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 });
  }
}
