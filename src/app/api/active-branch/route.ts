import { NextRequest, NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth';

/**
 * POST /api/active-branch
 * Body: { branchId: string | "all" }
 *
 * Sets the active_branch cookie so the director can switch between
 * viewing different branches' data. Only directors can switch.
 *
 * - "all"  → see all branches (default)
 * - <id>   → see only that branch
 */
export async function POST(request: NextRequest) {
  try {
    await requireDirector();
    const body = await request.json();
    const branchId = body.branchId || 'all';

    const response = NextResponse.json({
      message: 'Active branch updated',
      activeBranch: branchId,
    });

    response.cookies.set('active_branch', branchId, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    console.error('POST /api/active-branch error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * GET /api/active-branch — returns the current active_branch cookie value.
 */
export async function GET(request: NextRequest) {
  try {
    await requireDirector();
    const activeBranch = request.cookies.get('active_branch')?.value || 'all';
    return NextResponse.json({ activeBranch });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Director access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
