/**
 * نظام الصلاحيات الشامل (RBAC)
 * يتحكم في وصول المستخدمين للأقسام والعمليات
 */

import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';

// ===== تعريف الأقسام المتاحة =====
export interface SectionDef {
  id: string;
  label: string;
  icon: string;
  category: 'core' | 'academic' | 'finance' | 'communication' | 'admin';
}

export const SECTIONS: SectionDef[] = [
  // أساسية
  { id: 'dashboard', label: 'لوحة التحكم', icon: 'LayoutDashboard', category: 'core' },
  { id: 'interactive-dashboard', label: 'لوحات تفاعلية', icon: 'BarChart3', category: 'core' },
  { id: 'operations', label: 'مركز العمليات', icon: 'Zap', category: 'core' },
  // أكاديمية
  { id: 'students', label: 'الطلاب', icon: 'Users', category: 'academic' },
  { id: 'teachers', label: 'الأساتذة', icon: 'GraduationCap', category: 'academic' },
  { id: 'departments', label: 'الأقسام', icon: 'BookOpen', category: 'academic' },
  { id: 'registrations', label: 'التسجيلات', icon: 'ClipboardList', category: 'academic' },
  { id: 'attendance', label: 'الحضور', icon: 'CalendarCheck', category: 'academic' },
  { id: 'exams', label: 'التقييمات', icon: 'ClipboardList', category: 'academic' },
  { id: 'report-cards', label: 'بطاقات النتائج', icon: 'Award', category: 'academic' },
  { id: 'timetable', label: 'الجدول الأسبوعي', icon: 'Calendar', category: 'academic' },
  { id: 'tasks', label: 'متابعة المهام', icon: 'ListTodo', category: 'academic' },
  // مالية
  { id: 'finance', label: 'القسم المالي', icon: 'Wallet', category: 'finance' },
  { id: 'reports', label: 'التقارير', icon: 'BarChart3', category: 'finance' },
  // تواصل
  { id: 'crm', label: 'العملاء المحتملون', icon: 'UserPlus', category: 'communication' },
  { id: 'whatsapp', label: 'الرسائل والتنبيهات', icon: 'MessageCircle', category: 'communication' },
  { id: 'messages', label: 'الرسائل الداخلية', icon: 'Mail', category: 'communication' },
  { id: 'notifications', label: 'الإشعارات', icon: 'Bell', category: 'communication' },
  { id: 'calendar', label: 'التقويم الزمني', icon: 'Calendar', category: 'communication' },
  { id: 'ai-assistant', label: 'المساعد الذكي', icon: 'Sparkles', category: 'communication' },
  // إدارة
  { id: 'timesheet', label: 'حضور الموظفين', icon: 'Clock', category: 'admin' },
  { id: 'import', label: 'استيراد البيانات', icon: 'FileSpreadsheet', category: 'admin' },
  { id: 'student-cards', label: 'بطاقات الهوية', icon: 'IdCard', category: 'admin' },
  { id: 'archive', label: 'الأرشيف', icon: 'Archive', category: 'admin' },
  { id: 'branches', label: 'الفروع', icon: 'Building2', category: 'admin' },
  { id: 'institution-settings', label: 'إعدادات المؤسسة', icon: 'Building2', category: 'admin' },
  { id: 'users', label: 'إدارة الحسابات', icon: 'UserCog', category: 'admin' },
  { id: 'permissions', label: 'الصلاحيات', icon: 'Shield', category: 'admin' },
  { id: 'activity-log', label: 'سجل التغييرات', icon: 'History', category: 'admin' },
  { id: 'backup', label: 'النسخ الاحتياطي', icon: 'Database', category: 'admin' },
  { id: 'ai-settings', label: 'إعدادات AI', icon: 'Settings', category: 'admin' },
];

// ===== الأدوار الافتراضية =====
export const DEFAULT_ROLES = [
  {
    name: 'مدير عام',
    description: 'صلاحيات كاملة على كل النظام',
    isSystem: true,
    permissions: SECTIONS.map(s => ({
      section: s.id,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    })),
  },
  {
    name: 'موظف استقبال',
    description: 'إدارة التسجيلات والعملاء المحتملين',
    isSystem: true,
    permissions: SECTIONS.filter(s =>
      ['dashboard', 'students', 'registrations', 'crm', 'whatsapp', 'messages', 'notifications', 'calendar', 'attendance', 'tasks'].includes(s.id)
    ).map(s => ({
      section: s.id,
      canView: true,
      canCreate: true,
      canEdit: ['students', 'registrations', 'crm'].includes(s.id),
      canDelete: false,
    })),
  },
  {
    name: 'محاسب',
    description: 'إدارة القسم المالي فقط',
    isSystem: true,
    permissions: SECTIONS.filter(s =>
      ['dashboard', 'finance', 'reports', 'students', 'messages', 'notifications', 'calendar'].includes(s.id)
    ).map(s => ({
      section: s.id,
      canView: true,
      canCreate: ['finance', 'reports'].includes(s.id),
      canEdit: ['finance'].includes(s.id),
      canDelete: ['finance'].includes(s.id),
    })),
  },
  {
    name: 'أستاذ',
    description: 'عرض الطلاب والحضور والمهام الخاصة به',
    isSystem: true,
    permissions: SECTIONS.filter(s =>
      ['dashboard', 'students', 'attendance', 'tasks', 'exams', 'messages', 'notifications', 'calendar'].includes(s.id)
    ).map(s => ({
      section: s.id,
      canView: true,
      canCreate: ['attendance', 'exams', 'tasks'].includes(s.id),
      canEdit: ['attendance', 'exams'].includes(s.id),
      canDelete: false,
    })),
  },
  {
    name: 'موظف عادي',
    description: 'صلاحيات محدودة',
    isSystem: true,
    permissions: SECTIONS.filter(s =>
      ['dashboard', 'messages', 'notifications', 'calendar'].includes(s.id)
    ).map(s => ({
      section: s.id,
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    })),
  },
];

// ===== واجهة الصلاحية =====
export interface Permission {
  section: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserPermissions {
  role: string;
  roleName: string;
  permissions: Record<string, Permission>;
  isSystemRole: boolean;
}

// ===== دوال التحقق =====

/**
 * يقرأ صلاحيات المستخدم من قاعدة البيانات
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  // ابحث عن المستخدم مع دوره
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      userRole: {
        include: { permissions: true },
      },
    },
  });

  if (!user) {
    return { role: 'employee', roleName: 'موظف عادي', permissions: {}, isSystemRole: true };
  }

  // المدير العام له كل الصلاحيات دائماً (بغض النظر عن roleId)
  if (user.role === 'director') {
    const allPerms: Record<string, Permission> = {};
    for (const s of SECTIONS) {
      allPerms[s.id] = { section: s.id, canView: true, canCreate: true, canEdit: true, canDelete: true };
    }
    return { role: 'director', roleName: 'مدير عام', permissions: allPerms, isSystemRole: true };
  }

  // إن كان لديه دور مخصص
  if (user.userRole) {
    const perms: Record<string, Permission> = {};
    for (const p of user.userRole.permissions) {
      perms[p.section] = {
        section: p.section,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      };
    }
    return {
      role: user.role,
      roleName: user.userRole.name,
      permissions: perms,
      isSystemRole: user.userRole.isSystem,
    };
  }

  // افتراضي: موظف عادي — استخدم صلاحيات الدور الافتراضي
  const defaultEmpRole = DEFAULT_ROLES.find(r => r.name === 'موظف عادي');
  const perms: Record<string, Permission> = {};
  if (defaultEmpRole) {
    for (const p of defaultEmpRole.permissions) {
      perms[p.section] = {
        section: p.section,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      };
    }
  }
  return { role: 'employee', roleName: 'موظف عادي', permissions: perms, isSystemRole: true };
}

/**
 * تحقّق من صلاحية الوصول لقسم
 */
export function canAccess(permissions: UserPermissions, section: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean {
  // المدير العام
  if (permissions.role === 'director' && permissions.isSystemRole) return true;

  const perm = permissions.permissions[section];
  if (!perm) return false;

  switch (action) {
    case 'view': return perm.canView;
    case 'create': return perm.canCreate;
    case 'edit': return perm.canEdit;
    case 'delete': return perm.canDelete;
    default: return false;
  }
}

/**
 * يُرجع قائمة الأقسام المسموح للمستخدم برؤيتها
 */
export function getAllowedSections(permissions: UserPermissions): string[] {
  if (permissions.role === 'director' && permissions.isSystemRole) {
    return SECTIONS.map(s => s.id);
  }
  return Object.values(permissions.permissions)
    .filter(p => p.canView)
    .map(p => p.section);
}

/**
 * تهيئة الأدوار الافتراضية (يُشغّل مرة واحدة)
 */
export async function initializeDefaultRoles(): Promise<void> {
  const existing = await db.role.count();
  if (existing > 0) return; // سبق التهيئة

  for (const role of DEFAULT_ROLES) {
    const created = await db.role.create({
      data: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });

    for (const perm of role.permissions) {
      await db.rolePermission.create({
        data: {
          roleId: created.id,
          section: perm.section,
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
        },
      });
    }
  }
  console.log('[Permissions] Default roles initialized');
}
