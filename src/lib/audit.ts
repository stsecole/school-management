import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';

interface AuditLogOptions {
  user: SessionUser;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'finance' | 'export' | 'import' | 'backup' | 'system';
  module: 'students' | 'teachers' | 'finance' | 'users' | 'attendance' | 'tasks' | 'departments' | 'registrations' | 'timetable' | 'timesheet' | 'messages' | 'backup' | 'system' | 'reports';
  description: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * تسجيل نشاط في سجل المراجعة (Audit Log)
 * يُستخدم بعد كل عملية حساسة (إضافة/تعديل/حذف/دخول)
 */
export async function logActivity(options: AuditLogOptions): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: options.user.id,
        userName: options.user.name,
        userRole: options.user.role,
        action: options.action,
        module: options.module,
        description: options.description,
        entityId: options.entityId || null,
        entityType: options.entityType || null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (e) {
    // لا نفشل العملية الرئيسية إذا فشل التسجيل
    console.error('[AuditLog] Failed to log activity:', e);
  }
}

/**
 * تسجيل دخول مستخدم
 */
export async function logLogin(user: SessionUser, ipAddress?: string): Promise<void> {
  await logActivity({
    user,
    action: 'login',
    module: 'system',
    description: `تسجيل دخول: ${user.name} (${user.username})`,
    ipAddress,
  });
}

/**
 * تسجيل خروج مستخدم
 */
export async function logLogout(user: SessionUser): Promise<void> {
  await logActivity({
    user,
    action: 'logout',
    module: 'system',
    description: `تسجيل خروج: ${user.name} (${user.username})`,
  });
}

/**
 * وصف العملية بالعربية
 */
export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'إضافة',
    update: 'تعديل',
    delete: 'حذف',
    login: 'دخول',
    logout: 'خروج',
    finance: 'مالي',
    export: 'تصدير',
    import: 'استيراد',
    backup: 'نسخ احتياطي',
    system: 'نظام',
  };
  return labels[action] || action;
}

/**
 * وصف الوحدة بالعربية
 */
export function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    students: 'الطلاب',
    teachers: 'الأساتذة',
    finance: 'القسم المالي',
    users: 'إدارة الحسابات',
    attendance: 'الحضور',
    tasks: 'المهام',
    departments: 'الأقسام',
    registrations: 'التسجيلات',
    timetable: 'الجدول الأسبوعي',
    timesheet: 'حضور الموظفين',
    messages: 'الرسائل',
    backup: 'النسخ الاحتياطي',
    system: 'النظام',
    reports: 'التقارير',
  };
  return labels[module] || module;
}

/**
 * لون العملية (للواجهة)
 */
export function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    update: 'bg-blue-100 text-blue-700 border-blue-300',
    delete: 'bg-red-100 text-red-700 border-red-300',
    login: 'bg-purple-100 text-purple-700 border-purple-300',
    logout: 'bg-gray-100 text-gray-700 border-gray-300',
    finance: 'bg-amber-100 text-amber-700 border-amber-300',
    export: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    import: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    backup: 'bg-orange-100 text-orange-700 border-orange-300',
    system: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  return colors[action] || 'bg-gray-100 text-gray-700 border-gray-300';
}

/**
 * أيقونة العملية (للواجهة)
 */
export function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    login: '🔑',
    logout: '🚪',
    finance: '💰',
    export: '📤',
    import: '📥',
    backup: '💾',
    system: '⚙️',
  };
  return icons[action] || '📋';
}
