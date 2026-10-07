import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserPermissions, SECTIONS, canAccess } from '@/lib/permissions';

/**
 * GET /api/my-permissions
 * صلاحيات المستخدم الحالي
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const permissions = await getUserPermissions(user.id);

    return NextResponse.json({
      ...permissions,
      sections: SECTIONS,
      allowedSections: Object.values(permissions.permissions)
        .filter(p => p.canView)
        .map(p => p.section),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/my-permissions error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}
