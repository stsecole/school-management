// ===== GET /api/students/search?q=xxx =====
// البحث في الطلاب المسجلين (للاستخدام في autocomplete)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 1) {
      return NextResponse.json({ students: [] });
    }

    let students: any[] = [];
    try {
      // محاولة Prisma
      students = await db.student.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { studentNumber: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          studentNumber: true,
          phone: true,
          departmentId: true,
          department: { select: { name: true, code: true } },
          specialization: { select: { name: true } },
          status: true,
        },
        take: 20,
        orderBy: { name: 'asc' },
      });
    } catch (prismaErr: any) {
      // Raw SQL fallback
      try {
        const result = await db.$queryRawUnsafe(
          `SELECT s."id", s."name", s."studentNumber", s."phone", s."departmentId",
                  d."name" as "departmentName", d."code" as "departmentCode",
                  sp."name" as "specializationName", s."status"
           FROM "Student" s
           LEFT JOIN "Department" d ON s."departmentId" = d."id"
           LEFT JOIN "Specialization" sp ON s."specializationId" = sp."id"
           WHERE s."name" LIKE ? OR s."studentNumber" LIKE ? OR s."phone" LIKE ?
           ORDER BY s."name" ASC
           LIMIT 20`,
          `%${q}%`, `%${q}%`, `%${q}%`
        ) as any[];
        students = result.map((s: any) => ({
          id: s.id,
          name: s.name,
          studentNumber: s.studentNumber,
          phone: s.phone,
          departmentId: s.departmentId,
          department: s.departmentName ? { name: s.departmentName, code: s.departmentCode } : null,
          specialization: s.specializationName ? { name: s.specializationName } : null,
          status: s.status,
        }));
      } catch (rawErr: any) {
        console.error('Students search failed:', rawErr.message);
        return NextResponse.json({ students: [], error: rawErr.message });
      }
    }

    return NextResponse.json({ students });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/students/search error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}
