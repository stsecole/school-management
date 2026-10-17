import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy (Next.js 16 replacement for middleware)
 *
 * CRITICAL: This proxy MUST NOT read the request body and MUST NOT do any
 * database queries. Both actions can break the request:
 *  - Reading the body consumes it, so the route handler receives an empty body
 *  - Database queries in proxy can exhaust connections in dev mode
 *
 * Activity logging is now handled inside each route handler (via logActivity
 * from @/lib/activity-logger) instead of here.
 *
 * This proxy:
 *  1) Passes all requests through unchanged
 *  2) Triggers auto-backup (asynchronously, non-blocking) every 5 minutes
 *     for non-API page requests
 */

// ذاكرة مؤقتة لتجنب التحقق المتكرر من النسخ التلقائي
let lastBackupCheckTime = 0;
const BACKUP_CHECK_INTERVAL = 5 * 60 * 1000; // 5 دقائق بين كل تحقق

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // فقط لطلبات الصفحات (وليس API أو ملفات ثابتة)
  if (!path.startsWith('/api/') && !path.startsWith('/_next/') && !path.startsWith('/static/')) {
    // تحقق كل 5 دقائق فقط (للأداء)
    const now = Date.now();
    if (now - lastBackupCheckTime >= BACKUP_CHECK_INTERVAL) {
      lastBackupCheckTime = now;

      // استدعاء API النسخ التلقائي بشكل غير متزامن (لا ينتظر النتيجة)
      try {
        const baseUrl = request.nextUrl.origin;
        fetch(`${baseUrl}/api/backup/auto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {
          // تجاهل الأخطاء بصمت
        });
      } catch {}
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|scan).*)'],
};
