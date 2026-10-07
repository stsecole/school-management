import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
  canManageTimetable: boolean;
  branchId?: string | null;
}

/**
 * Get the current logged-in user from the session cookie.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie) return null;
  try {
    const parsed = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns the user or throws a 401 response.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * Require director role. Use this for finance endpoints.
 */
export async function requireDirector(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== 'director') {
    throw new Error('FORBIDDEN');
  }
  return user;
}

/**
 * Require timetable management access.
 * Allowed for: directors (always) OR employees with canManageTimetable=true.
 */
export async function requireTimetableManage(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role === 'director') return user;
  if (user.canManageTimetable) return user;
  throw new Error('FORBIDDEN');
}

/**
 * Verify the finance password against the stored setting.
 */
export async function verifyFinancePassword(password: string): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: 'finance_password' } });
  return setting?.value === password;
}

/**
 * Check finance access: the user must be a director AND must have an active
 * finance_auth cookie issued in their name (after entering the finance password).
 */
export async function requireFinanceAccess(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== 'director') {
    throw new Error('FORBIDDEN');
  }
  const cookieStore = await cookies();
  const financeCookie = cookieStore.get('finance_auth')?.value;
  if (!financeCookie || financeCookie !== user.id) {
    throw new Error('FINANCE_AUTH_REQUIRED');
  }
  return user;
}

/**
 * Create a session cookie value.
 */
export function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString('base64');
}
