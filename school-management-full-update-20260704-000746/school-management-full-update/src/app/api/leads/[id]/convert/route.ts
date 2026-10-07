import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST /api/leads/[id]/convert - تحويل العميل المحتمل إلى طالب مسجّل
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }
    if (lead.convertedToStudentId) {
      return NextResponse.json(
        { error: 'تم تحويل هذا العميل مسبقاً' },
        { status: 400 }
      );
    }

    // توليد رقم الطالب تلقائياً
    const count = await db.student.count();
    const studentNumber = `STU-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    // إنشاء سجل الطالب بنسخ البيانات الأساسية
    const student = await db.student.create({
      data: {
        studentNumber,
        name: lead.fullName,
        email: lead.email || null,
        phone: lead.phone,
        gender: lead.gender || null,
        birthDate: lead.birthDate || null,
        address: [lead.address, lead.baladia, lead.wilaya]
          .filter(Boolean)
          .join(' - ') || null,
        departmentId: body.departmentId || null,
        levelId: body.levelId || null,
        specializationId: body.specializationId || null,
        registrationDate: new Date(),
        status: 'registered',
        notes: `تم التحويل من العميل المحتمل - التخصص المطلوب: ${lead.desiredCourse || '-'}`.substring(0, 500),
      },
    });

    // تحديث العميل ليعكس التحويل
    await db.lead.update({
      where: { id },
      data: {
        convertedToStudentId: student.id,
        convertedAt: new Date(),
        status: 'registered',
        lastModifiedBy: user.name,
      },
    });

    return NextResponse.json({ studentId: student.id, student }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('POST /api/leads/[id]/convert error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحويل' }, { status: 500 });
  }
}
