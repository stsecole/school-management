/**
 * طبقة تسجيل النشاطات (Activity Logger)
 * تستخدم لتسجيل كل العمليات الحساسة في النظام
 */

import { db } from '@/lib/db';

export interface LogEntry {
  userId?: string;
  userName?: string;
  action: string; // 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'import' | 'print'
  module: string; // 'students' | 'finance' | 'attendance' | إلخ
  description: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * تسجيل نشاط في قاعدة البيانات
 */
export async function logActivity(entry: LogEntry): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: entry.userId || null,
        userName: entry.userName || null,
        action: entry.action,
        module: entry.module,
        description: entry.description,
        targetType: entry.targetType || null,
        targetId: entry.targetId || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    });
  } catch (e) {
    // لا نفشل العملية إذا فشل التسجيل
    console.error('[ActivityLog] Failed to log:', e);
  }
}

/**
 * قاموس تسمية العمليات بالعربية
 */
export const actionLabels: Record<string, string> = {
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  export: 'تصدير',
  import: 'استيراد',
  print: 'طباعة',
  view: 'عرض',
  verify: 'تحقق',
};

export const moduleLabels: Record<string, string> = {
  students: 'الطلاب',
  teachers: 'الأساتذة',
  departments: 'الأقسام',
  registrations: 'التسجيلات',
  attendance: 'الحضور',
  tasks: 'المهام',
  finance: 'المالية',
  users: 'المستخدمون',
  timetable: 'الجدول الأسبوعي',
  timesheet: 'حضور الموظفين',
  reports: 'التقارير',
  backup: 'النسخ الاحتياطي',
  exams: 'التقييمات',
  crm: 'العملاء المحتملون',
  whatsapp: 'الرسائل',
  notifications: 'الإشعارات',
  calendar: 'التقويم',
  archive: 'الأرشيف',
  permissions: 'الصلاحيات',
  system: 'النظام',
  auth: 'المصادقة',
};

export const actionColors: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-700',
  export: 'bg-cyan-100 text-cyan-700',
  import: 'bg-amber-100 text-amber-700',
  print: 'bg-indigo-100 text-indigo-700',
  view: 'bg-gray-100 text-gray-600',
  verify: 'bg-teal-100 text-teal-700',
};
