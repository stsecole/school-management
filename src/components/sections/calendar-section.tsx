'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Calendar, Plus, ChevronRight, ChevronLeft, Trash2, MapPin, X,
  FileText, DollarSign, ClipboardList, Users, Sparkles, Clock,
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
  holiday: { icon: Calendar, color: '#16a34a', label: 'عطلة' },
  meeting: { icon: Users, color: '#0891b2', label: 'اجتماع' },
  payment: { icon: DollarSign, color: '#f59e0b', label: 'دفعة' },
  deadline: { icon: ClipboardList, color: '#7c3aed', label: 'موعد نهائي' },
  event: { icon: Calendar, color: '#0f766e', label: 'حدث' },
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
  const today = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  };

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

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const todayDate = new Date();

  return (
    <div className="space-y-4">
      {/* رأس - أخضر جذاب */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">التقويم الزمني</h2>
            <p className="text-sm text-emerald-100">{events.length} حدث في {monthNames[month]} {year}</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-amber-400 hover:bg-amber-500 text-emerald-900 font-bold"
        >
          {showForm ? <X className="w-4 h-4 ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
          {showForm ? 'إلغاء' : 'حدث جديد'}
        </Button>
      </div>

      {/* رسالة الحالة */}
      {statusMsg && (
        <div className={`p-3 rounded-2xl border ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{statusMsg.text}</p>
        </div>
      )}

      {/* نموذج الإنشاء المباشر */}
      {showForm && (
        <div className="bg-white rounded-3xl shadow-lg border-2 border-emerald-200 p-5">
          <h3 className="font-bold text-emerald-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-700" /> إنشاء حدث جديد
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title" className="text-emerald-900 font-bold">العنوان *</Label>
              <Input
                id="event-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: امتحان نهاية الفصل"
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">النوع</Label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-xl border border-emerald-200 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-200"
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
                <Label htmlFor="event-date" className="text-emerald-900 font-bold">التاريخ *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location" className="text-emerald-900 font-bold">المكان</Label>
              <Input
                id="event-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="مثال: القاعة 3"
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-desc" className="text-emerald-900 font-bold">الوصف</Label>
              <Textarea
                id="event-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {submitting ? 'جاري الإنشاء...' : 'إنشاء الحدث'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* إحصائيات - بطاقات خضراء أنيقة */}
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3">
        <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> إحصائيات الشهر
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(monthStats).length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد أحداث بعد هذا الشهر</p>
          ) : (
            Object.entries(monthStats).map(([type, count]) => {
              const tc = typeConfig[type] || typeConfig.event;
              const Icon = tc.icon;
              return (
                <div
                  key={type}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                  style={{ borderColor: tc.color, color: tc.color, backgroundColor: tc.color + '10' }}
                >
                  <Icon className="w-3 h-3" /> {tc.label}: <span className="num">{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* التقويم - مع لوحة جانبية */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
        {/* === CALENDAR (Right) === */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-amber-300" />
              <h3 className="text-xl font-bold">{monthNames[month]} {year}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="w-9 h-9 rounded-full bg-emerald-900/40 hover:bg-emerald-900/60 flex items-center justify-center transition"
                title="الشهر السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={today}
                className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-emerald-900 text-sm font-bold transition"
              >
                اليوم
              </button>
              <button
                onClick={nextMonth}
                className="w-9 h-9 rounded-full bg-emerald-900/40 hover:bg-emerald-900/60 flex items-center justify-center transition"
                title="الشهر التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 bg-emerald-50 border-b border-emerald-100">
            {dayNames.map(d => (
              <div key={d} className="text-center py-2 text-xs font-bold text-emerald-900">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] bg-emerald-50/30 border border-emerald-50" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isTodayBool = isSameDay(new Date(year, month, day), todayDate);
              const isSelectedBool = selectedDay ? isSameDay(new Date(year, month, day), selectedDay) : false;
              // Unique event colors for this day (max 4 dots)
              const dayColors = Array.from(new Set(dayEvents.map(e => (typeConfig[e.type] || typeConfig.event).color))).slice(0, 4);

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`min-h-[80px] p-1.5 border border-emerald-50 text-right flex flex-col items-start justify-between hover:bg-emerald-50 transition relative
                    ${isTodayBool ? 'bg-amber-50' : ''}
                    ${isSelectedBool ? 'ring-2 ring-emerald-500 ring-inset' : ''}
                  `}
                >
                  <span
                    className={`text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center
                      ${isTodayBool ? 'bg-emerald-700 text-white' : 'text-emerald-900'}
                    `}
                  >
                    {day}
                  </span>

                  {/* Event dots */}
                  {dayColors.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {dayColors.map((c, idx) => (
                        <span
                          key={idx}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="text-[9px] text-emerald-700 font-bold">+{dayEvents.length - 4}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* === SIDEBAR (Left) - Selected day events === */}
        <div className="space-y-3">
          {/* Day header */}
          <div className="bg-gradient-to-l from-emerald-50 to-white rounded-2xl shadow-md border border-emerald-100 overflow-hidden">
            <div className="bg-emerald-100/60 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-700" />
                <span className="font-bold text-emerald-900 text-sm">
                  {selectedDay
                    ? selectedDay.toLocaleDateString('ar-DZ', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'اختر يوماً لعرض أحداثه'}
                </span>
              </div>
              {selectedDay && getEventsForDay(selectedDay.getDate()).length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold">
                  {getEventsForDay(selectedDay.getDate()).length} حدث
                </span>
              )}
            </div>

            <div className="p-3">
              {loading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  جاري التحميل...
                </div>
              ) : !selectedDay ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                    <Calendar className="w-6 h-6 text-emerald-300" />
                  </div>
                  <p className="font-bold text-emerald-900 text-sm">اضغط على أي يوم</p>
                  <p className="text-xs text-muted-foreground mt-1">لرؤية أحداث ذلك اليوم</p>
                </div>
              ) : getEventsForDay(selectedDay.getDate()).length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                    <Calendar className="w-6 h-6 text-emerald-300" />
                  </div>
                  <p className="font-bold text-emerald-900 text-sm">لا أحداث في هذا اليوم</p>
                  <p className="text-xs text-muted-foreground mt-1">يوم خالٍ من الأحداث</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getEventsForDay(selectedDay.getDate()).map(e => {
                    const tc = typeConfig[e.type] || typeConfig.event;
                    const Icon = tc.icon;
                    return (
                      <div
                        key={e.id}
                        className="rounded-xl p-2.5 border border-emerald-200 bg-emerald-50/50 flex items-start gap-2 hover:shadow-md transition-all"
                      >
                        {/* Color dot icon */}
                        <div
                          className="p-2 rounded-lg text-white flex-shrink-0"
                          style={{ background: tc.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Vertical color bar */}
                        <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: tc.color }} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-emerald-900 text-sm truncate">{e.title}</p>
                            <Badge variant="outline" className="text-xs" style={{ borderColor: tc.color, color: tc.color }}>
                              {tc.label}
                            </Badge>
                            {e.isAuto && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                تلقائي
                              </span>
                            )}
                          </div>
                          {e.description && (
                            <p className="text-xs text-emerald-700 mt-1">{e.description}</p>
                          )}
                          {e.location && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {e.location}
                            </p>
                          )}
                        </div>

                        {!e.isAuto && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(e.id)}
                            className="text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Color legend */}
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-3">
            <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> مفتاح أنواع الأحداث
            </h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(typeConfig).map(([type, tc]) => {
                const Icon = tc.icon;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tc.color }} />
                    <Icon className="w-3 h-3" style={{ color: tc.color }} />
                    <span className="text-emerald-800">{tc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl shadow-sm border border-emerald-100 p-3">
            <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> إحصائيات سريعة
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <p className="text-xl font-bold text-emerald-900 num">{events.length}</p>
                <p className="text-[10px] text-emerald-700">إجمالي الأحداث</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <p className="text-xl font-bold text-amber-700 num">{Object.keys(monthStats).length}</p>
                <p className="text-[10px] text-amber-700">أنواع مختلفة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
