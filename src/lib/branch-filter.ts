import { getSession, SessionUser } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * Branch filtering helper.
 *
 * Behavior:
 *  - Director with no `active_branch` cookie: sees ALL branches (returns {})
 *  - Director with `active_branch=all`: sees ALL branches
 *  - Director with `active_branch=<branchId>`: sees only that branch
 *  - Employee: sees only their own branch (user.branchId)
 *  - Employee without branchId: sees data with branchId=null (main office)
 *
 * Returns a Prisma `where` clause fragment that can be spread into any query.
 *
 * Usage in API routes:
 *   const branchFilter = await getBranchFilter();
 *   const students = await db.student.findMany({ where: { ...branchFilter, status: 'registered' } });
 *
 * Or for the whole `where`:
 *   const students = await db.student.findMany({ where: branchFilter });
 */
export async function getBranchFilter(): Promise<{ branchId?: string | null }> {
  const user = await getSession();
  if (!user) {
    // No session → only see unassigned data
    return { branchId: null };
  }

  // Director can switch branches via cookie
  if (user.role === 'director') {
    const cookieStore = await cookies();
    const activeBranch = cookieStore.get('active_branch')?.value;

    // No cookie or "all" → see everything
    if (!activeBranch || activeBranch === 'all') {
      return {};
    }

    // Specific branch selected
    return { branchId: activeBranch };
  }

  // Employee: only their branch (or null if unassigned)
  return { branchId: user.branchId || null };
}

/**
 * Returns the branch ID that should be assigned to NEW records created by the
 * current user.
 *
 * - Director with active_branch cookie = <branchId>: that branch
 * - Director with active_branch = "all" or no cookie: null (main office)
 * - Employee: their own branch (or null if unassigned)
 */
export async function getBranchIdForNewRecord(): Promise<string | null> {
  const user = await getSession();
  if (!user) return null;

  if (user.role === 'director') {
    const cookieStore = await cookies();
    const activeBranch = cookieStore.get('active_branch')?.value;
    if (activeBranch && activeBranch !== 'all') {
      return activeBranch;
    }
    return null; // Director with "all branches" view → main office
  }

  return user.branchId || null;
}

/**
 * Returns the user's own branch ID (ignoring any active_branch cookie).
 * Use this for permission checks, not for query filtering.
 */
export async function getCurrentUserBranchId(): Promise<string | null> {
  const user = await getSession();
  if (!user) return null;
  if (user.role === 'director') return null;
  return user.branchId || null;
}

/**
 * Type-safe helper: extends SessionUser with branchId.
 * Use this when you need to access the branchId on the session.
 *
 * NOTE: requires `branchId` to be added to encodeSession() in auth.ts.
 */
export function getUserBranchId(user: SessionUser): string | null {
  return (user as SessionUser & { branchId?: string | null }).branchId || null;
}
