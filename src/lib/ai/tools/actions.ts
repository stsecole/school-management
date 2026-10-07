// ===== أدوات الإجراءات (Actions) للمساعد الذكي =====
// ACTIONS: create_specialization, create_user, create_room, create_notification, delete_student

import { db } from '@/lib/db';
import type { DataContext } from '../context';
import type { ActionBlock } from '../types';

export interface ActionDef {
  action: string;
  label: string;
  description: string;
  requiredParams: string[];
  roles: ('director' | 'employee')[];
  /**
   * ينفّذ الإجراء بعد تأكيد المستخدم.
   */
  execute: (ctx: DataContext, params: any) => Promise<{
    success: boolean;
    message: string;
    data?: any;
  }>;
  /**
   * يُنشئ وصفاً نصياً للإجراء للعرض قبل التأكيد.
   */
  describe: (params: any) => string;
}

export const ACTIONS: ActionDef[] = [
  {
    action: 'create_specialization',
    label: 'إنشاء تخصص جديد',
    description: 'إضافة تخصص (شعبة) إلى قسم معين',
    requiredParams: ['name', 'departmentId'],
    roles: ['director'],
    describe: (p) =>
      `إنشاء تخصص جديد باسم "${p.name}" ضمن القسم المحدد.`,
    async execute(_ctx, params) {
      const { name, departmentId } = params;
      if (!name || !departmentId) {
        return { success: false, message: 'الاسم والقسم مطلوبان' };
      }
      const dept = await db.department.findUnique({ where: { id: departmentId } });
      if (!dept) return { success: false, message: 'القسم غير موجود' };
      const spec = await db.specialization.create({
        data: { name, departmentId },
      });
      return {
        success: true,
        message: `تم إنشاء التخصص "${name}" في قسم ${dept.name} بنجاح`,
        data: { id: spec.id, name: spec.name },
      };
    },
  },
  {
    action: 'create_user',
    label: 'إنشاء حساب مستخدم',
    description: 'إضافة موظف أو مدير جديد',
    requiredParams: ['username', 'name', 'password', 'role'],
    roles: ['director'],
    describe: (p) =>
      `إنشاء حساب ${p.role === 'director' ? 'مدير' : 'موظف'} باسم "${p.name}" (المعرّف: ${p.username}).`,
    async execute(_ctx, params) {
      const { username, name, password, role, canManageTimetable } = params;
      if (!username || !name || !password) {
        return { success: false, message: 'الحقول الأساسية مطلوبة' };
      }
      const exists = await db.user.findUnique({ where: { username } });
      if (exists) {
        return { success: false, message: 'اسم المستخدم مستخدم بالفعل' };
      }
      const user = await db.user.create({
        data: {
          username,
          name,
          password,
          role: role === 'director' ? 'director' : 'employee',
          canManageTimetable: !!canManageTimetable,
        },
      });
      return {
        success: true,
        message: `تم إنشاء حساب ${user.name} بنجاح`,
        data: { id: user.id, username: user.username },
      };
    },
  },
  {
    action: 'create_room',
    label: 'إنشاء قاعة',
    description: 'إضافة قاعة دراسية جديدة',
    requiredParams: ['name'],
    roles: ['director'],
    describe: (p) =>
      `إنشاء قاعة جديدة باسم "${p.name}"${p.capacity ? ` بسعة ${p.capacity}` : ''}.`,
    async execute(_ctx, params) {
      const { name, code, capacity, type, building, floor, notes } = params;
      if (!name) return { success: false, message: 'اسم القاعة مطلوب' };
      const exists = await db.room.findUnique({ where: { name } });
      if (exists) return { success: false, message: 'اسم القاعة مستخدم' };
      const room = await db.room.create({
        data: {
          name,
          code: code || null,
          capacity: parseInt(capacity, 10) || 30,
          type: type || 'classroom',
          building: building || null,
          floor: floor || null,
          notes: notes || null,
        },
      });
      return {
        success: true,
        message: `تم إنشاء القاعة "${room.name}" بنجاح`,
        data: { id: room.id },
      };
    },
  },
  {
    action: 'create_notification',
    label: 'إرسال إشعار',
    description: 'تسجيل إشعار في سجل التدقيق',
    requiredParams: ['message'],
    roles: ['director', 'employee'],
    describe: (p) => `تسجيل إشعار: "${p.message}"`,
    async execute(ctx, params) {
      const { message, target } = params;
      if (!message) return { success: false, message: 'نص الإشعار مطلوب' };
      // نسجّل الإشعار في AuditLog (لا يوجد جدول إشعارات مستقل)
      await db.auditLog.create({
        data: {
          userId: ctx.user.id,
          userName: ctx.user.name,
          action: 'notification_sent',
          details: message,
          source: 'ai_assistant',
          targetType: target || 'all',
          status: 'success',
        },
      });
      return {
        success: true,
        message: 'تم تسجيل الإشعار بنجاح',
      };
    },
  },
  {
    action: 'delete_student',
    label: 'حذف طالب',
    description: 'حذف طالب من قاعدة البيانات (إجراء حساس)',
    requiredParams: ['studentId'],
    roles: ['director'],
    describe: (p) => `⚠️ حذف الطالب بالمعرّف ${p.studentId} نهائياً.`,
    async execute(_ctx, params) {
      const { studentId, confirm } = params;
      if (!studentId) return { success: false, message: 'معرّف الطالب مطلوب' };
      if (!confirm) {
        return {
          success: false,
          message: 'يلزم تأكيد الحذف (confirm=true)',
        };
      }
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return { success: false, message: 'الطالب غير موجود' };
      await db.student.delete({ where: { id: studentId } });
      return {
        success: true,
        message: `تم حذف الطالب "${student.name}" بنجاح`,
      };
    },
  },
];

export function getAction(name: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.action === name);
}

export function canExecute(
  action: string,
  ctx: DataContext
): { allowed: boolean; reason?: string } {
  const def = getAction(action);
  if (!def) return { allowed: false, reason: 'الإجراء غير معروف' };
  if (!def.roles.includes(ctx.user.role as any)) {
    return {
      allowed: false,
      reason: 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
    };
  }
  return { allowed: true };
}

export async function executeAction(
  action: string,
  ctx: DataContext,
  params: any
): Promise<{ success: boolean; message: string; data?: any }> {
  const def = getAction(action);
  if (!def) {
    return { success: false, message: `إجراء غير معروف: ${action}` };
  }
  const perm = canExecute(action, ctx);
  if (!perm.allowed) {
    return { success: false, message: perm.reason || 'ممنوع' };
  }
  // التحقق من المعاملات المطلوبة
  for (const k of def.requiredParams) {
    if (params?.[k] === undefined || params?.[k] === '' || params?.[k] === null) {
      return { success: false, message: `المعامل "${k}" مطلوب` };
    }
  }
  try {
    const result = await def.execute(ctx, params);
    // سجل التدقيق
    await logAudit(ctx, action, result.success ? 'success' : 'failed', {
      params,
      result: result.message,
    });
    return result;
  } catch (err: any) {
    await logAudit(ctx, action, 'error', { params, error: err?.message });
    return {
      success: false,
      message: `خطأ أثناء تنفيذ الإجراء: ${err?.message || String(err)}`,
    };
  }
}

/**
 * تسجيل في جدول AuditLog مع source="ai_assistant"
 */
export async function logAudit(
  ctx: DataContext,
  action: string,
  status: 'success' | 'failed' | 'error' = 'success',
  details?: any
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        userName: ctx.user.name,
        action,
        targetType: 'ai_action',
        details: details ? JSON.stringify(details) : null,
        source: 'ai_assistant',
        status,
      },
    });
  } catch (err) {
    console.error('logAudit error:', err);
  }
}

export function actionToBlock(action: string, params: any): ActionBlock {
  const def = getAction(action);
  return {
    action,
    params: params || {},
    description: def?.describe(params) || `تنفيذ ${action}`,
  };
}
