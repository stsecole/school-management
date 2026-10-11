import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserPermissions, SECTIONS } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await requireAuth();
    const permissions = await getUserPermissions(user.id);

    // المدير دائماً يرى كل شيء
    if (permissions.role === 'director') {
      return NextResponse.json({
        ...permissions,
        sections: SECTIONS,
        allowedSections: null,
      });
    }

    // الموظف بدور مخصص (سواء افتراضي أو مخصص) → استخدم الصلاحيات الفعلية
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