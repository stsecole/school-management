import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/users/staff-names - returns list of staff names for dropdowns
// Available to any authenticated user (for task assignment, etc.)
export async function GET() {
  try {
    await requireAuth();
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    });
    // Return as simple list with display labels
    const staff = users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      label: u.role === 'director' ? `${u.name} (مدير)` : `${u.name} (موظف)`,
    }));
    return NextResponse.json({ staff });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    console.error('GET /api/users/staff-names error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
