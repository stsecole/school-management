import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserPermissions, SECTIONS } from '@/lib/permissions';

/**
 * GET /api/my-permissions
 * صلاحيات المستخدم الحالي
 *
 * منطق مبسّط:
 * - المدير (director): allowedSections = null (يرى كل شيء دائماً)
 * - الموظف بدون دور مخصص (roleId=null): allowedSections = null (يستخدم الفلترة القديمة)
 * - الموظف بدور مخصص: allowedSections = قائمة الأقسام المسموح بها فقط
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const permissions = await getUserPermissions(user.id);

    // المدير دائماً يرى كل شيء
    if (permissions.role === 'director') {
      return NextResponse.json({
        ...permissions,
        sections: SECTIONS,
        allowedSections: null, // null = لا فلترة، يرى كل شيء
      });
    }

    // الموظف بدون دور مخصص → فلترة قديمة
    if (permissions.isSystemRole) {
      return NextResponse.json({
        ...permissions,
        sections: SECTIONS,
        allowedSections: null, // null = استخدم الفلترة القديمة حسب role
      });
    }

    // الموظف بدور مخصص → قائمة محددة
    const allowedSections = Object.values(permissions.permissions)
      .filter(p => p.canView)
      .map(p => p.section);

    return NextResponse.json({
      ...permissions,
      sections: SECTIONS,
      allowedSections,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/my-permissions error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
