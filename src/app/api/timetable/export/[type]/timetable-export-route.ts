import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';
import * as xlsx from 'xlsx';
import { getDayName } from '@/lib/timetable/conflict-engine';

// GET /api/timetable/export/[type]?view=week|teacher|room|group|subject&id=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    await requireDirector();
    const { type } = await params;
    const { searchParams } = new URL(request.url);

    if (type !== 'excel') {
      return NextResponse.json({ error: 'نوع تصدير غير معروف' }, { status: 400 });
    }

    const view = searchParams.get('view') || 'week';
    const entityId = searchParams.get('id');

    const where: any = {};
    if (view === 'teacher' && entityId) where.teacherId = entityId;
    if (view === 'room' && entityId) where.roomId = entityId;
    if (view === 'group' && entityId) where.groupId = entityId;
    if (view === 'subject' && entityId) where.subjectId = entityId;
    if (view === 'department' && entityId) {
      // Filter sessions whose subject or group belongs to the department
      where.OR = [
        { subject: { departmentId: entityId } },
        { group: { departmentId: entityId } },
      ];
    }

    const sessions = await db.timetableSession.findMany({
      where,
      include: { teacher: true, room: true, group: true, subject: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    const data = sessions.map((s, i) => ({
      '#': i + 1,
      'اليوم': days[s.dayOfWeek] || '',
      'من': s.startTime,
      'إلى': s.endTime,
      'الأستاذ': s.teacherName || '',
      'القاعة': s.roomName || '',
      'الفوج': s.groupName || '',
      'المادة': s.subjectName || '',
      'ملاحظات': s.notes || '',
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'الجدول الأسبوعي');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="timetable.xlsx"`,
      },
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    if (e.message === 'FORBIDDEN') return NextResponse.json({ error: 'التصدير متاح للمدير فقط' }, { status: 403 });
    console.error('export:', e);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
