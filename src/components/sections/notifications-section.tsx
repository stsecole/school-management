'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Bell, BellOff, CheckCheck, Trash2, Plus, Info, AlertCircle,
  CheckCircle2, AlertTriangle, Users, Wallet, Calendar, ListTodo, Settings, X,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  danger: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

const categoryConfig: Record<string, { icon: any; label: string }> = {
  student: { icon: Users, label: 'طلاب' },
  finance: { icon: Wallet, label: 'مالية' },
  attendance: { icon: Calendar, label: 'حضور' },
  task: { icon: ListTodo, label: 'مهام' },
  system: { icon: Settings, label: 'نظام' },
  general: { icon: Bell, label: 'عام' },
};

export function NotificationsSection({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', message: '', type: 'info', category: 'general' });
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=50');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setStatusMsg({ type: 'error', text: 'فشل التحميل' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleRead = async (id: string) => {
    await fetch(`/api/notifications?id=${id}&action=read`, { method: 'POST' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleReadAll = async () => {
    await fetch('/api/notifications?action=readAll', { method: 'POST' });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    showStatus('success', 'تم تعليم الكل كمقروء');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا الإشعار؟')) return;
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
    setNotifications(prev => prev.filter(n => n.id !== id));
    showStatus('success', 'تم الحذف');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      showStatus('error', 'العنوان والرسالة مطلوبان');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        showStatus('success', 'تم إنشاء الإشعار بنجاح');
        setFormData({ title: '', message: '', type: 'info', category: 'general' });
        setShowForm(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        showStatus('error', err.error || 'فشل الإنشاء');
      }
    } catch (err: any) {
      showStatus('error', 'خطأ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white relative">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-red-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">مركز الإشعارات</h2>
            <p className="text-sm text-muted-foreground">{unreadCount} إشعار غير مقروء</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}>
            {filter === 'all' ? 'غير مقروءة' : 'الكل'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReadAll} disabled={unreadCount === 0}>
            <CheckCheck className="w-4 h-4 ml-2" /> تعليم الكل
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="w-4 h-4 ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            {showForm ? 'إلغاء' : 'إشعار جديد'}
          </Button>
        </div>
      </div>

      {/* رسالة الحالة */}
      {statusMsg && (
        <div className={`p-3 rounded-lg border ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{statusMsg.text}</p>
        </div>
      )}

      {/* نموذج الإنشاء المباشر */}
      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">إنشاء إشعار جديد</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notif-title">العنوان *</Label>
                <Input
                  id="notif-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="أدخل عنوان الإشعار"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-message">الرسالة *</Label>
                <Textarea
                  id="notif-message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="أدخل نص الرسالة"
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="info">معلومة</option>
                    <option value="warning">تحذير</option>
                    <option value="success">نجاح</option>
                    <option value="danger">خطر</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>الفئة</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="general">عام</option>
                    <option value="student">طلاب</option>
                    <option value="finance">مالية</option>
                    <option value="attendance">حضور</option>
                    <option value="task">مهام</option>
                    <option value="system">نظام</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الإشعار'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* قائمة الإشعارات */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filtered.map(n => {
                const tc = typeConfig[n.type] || typeConfig.info;
                const cc = categoryConfig[n.category] || categoryConfig.general;
                const TIcon = tc.icon;
                const CIcon = cc.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`p-2 rounded-lg ${tc.bg} ${tc.color} flex-shrink-0`}>
                      <TIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm ${!n.isRead ? 'font-bold' : 'font-medium'}`}>{n.title}</p>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs gap-1">
                          <CIcon className="w-3 h-3" /> {cc.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!n.isRead && (
                        <Button size="sm" variant="ghost" onClick={() => handleRead(n.id)} title="تعليم كمقروء">
                          <CheckCheck className="w-4 h-4" />
                        </Button>
                      )}
                      {n.link && (
                        <Button size="sm" variant="ghost" onClick={() => onNavigate?.(n.link!)} title="فتح">
                          →
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(n.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
