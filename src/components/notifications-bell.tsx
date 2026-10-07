'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  AlertCircle,
  Clock,
  Info,
  CheckCircle2,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// نموذج الإشعار كما يأتي من الـ API
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  link: string | null;
  relatedId: string | null;
  isRead: boolean;
  targetRole: string;
  createdAt: string;
}

interface NotificationsBellProps {
  // دالة التنقل عند النقر على إشعار يحوي رابطاً
  onNavigate?: (section: string) => void;
}

// إعداد ألوان وأيقونات كل درجة خطورة
function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'error':
    case 'danger':
      return {
        icon: AlertCircle,
        iconClass: 'text-red-500',
        barClass: 'bg-red-500',
        unreadBg: 'bg-red-50/60',
      };
    case 'warning':
      return {
        icon: Clock,
        iconClass: 'text-amber-500',
        barClass: 'bg-amber-500',
        unreadBg: 'bg-amber-50/60',
      };
    case 'success':
      return {
        icon: CheckCircle2,
        iconClass: 'text-emerald-500',
        barClass: 'bg-emerald-500',
        unreadBg: 'bg-emerald-50/60',
      };
    case 'info':
    default:
      return {
        icon: Info,
        iconClass: 'text-cyan-500',
        barClass: 'bg-cyan-500',
        unreadBg: 'bg-cyan-50/60',
      };
  }
}

// تنسيق الوقت بطريقة نسبية بالعربية
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  if (hours < 24) return `قبل ${hours} ساعة`;
  if (days < 7) return `قبل ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function NotificationsBell({ onNavigate }: NotificationsBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  // مرجع لضمان تشغيل التوليد التلقائي مرة واحدة فقط
  const generatedRef = useRef(false);
  const { toast } = useToast();

  // جلب الإشعارات من الخادم
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('فشل التحميل');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.error('فشل تحميل الإشعارات:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // توليد الإشعارات تلقائياً من بيانات النظام
  const generateNotifications = useCallback(async (silent = true) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('فشل التوليد');
      const data = await res.json();
      // إذا تم إنشاء إشعارات جديدة، أعد التحميل لعرضها
      if (data.created && data.created > 0 && !silent) {
        toast({
          title: 'إشعارات جديدة',
          description: `تم إنشاء ${data.created} إشعار جديد`,
        });
      }
      if (data.created && data.created > 0) {
        await loadNotifications();
      }
    } catch (e) {
      console.error('فشل توليد الإشعارات:', e);
    } finally {
      setGenerating(false);
    }
  }, [loadNotifications, toast]);

  // عند التحميل الأول: ولّد الإشعارات ثم اعرضها
  useEffect(() => {
    if (generatedRef.current) return;
    generatedRef.current = true;
    (async () => {
      await generateNotifications(true);
      await loadNotifications();
    })();
  }, [generateNotifications, loadNotifications]);

  // تحديث كل 60 ثانية - توليد + إعادة تحميل
  useEffect(() => {
    const interval = setInterval(() => {
      generateNotifications(true).then(() => loadNotifications());
    }, 60000);
    return () => clearInterval(interval);
  }, [generateNotifications, loadNotifications]);

  // تعليم إشعار واحد كمقروء ثم التنقل إذا وُجد رابط
  const handleMarkAsRead = async (notification: Notification) => {
    // تحديث متفائل لواجهة المستخدم
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id }),
      });

      // التنقل إلى القسم المرتبط إن وُجد
      if (notification.link && onNavigate) {
        onNavigate(notification.link);
        setOpen(false);
      }
    } catch (e) {
      // في حالة الفشل نُرجع الحالة السابقة
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: notification.isRead } : n))
      );
      setUnreadCount((prev) => (notification.isRead ? prev : prev + 1));
      toast({
        title: 'خطأ',
        description: 'تعذر تحديث حالة الإشعار',
        variant: 'destructive',
      });
    }
  };

  // تعليم جميع الإشعارات كمقروءة
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    // تحديث متفائل
    const prevCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error('فشل التحديث');
      toast({
        title: 'تم',
        description: 'تم تعليم جميع الإشعارات كمقروءة',
      });
    } catch (e) {
      // استرجاع الحالة السابقة
      setNotifications((prev) =>
        prev.map((n, i) => (i < prevCount ? { ...n, isRead: false } : n))
      );
      setUnreadCount(prevCount);
      toast({
        title: 'خطأ',
        description: 'تعذر تحديث الإشعارات',
        variant: 'destructive',
      });
    }
  };

  // تحديث يدوي عند النقر على زر التحديث
  const handleRefresh = async () => {
    await generateNotifications(false);
    await loadNotifications();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="الإشعارات"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background"
              aria-label={`${unreadCount} إشعارات غير مقروءة`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0"
      >
        {/* رأس القائمة */}
        <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 flex-shrink-0" />
            <h3 className="font-semibold text-sm truncate">الإشعارات</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {unreadCount} جديد
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={generating || loading}
              aria-label="تحديث"
              title="تحديث الإشعارات"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', (generating || loading) && 'animate-spin')}
              />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5 ml-1" />
                تعليم الكل
              </Button>
            )}
          </div>
        </div>

        {/* قائمة الإشعارات */}
        <ScrollArea className="max-h-96">
          {loading && notifications.length === 0 ? (
            // حالة التحميل الأولي
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 bg-muted rounded" />
                    <div className="h-2.5 w-full bg-muted rounded" />
                    <div className="h-2 w-1/3 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            // حالة عدم وجود إشعارات
            <div className="p-8 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">لا توجد إشعارات</p>
              <p className="text-xs mt-1 opacity-70">
                سيظهر هنا تنبيه عن المهام والأقساط المتأخرة
              </p>
            </div>
          ) : (
            <div className="divide-y" dir="rtl">
              {notifications.map((n) => {
                const cfg = getSeverityConfig(n.severity);
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleMarkAsRead(n)}
                    className={cn(
                      'w-full text-right p-3 flex gap-3 hover:bg-accent/50 transition-colors relative border-r-2',
                      cfg.barClass,
                      !n.isRead && cfg.unreadBg,
                      n.isRead && 'opacity-70'
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5 flex-shrink-0 mt-0.5', cfg.iconClass)}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-snug truncate">
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5"
                            aria-label="غير مقروء"
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        {n.link && (
                          <span className="text-[10px] text-primary font-medium">
                            عرض التفاصيل
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* تذييل القائمة */}
        {notifications.length > 0 && (
          <div className="p-2 border-t bg-muted/30 text-center">
            <p className="text-[10px] text-muted-foreground">
              يُحدّث تلقائياً كل دقيقة
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
