import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { ReceiptPrintClient } from './receipt-print-client';

// Server Component - fetches data on the server so the HTML is complete
// before the browser renders (fixes empty PDF issue when printing).
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam } = await searchParams;
  const type = typeParam === 'teacher' ? 'teacher' : 'student';

  // Auth check - any logged-in user can print student receipts
  const user = await getSession();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 text-lg font-bold">غير مصرح</p>
      </div>
    );
  }

  // Teacher receipts are director-only
  if (type === 'teacher' && user.role !== 'director') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 text-lg font-bold">وصولات الأساتذة متاحة للمدير فقط</p>
      </div>
    );
  }

  const schoolSetting = await db.setting.findUnique({ where: { key: 'school_name' } });
  const schoolName = schoolSetting?.value || 'مدرسة السلامة';

  let receipt: {
    receiptNumber: string;
    date: string;
    name: string;
    studentNumber?: string;
    department?: string;
    level?: string;
    amount: number;
    label: string;
    month?: string;
    paymentMethod?: string;
    notes?: string;
    type: 'student' | 'teacher';
    schoolName: string;
  };

  try {
    if (type === 'student') {
      const payment = await db.studentPayment.findUnique({
        where: { id },
        include: { student: { include: { department: true, level: true } } },
      });
      if (!payment) notFound();
      receipt = {
        receiptNumber: payment.receiptNumber,
        date: payment.paymentDate.toISOString(),
        name: payment.student.name,
        studentNumber: payment.student.studentNumber || undefined,
        department: payment.student.department?.name || undefined,
        level: payment.student.level?.name || undefined,
        amount: payment.amount,
        label: payment.paymentLabel,
        paymentMethod: payment.paymentMethod || undefined,
        notes: payment.notes || undefined,
        type: 'student',
        schoolName,
      };
    } else {
      const payment = await db.teacherPayment.findUnique({
        where: { id },
        include: { teacher: { include: { department: true } } },
      });
      if (!payment) notFound();
      receipt = {
        receiptNumber: payment.receiptNumber,
        date: payment.paymentDate.toISOString(),
        name: payment.teacher.name,
        department: payment.teacher.department?.name || undefined,
        amount: payment.amount,
        month: payment.month,
        label: payment.paymentLabel,
        notes: payment.notes || undefined,
        type: 'teacher',
        schoolName,
      };
    }
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 text-lg font-bold">تعذر تحميل الوصل</p>
      </div>
    );
  }

  return <ReceiptPrintClient receipt={receipt} />;
}
