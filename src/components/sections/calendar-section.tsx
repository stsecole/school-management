'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Calendar, Plus, ChevronRight, ChevronLeft, Trash2, MapPin, X,
  FileText, Calendar as CalIcon, DollarSign, ClipboardList, Users,
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: string;
  startDate: string;
  endDate?: string;
  color: string;
  location?: string;
  isAuto?: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  exam: { icon: FileText, color: '#dc2626', label: 'امتحان' },
  holiday: { icon: CalIcon, color: '#16a34a', label: 'عطلة' },
  meeting: { icon: Users, color: '#0891b2', label: 'اجتماع' },
  payment: { icon: DollarSign, color: '#f59e0b', label: 'دفعة' },
  deadline: { icon: ClipboardList, color: '#7c3aed', label: 'موعد نهائي' },
  event: { icon: CalIcon, color: '#0f766e', label: 'حدث' },
};

const monthNames = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function CalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '', type: 'event', startDate: '', location: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${monthKey}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      showStatus('error', 'فشل التحميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [monthKey]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const getEventsForDay = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.startDate.startsWith(dayStr));
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(new Date(year, month, day));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.startDate) {
      showStatus('error', 'العنوان والتاريخ مطلوبان');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        showStatus('success', 'تم إنشاء الحدث بنجاح');
        setFormData({ title: '', type: 'event', startDate: '', location: '', description: '' });
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

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا الحدث؟')) return;
    const res = await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showStatus('success', 'تم الحذف');
      load();
    }
  };

  const monthStats = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">التقويم الزمني</h2>
            <p className="text-sm text-muted-foreground">{events.length} حدث في {monthNames[month]} {year}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
          {showForm ? 'إلغاء' : 'حدث جديد'}
        </Button>
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
            <h3 className="font-semibold mb-4">إنشاء حدث جديد</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-title">العنوان *</Label>
                <Input
                  id="event-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: امتحان نهاية الفصل"
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
                    <option value="event">حدث</option>
                    <option value="exam">امتحان</option>
                    <option value="holiday">عطلة</option>
                    <option value="meeting">اجتماع</option>
                    <option value="payment">دفعة</option>
                    <option value="deadline">موعد نهائي</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-date">التاريخ *</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    dir="ltr"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location">المكان</Label>
                <Input
                  id="event-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="مثال: القاعة 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-desc">الوصف</Label>
                <Textarea
                  id="event-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? 'جاري الإنشاء...' : 'إنشاء الحدث'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* إحصائيات */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(monthStats).map(([type, count]) => {
          const tc = typeConfig[type] || typeConfig.event;
          const Icon = tc.icon;
          return (
            <Badge key={type} variant="outline" className="gap-1" style={{ borderColor: tc.color, color: tc.color }}>
              <Icon className="w-3 h-3" /> {tc.label}: {count}
            </Badge>
          );
        })}
      </div>

      {/* التقويم */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{monthNames[month]} {year}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={today}>اليوم</Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
              const isSelected = selectedDay?.toDateString() === new Date(year, month, day).toDateString();
              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[80px] p-1.5 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                  } ${isToday ? 'bg-primary/10' : 'bg-card'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday ? 'text-primary' : ''}`}>{day}</span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => {
                      const tc = typeConfig[e.type] || typeConfig.event;
                      return (
                        <div
                          key={e.id}
                          className="text-[10px] px-1.5 py-0.5 rounded truncate text-white"
                          style={{ background: tc.color }}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} المزيد</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* أحداث اليوم المحدد */}
      {selectedDay && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                أحداث {selectedDay.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {getEventsForDay(selectedDay.getDate()).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>لا توجد أحداث في هذا اليوم</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getEventsForDay(selectedDay.getDate()).map(e => {
                  const tc = typeConfig[e.type] || typeConfig.event;
                  const Icon = tc.icon;
                  return (
                    <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderRightColor: tc.color, borderRightWidth: 4 }}>
                      <div className="p-2 rounded-lg text-white" style={{ background: tc.color }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{e.title}</p>
                          <Badge variant="outline" className="text-xs">{tc.label}</Badge>
                          {e.isAuto && <Badge variant="secondary" className="text-xs">تلقائي</Badge>}
                        </div>
                        {e.description && <p className="text-sm text-muted-foreground mt-1">{e.description}</p>}
                        {e.location && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {e.location}
                          </p>
                        )}
                      </div>
                      {!e.isAuto && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
