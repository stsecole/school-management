import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireDirector } from '@/lib/auth';
import * as xlsx from 'xlsx';

// GET /api/export/[type] - export data to Excel
// Director only: export is a sensitive operation (financial data, full lists)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    await requireDirector();
    const { type } = await params;
    const { searchParams } = new URL(request.url);

    let wb = xlsx.utils.book_new();
    let filename = '';

    switch (type) {
      case 'students': {
        const students = await db.student.findMany({
          include: { department: true, level: true },
          orderBy: { createdAt: 'desc' },
        });
        const data = students.map((s, i) => ({
          '#': i + 1,
          'رقم الطالب': s.studentNumber || '',
          'الاسم واللقب': s.name,
          'الجنس': s.gender || '',
          'الهاتف': s.phone || '',
          'البريد': s.email || '',
          'القسم': s.department?.name || '',
          'المستوى': s.level?.name || '',
          'الشعبة': s.section || '',
          'التخصص': s.specialty || '',
          'الكلية': s.college || '',
          'تاريخ التسجيل': s.registrationDate.toISOString().split('T')[0],
          'الحالة': s.status === 'active' ? 'نشط' : s.status === 'graduated' ? 'متخرج' : 'غير نشط',
          'ملاحظات': s.notes || '',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'الطلاب');
        filename = 'الطلاب.xlsx';
        break;
      }
      case 'teachers': {
        const teachers = await db.teacher.findMany({
          include: { department: true },
          orderBy: { createdAt: 'desc' },
        });
        const data = teachers.map((t, i) => ({
          '#': i + 1,
          'الاسم': t.name,
          'التخصص': t.specialty || '',
          'القسم': t.department?.name || '',
          'الهاتف': t.phone || '',
          'البريد': t.email || '',
          'الجنس': t.gender || '',
          'الراتب': t.salary,
          'تاريخ التوظيف': t.hireDate ? t.hireDate.toISOString().split('T')[0] : '',
          'الحالة': t.status === 'active' ? 'نشط' : 'غير نشط',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'الأساتذة');
        filename = 'الأساتذة.xlsx';
        break;
      }
      case 'attendance': {
        const attendances = await db.attendance.findMany({
          include: { teacher: true, course: true },
          orderBy: { date: 'desc' },
        });
        const data = attendances.map((a, i) => {
          const mins = a.durationMinutes || 0;
          const hours = Math.floor(mins / 60);
          const minutes = mins % 60;
          const durationStr = hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;
          return {
            '#': i + 1,
            'التاريخ': a.date.toISOString().split('T')[0],
            'المادة': a.courseName,
            'المستوى': a.level || '',
            'وقت البداية': a.startTime || '',
            'وقت النهاية': a.endTime || '',
            'التوقيت': a.timeSlot || '',
            'الأستاذ': a.teacherName || a.teacher?.name || '',
            'عدد الحضور الإجمالي': a.totalCount,
            'ذكر': a.maleCount,
            'أنثى': a.femaleCount,
            'المدة (دقائق)': mins,
            'المدة': durationStr,
            'لم يدفع': a.unpaidCount,
            'ملاحظات': a.notes || '',
          };
        });
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'الحضور');
        filename = 'الحضور.xlsx';
        break;
      }
      case 'tasks': {
        const tasks = await db.task.findMany({ orderBy: { createdAt: 'desc' } });
        const data = tasks.map((t, i) => ({
          '#': i + 1,
          'المهام': t.title,
          'الأولوية': t.priorityLabel || '',
          'المسؤول': t.responsible || '',
          'تاريخ البدأ': t.startDate ? t.startDate.toISOString().split('T')[0] : '',
          'الأجال': t.deadline ? t.deadline.toISOString().split('T')[0] : '',
          'إكتمال': t.completed ? '√' : '',
          'الحالة': t.statusValue,
          'ملاحظات': t.notes || '',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'المهام');
        filename = 'المهام.xlsx';
        break;
      }
      case 'student-payments': {
        const authed = await checkFinanceAuth();
        if (!authed) {
          return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        const payments = await db.studentPayment.findMany({
          include: { student: { include: { department: true } } },
          orderBy: { paymentDate: 'desc' },
        });
        const data = payments.map((p, i) => ({
          '#': i + 1,
          'رقم الوصل': p.receiptNumber,
          'التاريخ': p.paymentDate.toISOString().split('T')[0],
          'اسم الطالب': p.student.name,
          'رقم الطالب': p.student.studentNumber || '',
          'القسم': p.student.department?.name || '',
          'نوع الدفعة': p.paymentLabel || '',
          'المبلغ': p.amount,
          'طريقة الدفع': p.paymentMethod === 'cash' ? 'نقدا' : p.paymentMethod === 'transfer' ? 'تحويل' : 'شيك',
          'ملاحظات': p.notes || '',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'مدفوعات الطلاب');
        filename = 'مدفوعات_الطلاب.xlsx';
        break;
      }
      case 'teacher-payments': {
        const authed = await checkFinanceAuth();
        if (!authed) {
          return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        const payments = await db.teacherPayment.findMany({
          include: { teacher: { include: { department: true } } },
          orderBy: { paymentDate: 'desc' },
        });
        const data = payments.map((p, i) => ({
          '#': i + 1,
          'رقم الوصل': p.receiptNumber,
          'التاريخ': p.paymentDate.toISOString().split('T')[0],
          'اسم الأستاذ': p.teacher.name,
          'القسم': p.teacher.department?.name || '',
          'الشهر': p.month,
          'نوع الدفعة': p.paymentLabel || '',
          'المبلغ': p.amount,
          'ملاحظات': p.notes || '',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'مدفوعات الأساتذة');
        filename = 'مدفوعات_الأساتذة.xlsx';
        break;
      }
      case 'registrations': {
        const regs = await db.registration.findMany({
          include: { student: { include: { department: true } } },
          orderBy: { date: 'desc' },
        });
        const data = regs.map((r, i) => ({
          '#': i + 1,
          'التاريخ': r.date.toISOString().split('T')[0],
          'الاسم واللقب': r.student.name,
          'رقم الطالب': r.student.studentNumber || '',
          'الدورة': r.courseName,
          'التخصص': r.specialty || '',
          'المستوى': r.level || '',
          'ملاحظة': r.note || '',
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'التسجيلات');
        filename = 'التسجيلات.xlsx';
        break;
      }
      case 'expenses': {
        const authed = await checkFinanceAuth();
        if (!authed) {
          return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        const expenses = await db.expense.findMany({ orderBy: { date: 'desc' } });
        const data = expenses.map((e, i) => ({
          '#': i + 1,
          'التاريخ': e.date.toISOString().split('T')[0],
          'النوع': e.type,
          'الوصف': e.description || '',
          'المبلغ': e.amount,
        }));
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'المصاريف الثانوية');
        filename = 'المصاريف_الثانوية.xlsx';
        break;
      }
      default:
        return NextResponse.json({ error: 'نوع تصدير غير معروف' }, { status: 400 });
    }

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'التصدير متاح للمدير فقط' }, { status: 403 });
    }
    console.error('Export error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التصدير' }, { status: 500 });
  }
}
