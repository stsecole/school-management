'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Plus, Edit, Trash2, Calendar, DoorOpen, Users, BookOpen, Clock, PartyPopper, Settings,
  Sparkles, Download, Search, AlertCircle, CheckCircle2, Filter, Printer, LayoutGrid,
  CalendarDays, User, Building2, GraduationCap, BookText, AlertTriangle, Layers, Network,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ROOM_TYPES = [
  { value: 'classroom', label: 'قاعة عادية' },
  { value: 'lab', label: 'مخبر' },
  { value: 'computer_lab', label: 'مخبر إعلام آلي' },
  { value: 'amphitheater', label: 'مدرج' },
];
const SUBJECT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Main component
export function TimetableSection({ isDirector = false, canManageTimetable = false }: { isDirector?: boolean; canManageTimetable?: boolean }) {
  const [activeTab, setActiveTab] = useState('calendar');
  // canManage = director OR employee with canManageTimetable permission
  const canManage = isDirector || canManageTimetable;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" /> إدارة الجدول الأسبوعي
        </h2>
        <p className="text-muted-foreground text-sm">نظام متكامل لإدارة الجداول مع اكتشاف التعارضات والتوزيع التلقائي</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:grid-cols-11">
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 ml-1" /> تقويم</TabsTrigger>
          <TabsTrigger value="week"><CalendarDays className="w-4 h-4 ml-1" /> أسبوعي</TabsTrigger>
          <TabsTrigger value="day"><Calendar className="w-4 h-4 ml-1" /> يومي</TabsTrigger>
          <TabsTrigger value="department"><Layers className="w-4 h-4 ml-1" /> الأقسام</TabsTrigger>
          <TabsTrigger value="conflicts"><AlertTriangle className="w-4 h-4 ml-1" /> التعارضات</TabsTrigger>
          <TabsTrigger value="teacher"><User className="w-4 h-4 ml-1" /> أستاذ</TabsTrigger>
          <TabsTrigger value="room"><Building2 className="w-4 h-4 ml-1" /> قاعة</TabsTrigger>
          <TabsTrigger value="group"><Users className="w-4 h-4 ml-1" /> فوج</TabsTrigger>
          <TabsTrigger value="subject"><BookText className="w-4 h-4 ml-1" /> مادة</TabsTrigger>
          <TabsTrigger value="manage"><LayoutGrid className="w-4 h-4 ml-1" /> إدارة</TabsTrigger>
          <TabsTrigger value="stats"><Filter className="w-4 h-4 ml-1" /> إحصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar"><MonthCalendarView isDirector={canManage} /></TabsContent>
        <TabsContent value="week"><WeekView isDirector={canManage} /></TabsContent>
        <TabsContent value="day"><DayView isDirector={canManage} /></TabsContent>
        <TabsContent value="department"><DepartmentView isDirector={canManage} /></TabsContent>
        <TabsContent value="conflicts"><ConflictsDashboard isDirector={canManage} /></TabsContent>
        <TabsContent value="teacher"><TeacherView isDirector={canManage} /></TabsContent>
        <TabsContent value="room"><RoomView isDirector={canManage} /></TabsContent>
        <TabsContent value="group"><GroupView isDirector={canManage} /></TabsContent>
        <TabsContent value="subject"><SubjectView isDirector={canManage} /></TabsContent>
        <TabsContent value="manage"><ManagementView isDirector={canManage} /></TabsContent>
        <TabsContent value="stats"><StatsView /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ MONTH CALENDAR VIEW (New) ============
// عرض تقويم شهري جذاب مع نقاط ملونة للأحداث
function MonthCalendarView({ isDirector }: { isDirector: boolean }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date()); // first day of month
  const [selectedDate, setSelectedDate] = useState(new Date()); // selected day
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/timetable/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Helper: format date as YYYY-MM-DD
  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Group sessions by dayOfWeek (0-6, Sunday=0)
  const sessionsByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const s of sessions) {
      const d = s.dayOfWeek ?? 0;
      if (!map[d]) map[d] = [];
      map[d].push(s);
    }
    // Sort each day's sessions by startTime
    for (const d in map) {
      map[d].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }
    return map;
  }, [sessions]);

  // Get days in month + leading empty cells (RTL: Sunday first)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0=Sunday
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    // Leading nulls (so the 1st lands on the correct weekday column)
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    // Trailing nulls to fill the last row
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  // Sessions for selected date (by dayOfWeek)
  const selectedDaySessions = (sessionsByDay[selectedDate.getDay()] || []).filter(
    (s) => !s.isHoliday
  );

  // Helpers for month navigation
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isToday = (d: Date) => isSameDay(d, new Date());

  // Color palette for event types
  const getEventColor = (session: any) => {
    const type = session.subject?.type || session.notes || '';
    if (type.includes('محاضرة') || type.includes('lecture')) return { dot: '#3b82f6', badge: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (type.includes('أعمال') || type.includes('practice') || type.includes('تطبيق')) return { dot: '#f59e0b', badge: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { dot: '#10b981', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    // Convert "13:00:00" or "13:00" to "13:00"
    return t.slice(0, 5);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
      {/* === CALENDAR (Right) === */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-300" />
            <h3 className="text-xl font-bold">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
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
              onClick={goToToday}
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
          {dayNames.map((d) => (
            <div key={d} className="text-center py-2 text-xs font-bold text-emerald-900">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[80px] bg-emerald-50/30 border border-emerald-50" />;
            }
            const daySessions = sessionsByDay[day.getDay()] || [];
            const isTodayBool = isToday(day);
            const isSelectedBool = isSameDay(day, selectedDate);
            // Unique event colors for this day (max 3 dots)
            const dayColors = Array.from(new Set(daySessions.map((s) => getEventColor(s).dot))).slice(0, 3);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(day)}
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
                  {day.getDate()}
                </span>

                {/* Event dots */}
                {dayColors.length > 0 && (
                  <div className="flex gap-1 mt-auto">
                    {dayColors.map((c, idx) => (
                      <span
                        key={idx}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    {daySessions.length > 3 && (
                      <span className="text-[9px] text-emerald-700 font-bold">+{daySessions.length - 3}</span>
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
                {dayNames[selectedDate.getDay()]}، {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </span>
            </div>
            {selectedDaySessions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold">
                {selectedDaySessions.length} حدث
              </span>
            )}
          </div>

          <div className="p-3">
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : selectedDaySessions.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                  <Calendar className="w-6 h-6 text-emerald-300" />
                </div>
                <p className="font-bold text-emerald-900 text-sm">لا أحداث في هذا اليوم</p>
                <p className="text-xs text-muted-foreground mt-1">يوم خالٍ من المحاضرات والحصص</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDaySessions.map((s) => {
                  const color = getEventColor(s);
                  const sessionType = s.subject?.type || (s.notes?.includes('محاضرة') ? 'محاضرة' : s.notes?.includes('أعمال') ? 'أعمال تطبيقية' : 'حصة');
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl p-2.5 border ${color.badge} flex items-start gap-2`}
                    >
                      {/* Time */}
                      <div className="flex-shrink-0 text-xs font-bold text-emerald-900 num pt-1">
                        <div>{formatTime(s.startTime)}</div>
                        <div className="text-emerald-500">↓</div>
                        <div>{formatTime(s.endTime)}</div>
                      </div>

                      {/* Vertical line */}
                      <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color.dot }} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-emerald-900 text-sm truncate">
                          {s.subject?.name || 'حصة'}
                        </div>
                        <div className="text-xs text-emerald-700 mt-0.5">{sessionType}</div>
                        <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                          <Building2 className="w-3 h-3" />
                          <span>{s.room?.name || 'بدون قاعة'}</span>
                          {s.group && (
                            <>
                              <span className="mx-1">·</span>
                              <Users className="w-3 h-3" />
                              <span>{s.group.name}</span>
                            </>
                          )}
                        </div>
                        {s.teacher && (
                          <div className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
                            <User className="w-3 h-3" />
                            <span>{s.teacher.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-3">
          <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> مفتاح الألوان
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
              <span className="text-emerald-800">حصة عامة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-emerald-800">محاضرة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-emerald-800">أعمال تطبيقية</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl shadow-sm border border-emerald-100 p-3">
          <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> إحصائيات الشهر
          </h4>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <p className="text-xl font-bold text-emerald-900 num">{sessions.length}</p>
              <p className="text-[10px] text-emerald-700">حصة أسبوعية</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <p className="text-xl font-bold text-amber-700 num">
                {Object.keys(sessionsByDay).length}
              </p>
              <p className="text-[10px] text-amber-700">أيام نشطة</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ WEEK VIEW ============
function WeekView({ isDirector }: { isDirector: boolean }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [departments, setDepartments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    dayOfWeek: 0, startTime: '08:00', endTime: '10:00',
    teacherId: '', roomId: '', groupId: '', subjectId: '', notes: '',
  });
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/timetable/sessions');
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
    fetch('/api/timetable/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []));
    fetch('/api/timetable/groups').then(r => r.json()).then(d => setGroups(d.groups || []));
    fetch('/api/timetable/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || []));
    load();
  }, []);

  const checkConflicts = async (data: any, excludeId?: string) => {
    const res = await fetch('/api/timetable/check-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, excludeId }),
    });
    const result = await res.json();
    setConflicts(result.errors || []);
    setWarnings(result.warnings || []);
    return result;
  };

  const handleOpenAdd = (dayOfWeek?: number, startTime?: string, endTime?: string) => {
    setEditingSession(null);
    setFormData({
      dayOfWeek: dayOfWeek ?? 0,
      startTime: startTime || '08:00',
      endTime: endTime || '10:00',
      teacherId: '', roomId: '', groupId: '', subjectId: '', notes: '',
    });
    setConflicts([]);
    setWarnings([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: any) => {
    setEditingSession(s);
    setFormData({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      teacherId: s.teacherId || '',
      roomId: s.roomId || '',
      groupId: s.groupId || '',
      subjectId: s.subjectId || '',
      notes: s.notes || '',
    });
    setConflicts([]);
    setWarnings([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Build display names
    const teacher = teachers.find(t => t.id === formData.teacherId);
    const room = rooms.find(r => r.id === formData.roomId);
    const group = groups.find(g => g.id === formData.groupId);
    const subject = subjects.find(s => s.id === formData.subjectId);

    const payload = {
      ...formData,
      dayOfWeek: parseInt(formData.dayOfWeek),
      teacherName: teacher?.name || null,
      roomName: room?.name || null,
      groupName: group?.name || null,
      subjectName: subject?.name || null,
      color: subject?.color || null,
    };

    // Check conflicts first
    const result = await checkConflicts(payload, editingSession?.id);
    if (result.hasConflicts) {
      toast({ title: 'تعارض!', description: 'يوجد تعارض يمنع الحفظ. راجع الرسائل.', variant: 'destructive' });
      return;
    }

    const url = editingSession ? `/api/timetable/sessions/${editingSession.id}` : '/api/timetable/sessions';
    const method = editingSession ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: editingSession ? 'تم تحديث الحصة' : 'تمت إضافة الحصة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      if (data.conflicts) setConflicts(data.conflicts);
      if (data.warnings) setWarnings(data.warnings);
    }
  };

  const handleDelete = async (s: any) => {
    if (!confirm('حذف هذه الحصة؟')) return;
    const res = await fetch(`/api/timetable/sessions/${s.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  // Get sessions for a specific day and time
  const getSessionAt = (day: number, startTime: string) => {
    return sessions.filter(s => s.dayOfWeek === day && s.startTime === startTime);
  };

  // Build time slots from sessions (unique start times)
  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    sessions.forEach(s => slots.add(s.startTime));
    return Array.from(slots).sort();
  }, [sessions]);

  // Default time slots if no sessions
  const defaultSlots = ['08:00', '10:00', '13:00', '15:00'];
  const displaySlots = timeSlots.length > 0 ? timeSlots : defaultSlots;

  // Filter sessions by search
  const filteredSessions = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.teacherName || '').toLowerCase().includes(q) ||
      (s.roomName || '').toLowerCase().includes(q) ||
      (s.subjectName || '').toLowerCase().includes(q) ||
      (s.groupName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar - elegant green-themed */}
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <Input
              placeholder="بحث (أستاذ، قاعة، مادة، فوج)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
            />
          </div>
          {isDirector && (
            <>
              <Button
                onClick={() => handleOpenAdd()}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Plus className="w-4 h-4 ml-2" /> إضافة حصة
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('/api/timetable/export/excel?view=week', '_blank')}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="w-4 h-4 ml-2" /> Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Printer className="w-4 h-4 ml-2" /> طباعة
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Week grid - elegant themed */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-300" />
            <h3 className="text-xl font-bold">الجدول الأسبوعي</h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold">
            {filteredSessions.length} حصة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 800 }}>
            <thead>
              <tr className="bg-emerald-50">
                <th className="border border-emerald-100 p-2 text-sm w-24 text-emerald-900 font-bold">
                  <Clock className="w-4 h-4 inline ml-1" /> التوقيت
                </th>
                {DAYS.map((day, i) => {
                  const today = new Date().getDay();
                  const isTodayCol = today === i;
                  return (
                    <th
                      key={i}
                      className={`border border-emerald-100 p-2 text-sm font-bold ${
                        isTodayCol ? 'bg-amber-100 text-emerald-900' : 'text-emerald-900'
                      }`}
                    >
                      {day}
                      {isTodayCol && <span className="block text-[10px] text-amber-600 font-normal">اليوم</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displaySlots.map((time) => {
                const [h, m] = time.split(':').map(Number);
                const endH = h + 2;
                const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return (
                  <tr key={time} className="hover:bg-emerald-50/30 transition">
                    <td className="border border-emerald-100 p-2 text-xs text-center num font-bold bg-emerald-50/50 text-emerald-800">
                      <div>{time}</div>
                      <div className="text-emerald-400">↓</div>
                      <div>{endTime}</div>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const daySessions = filteredSessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                      return (
                        <td key={dayIdx} className="border border-emerald-100 p-1 align-top" style={{ minHeight: 80 }}>
                          <div className="space-y-1">
                            {daySessions.map(s => {
                              // Determine color based on session type
                              const sessionColor = s.color || s.subject?.color || '#3b82f6';
                              const notes = s.notes || '';
                              let badgeClass = '';
                              if (notes.includes('محاضرة')) {
                                badgeClass = 'bg-blue-50 border-blue-200';
                              } else if (notes.includes('أعمال') || notes.includes('تطبيق')) {
                                badgeClass = 'bg-amber-50 border-amber-200';
                              } else {
                                badgeClass = 'bg-emerald-50 border-emerald-200';
                              }
                              return (
                                <div
                                  key={s.id}
                                  className={`p-2 rounded-xl text-xs cursor-pointer hover:shadow-md transition-all border ${badgeClass}`}
                                  style={{ borderRight: `4px solid ${sessionColor}` }}
                                  onClick={() => handleOpenEdit(s)}
                                >
                                  <div className="font-bold text-emerald-900 truncate">
                                    {s.subjectName || s.subject?.name || '-'}
                                  </div>
                                  <div className="text-emerald-700 mt-0.5 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {s.teacherName || s.teacher?.name || '-'}
                                  </div>
                                  <div className="text-emerald-600 mt-0.5 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {s.roomName || s.room?.name || '-'}
                                  </div>
                                  {s.groupName && (
                                    <div className="text-emerald-600 mt-0.5 flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {s.groupName}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {isDirector && daySessions.length === 0 && (
                              <button
                                className="w-full text-xs text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg p-2 transition border border-dashed border-emerald-200"
                                onClick={() => handleOpenAdd(dayIdx, time, endTime)}
                              >
                                <Plus className="w-3 h-3 inline ml-1" /> إضافة
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-3">
        <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> مفتاح الألوان
        </h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-emerald-800">حصة عامة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-emerald-800">محاضرة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-emerald-800">أعمال تطبيقية</span>
          </div>
        </div>
      </div>

      {/* Add/Edit dialog */}
      <SessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingSession}
        formData={formData}
        setFormData={setFormData}
        teachers={teachers}
        rooms={rooms}
        groups={groups}
        subjects={subjects}
        conflicts={conflicts}
        warnings={warnings}
        onSave={handleSave}
        onCheckConflict={(data) => checkConflicts(data, editingSession?.id)}
      />
    </div>
  );
}

// ============ SESSION DIALOG ============
function SessionDialog({ open, onOpenChange, editing, formData, setFormData, teachers, rooms, groups, subjects, conflicts, warnings, onSave, onCheckConflict }: any) {
  const [autoChecking, setAutoChecking] = useState(false);

  // Auto-check conflicts when key fields change
  useEffect(() => {
    if (!open) return;
    if (!formData.dayOfWeek && formData.dayOfWeek !== 0) return;
    setAutoChecking(true);
    const timer = setTimeout(async () => {
      const teacher = teachers.find((t: any) => t.id === formData.teacherId);
      const room = rooms.find((r: any) => r.id === formData.roomId);
      const group = groups.find((g: any) => g.id === formData.groupId);
      const subject = subjects.find((s: any) => s.id === formData.subjectId);
      const payload = {
        ...formData,
        dayOfWeek: parseInt(formData.dayOfWeek),
        teacherName: teacher?.name,
        roomName: room?.name,
        groupName: group?.name,
        subjectName: subject?.name,
      };
      await onCheckConflict(payload);
      setAutoChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.dayOfWeek, formData.startTime, formData.endTime, formData.teacherId, formData.roomId, formData.groupId, formData.subjectId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'تعديل حصة' : 'إضافة حصة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>اليوم *</Label>
            <Select value={String(formData.dayOfWeek)} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>من *</Label>
              <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>إلى *</Label>
              <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} dir="ltr" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>الأستاذ</Label>
            <Select value={formData.teacherId || 'none'} onValueChange={(v) => setFormData({ ...formData, teacherId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="اختر الأستاذ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون أستاذ</SelectItem>
                {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>القاعة</Label>
            <Select value={formData.roomId || 'none'} onValueChange={(v) => setFormData({ ...formData, roomId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="اختر القاعة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون قاعة</SelectItem>
                {rooms.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} ({ROOM_TYPES.find(rt => rt.value === r.type)?.label})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الفوج</Label>
            <Select value={formData.groupId || 'none'} onValueChange={(v) => setFormData({ ...formData, groupId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="اختر الفوج" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون فوج</SelectItem>
                {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المادة</Label>
            <Select value={formData.subjectId || 'none'} onValueChange={(v) => setFormData({ ...formData, subjectId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون مادة</SelectItem>
                {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>ملاحظات</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
          </div>
        </div>

        {/* Conflict warnings */}
        {(conflicts.length > 0 || warnings.length > 0 || autoChecking) && (
          <div className="space-y-2">
            {autoChecking && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" /> جاري التحقق من التعارضات...
              </p>
            )}
            {conflicts.map((c: any, i: number) => (
              <Alert key={`e${i}`} variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-sm">{c.message}</AlertDescription>
              </Alert>
            ))}
            {warnings.map((w: any, i: number) => (
              <Alert key={`w${i}`} className="border-amber-200 bg-amber-50">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">{w.message}</AlertDescription>
              </Alert>
            ))}
            {conflicts.length === 0 && warnings.length === 0 && !autoChecking && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-sm text-emerald-800">✓ لا توجد تعارضات - يمكن الحفظ</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={onSave} disabled={conflicts.length > 0}>
            {editing ? 'حفظ' : 'إضافة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DAY VIEW ============
function DayView({ isDirector }: { isDirector: boolean }) {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/timetable/sessions?dayOfWeek=${selectedDay}`);
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedDay]);

  const today = new Date().getDay();
  const isTodaySelected = today === selectedDay;

  const goToToday = () => setSelectedDay(today);

  const prevDay = () => setSelectedDay((d) => (d + 6) % 7); // -1 (RTL: prev = day before)
  const nextDay = () => setSelectedDay((d) => (d + 1) % 7);

  // Helper to get color based on session type
  const getColor = (s: any) => {
    const notes = s.notes || '';
    if (notes.includes('محاضرة')) return { dot: '#3b82f6', badge: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (notes.includes('أعمال') || notes.includes('تطبيق')) return { dot: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { dot: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-4">
      {/* === DAY EVENTS (Right) === */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-300" />
            <h3 className="text-xl font-bold">
              {DAYS[selectedDay]}
            </h3>
            {isTodaySelected && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold">
                اليوم
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevDay}
              className="w-9 h-9 rounded-full bg-emerald-900/40 hover:bg-emerald-900/60 flex items-center justify-center transition"
              title="اليوم السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-emerald-900 text-sm font-bold transition"
            >
              اليوم
            </button>
            <button
              onClick={nextDay}
              className="w-9 h-9 rounded-full bg-emerald-900/40 hover:bg-emerald-900/60 flex items-center justify-center transition"
              title="اليوم التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day selector tabs */}
        <div className="grid grid-cols-7 bg-emerald-50 border-b border-emerald-100">
          {DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`py-2 text-xs font-bold transition
                ${selectedDay === i
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-900 hover:bg-emerald-100'}
                ${today === i && selectedDay !== i ? 'bg-amber-50' : ''}
              `}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
              جاري التحميل...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <Calendar className="w-8 h-8 text-emerald-300" />
              </div>
              <p className="font-bold text-emerald-900 text-base">لا توجد حصص في هذا اليوم</p>
              <p className="text-xs text-muted-foreground mt-1">يوم خالٍ من المحاضرات والحصص</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => {
                const color = getColor(s);
                const sessionType = s.notes?.includes('محاضرة') ? 'محاضرة'
                  : s.notes?.includes('أعمال') ? 'أعمال تطبيقية'
                  : 'حصة';
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl p-3 border ${color.badge} flex items-start gap-3 hover:shadow-md transition-all`}
                  >
                    {/* Time block */}
                    <div className="flex-shrink-0 text-xs font-bold text-emerald-900 num pt-1 text-center min-w-[60px]">
                      <div className="px-2 py-1 rounded-lg bg-white/60">{s.startTime}</div>
                      <div className="text-emerald-500 my-1">↓</div>
                      <div className="px-2 py-1 rounded-lg bg-white/60">{s.endTime}</div>
                    </div>

                    {/* Vertical color bar */}
                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color.dot }} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-emerald-900 text-base truncate">
                          {s.subjectName || s.subject?.name || 'حصة'}
                        </h4>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: color.dot + '20', color: color.dot }}
                        >
                          {sessionType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        {s.teacherName && (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <User className="w-3 h-3" />
                            <span className="truncate">{s.teacherName}</span>
                          </div>
                        )}
                        {s.roomName && (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{s.roomName}</span>
                          </div>
                        )}
                        {s.groupName && (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <Users className="w-3 h-3" />
                            <span className="truncate">{s.groupName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-emerald-700">
                          <Clock className="w-3 h-3" />
                          <span className="num">{s.startTime} - {s.endTime}</span>
                        </div>
                      </div>
                      {s.notes && (
                        <p className="text-xs text-emerald-600 mt-2 italic border-t border-emerald-200 pt-1">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* === SIDEBAR (Left) === */}
      <div className="space-y-3">
        {/* Stats card */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl shadow-md border border-emerald-100 overflow-hidden">
          <div className="bg-emerald-100/60 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              <span className="font-bold text-emerald-900 text-sm">{DAYS[selectedDay]}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold num">
              {sessions.length} حدث
            </span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-900 num">{sessions.length}</p>
              <p className="text-[10px] text-emerald-700">حصة اليوم</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-700 num">
                {sessions.filter(s => (s.notes || '').includes('محاضرة')).length}
              </p>
              <p className="text-[10px] text-amber-700">محاضرات</p>
            </div>
          </div>
        </div>

        {/* Quick day jump */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-3">
          <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> انتقال سريع
          </h4>
          <div className="grid grid-cols-4 gap-1.5">
            {DAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={`text-xs font-bold py-1.5 rounded-lg transition
                  ${selectedDay === i
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}
                `}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-3">
          <h4 className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> مفتاح الألوان
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }} />
              <span className="text-emerald-800">حصة عامة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-emerald-800">محاضرة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-emerald-800">أعمال تطبيقية</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ TEACHER VIEW ============
function TeacherView({ isDirector }: { isDirector: boolean }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('all');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const url = selectedTeacher !== 'all' ? `/api/timetable/sessions?teacherId=${selectedTeacher}` : '/api/timetable/sessions';
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedTeacher]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3 flex items-center gap-3 flex-wrap">
        <GraduationCap className="w-5 h-5 text-emerald-700" />
        <Label className="text-emerald-900 font-bold">الأستاذ:</Label>
        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger className="max-w-xs border-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأساتذة</SelectItem>
            {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isDirector && selectedTeacher !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/timetable/export/excel?view=teacher&id=${selectedTeacher}`, '_blank')}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-4 h-4 ml-1" /> Excel
          </Button>
        )}
      </div>

      <TimetableGrid sessions={sessions} loading={loading} />
    </div>
  );
}

// ============ ROOM VIEW ============
function RoomView({ isDirector }: { isDirector: boolean }) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timetable/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const url = selectedRoom !== 'all' ? `/api/timetable/sessions?roomId=${selectedRoom}` : '/api/timetable/sessions';
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedRoom]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3 flex items-center gap-3 flex-wrap">
        <Building2 className="w-5 h-5 text-emerald-700" />
        <Label className="text-emerald-900 font-bold">القاعة:</Label>
        <Select value={selectedRoom} onValueChange={setSelectedRoom}>
          <SelectTrigger className="max-w-xs border-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل القاعات</SelectItem>
            {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isDirector && selectedRoom !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/timetable/export/excel?view=room&id=${selectedRoom}`, '_blank')}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-4 h-4 ml-1" /> Excel
          </Button>
        )}
      </div>

      <TimetableGrid sessions={sessions} loading={loading} />
    </div>
  );
}

// ============ GROUP VIEW ============
function GroupView({ isDirector }: { isDirector: boolean }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timetable/groups').then(r => r.json()).then(d => setGroups(d.groups || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const url = selectedGroup !== 'all' ? `/api/timetable/sessions?groupId=${selectedGroup}` : '/api/timetable/sessions';
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedGroup]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3 flex items-center gap-3 flex-wrap">
        <Users className="w-5 h-5 text-emerald-700" />
        <Label className="text-emerald-900 font-bold">الفوج:</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="max-w-xs border-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأفواج</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isDirector && selectedGroup !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/timetable/export/excel?view=group&id=${selectedGroup}`, '_blank')}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-4 h-4 ml-1" /> Excel
          </Button>
        )}
      </div>

      <TimetableGrid sessions={sessions} loading={loading} />
    </div>
  );
}

// ============ SUBJECT VIEW ============
function SubjectView({ isDirector }: { isDirector: boolean }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timetable/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const url = selectedSubject !== 'all' ? `/api/timetable/sessions?subjectId=${selectedSubject}` : '/api/timetable/sessions';
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedSubject]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3 flex items-center gap-3 flex-wrap">
        <BookText className="w-5 h-5 text-emerald-700" />
        <Label className="text-emerald-900 font-bold">المادة:</Label>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="max-w-xs border-emerald-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المواد</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isDirector && selectedSubject !== 'all' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/timetable/export/excel?view=subject&id=${selectedSubject}`, '_blank')}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <Download className="w-4 h-4 ml-1" /> Excel
          </Button>
        )}
      </div>

      <TimetableGrid sessions={sessions} loading={loading} />
    </div>
  );
}

// ============ DEPARTMENT VIEW (جدول مخصص لكل قسم) ============
function DepartmentView({ isDirector }: { isDirector: boolean }) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    dayOfWeek: 0, startTime: '08:00', endTime: '10:00',
    teacherId: '', roomId: '', groupId: '', subjectId: '', notes: '',
  });
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/timetable/subjects').then(r => r.json()).then(d => setSubjects(d.subjects || []));
    fetch('/api/timetable/groups').then(r => r.json()).then(d => setGroups(d.groups || []));
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
    fetch('/api/timetable/rooms').then(r => r.json()).then(d => setRooms(d.rooms || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/timetable/sessions');
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Filter subjects/groups/sessions by selected department
  const deptSubjects = useMemo(() =>
    selectedDept === 'all' ? subjects : subjects.filter(s => s.departmentId === selectedDept),
    [subjects, selectedDept]
  );
  const deptGroups = useMemo(() =>
    selectedDept === 'all' ? groups : groups.filter(g => g.departmentId === selectedDept),
    [groups, selectedDept]
  );
  const deptSessions = useMemo(() => {
    const subjectIds = new Set(deptSubjects.map(s => s.id));
    const groupIds = new Set(deptGroups.map(g => g.id));
    return sessions.filter(s =>
      (s.subjectId && subjectIds.has(s.subjectId)) ||
      (s.groupId && groupIds.has(s.groupId))
    );
  }, [sessions, deptSubjects, deptGroups]);

  // Per-subject progress (scheduled hours / weekly hours)
  const subjectProgress = useMemo(() => {
    return deptSubjects.map(subj => {
      const subjSessions = deptSessions.filter(s => s.subjectId === subj.id);
      const scheduledMinutes = subjSessions.reduce((sum, s) => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return sum + ((eh * 60 + em) - (sh * 60 + sm));
      }, 0);
      const scheduledHours = scheduledMinutes / 60;
      return {
        ...subj,
        scheduledHours,
        weeklyHours: subj.weeklyHours || 0,
        sessionsCount: subjSessions.length,
        progress: subj.weeklyHours > 0 ? Math.min(100, (scheduledHours / subj.weeklyHours) * 100) : 0,
      };
    });
  }, [deptSubjects, deptSessions]);

  const checkConflicts = async (data: any, excludeId?: string) => {
    const res = await fetch('/api/timetable/check-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, excludeId }),
    });
    const result = await res.json();
    setConflicts(result.errors || []);
    setWarnings(result.warnings || []);
    return result;
  };

  const handleOpenAdd = (dayOfWeek?: number, startTime?: string, endTime?: string, subjectId?: string) => {
    setEditingSession(null);
    setFormData({
      dayOfWeek: dayOfWeek ?? 0,
      startTime: startTime || '08:00',
      endTime: endTime || '10:00',
      teacherId: '', roomId: '',
      groupId: '', subjectId: subjectId || '',
      notes: '',
    });
    setConflicts([]);
    setWarnings([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: any) => {
    setEditingSession(s);
    setFormData({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      teacherId: s.teacherId || '',
      roomId: s.roomId || '',
      groupId: s.groupId || '',
      subjectId: s.subjectId || '',
      notes: s.notes || '',
    });
    setConflicts([]);
    setWarnings([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const teacher = teachers.find(t => t.id === formData.teacherId);
    const room = rooms.find(r => r.id === formData.roomId);
    const group = groups.find(g => g.id === formData.groupId);
    const subject = subjects.find(s => s.id === formData.subjectId);
    const payload = {
      ...formData,
      dayOfWeek: parseInt(formData.dayOfWeek),
      teacherName: teacher?.name || null,
      roomName: room?.name || null,
      groupName: group?.name || null,
      subjectName: subject?.name || null,
      color: subject?.color || null,
    };
    const result = await checkConflicts(payload, editingSession?.id);
    if (result.hasConflicts) {
      toast({ title: 'تعارض!', description: 'يوجد تعارض يمنع الحفظ. راجع الرسائل.', variant: 'destructive' });
      return;
    }
    const url = editingSession ? `/api/timetable/sessions/${editingSession.id}` : '/api/timetable/sessions';
    const method = editingSession ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: editingSession ? 'تم تحديث الحصة' : 'تمت إضافة الحصة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (s: any) => {
    if (!confirm('حذف هذه الحصة؟')) return;
    const res = await fetch(`/api/timetable/sessions/${s.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  // Build time slots
  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    deptSessions.forEach(s => slots.add(s.startTime));
    return Array.from(slots).sort();
  }, [deptSessions]);
  const displaySlots = timeSlots.length > 0 ? timeSlots : ['08:00', '10:00', '13:00', '15:00'];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="font-bold text-emerald-900">القسم:</Label>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="max-w-xs border-emerald-200 text-emerald-900"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDirector && (
            <Button onClick={() => handleOpenAdd()} className="bg-emerald-700 hover:bg-emerald-800 text-white">
              <Plus className="w-4 h-4 ml-2" /> إضافة حصة
            </Button>
          )}
          {isDirector && selectedDept !== 'all' && (
            <Button variant="outline" onClick={() => window.open(`/api/timetable/export/excel?view=department&id=${selectedDept}`, '_blank')} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Download className="w-4 h-4 ml-2" /> Excel
            </Button>
          )}
        </div>
      </div>

      {/* Department stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">المواد</span>
            <BookText className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-900">{deptSubjects.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">الأفواج</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-900">{deptGroups.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">الحصص المبرمجة</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-900">{deptSessions.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">نسبة الإكمال</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold num text-amber-700">
            {subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((s, p) => s + p.progress, 0) / subjectProgress.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Subjects progress list */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
          <BookText className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">تتبع المواد - ساعات مبرمجة / ساعات أسبوعية</h3>
        </div>
        <div className="p-4">
          {subjectProgress.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <BookText className="w-8 h-8 text-emerald-300" />
              </div>
              <p className="font-bold text-emerald-900 text-base">لا توجد مواد</p>
              <p className="text-xs text-muted-foreground mt-1">لا توجد مواد في هذا القسم</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjectProgress.map(subj => {
                const isComplete = subj.progress >= 100;
                const isOver = subj.scheduledHours > subj.weeklyHours;
                const isUnder = subj.scheduledHours < subj.weeklyHours;
                return (
                  <div
                    key={subj.id}
                    className={`p-3 rounded-xl border-2 cursor-pointer hover:shadow-md transition-shadow ${
                      isOver ? 'border-red-300 bg-red-50/50' :
                      isComplete ? 'border-emerald-300 bg-emerald-50/50' :
                      isUnder && subj.scheduledHours > 0 ? 'border-amber-300 bg-amber-50/50' :
                      'border-emerald-100 bg-emerald-50/30'
                    }`}
                    onClick={() => isDirector && handleOpenAdd(undefined, undefined, undefined, subj.id)}
                    title={isDirector ? 'اضغط لإضافة حصة لهذه المادة' : ''}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: subj.color || '#3b82f6' }}
                        />
                        <span className="font-bold text-sm text-emerald-900">{subj.name}</span>
                      </div>
                      <Badge variant={isComplete ? 'default' : isOver ? 'destructive' : 'secondary'} className="text-xs">
                        {subj.sessionsCount} حصة
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-emerald-50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOver ? 'bg-red-500' :
                            isComplete ? 'bg-emerald-500' :
                            'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, subj.progress)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold num text-emerald-700">
                        {subj.scheduledHours.toFixed(1)} / {subj.weeklyHours} س
                      </span>
                    </div>
                    {subj.requiredRoomType && (
                      <p className="text-xs text-emerald-600">
                        تحتاج: {ROOM_TYPES.find(rt => rt.value === subj.requiredRoomType)?.label || subj.requiredRoomType}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive week grid - CSS Grid for RTL */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">جدول القسم</h3>
          {selectedDept !== 'all' && (
            <Badge variant="outline" className="mr-2 bg-amber-400 text-emerald-900 border-0">
              {departments.find(d => d.id === selectedDept)?.name}
            </Badge>
          )}
        </div>
        {loading ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Clock className="w-8 h-8 text-emerald-300 animate-spin" />
            </div>
            <p className="font-bold text-emerald-900 text-base">جاري التحميل...</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-2">
            <div style={{ minWidth: '800px' }}>
              {/* Header row */}
              <div
                className="grid gap-1 px-2 py-2 bg-emerald-50 font-bold text-sm border-b border-emerald-100"
                style={{ gridTemplateColumns: `100px repeat(${DAYS.length}, 1fr)` }}
              >
                <div className="text-center text-emerald-900">التوقيت</div>
                {DAYS.map((day, i) => <div key={i} className="text-center text-emerald-900">{day}</div>)}
              </div>
              {/* Time slot rows */}
              {displaySlots.map(time => {
                const [h, m] = time.split(':').map(Number);
                const endH = h + 2;
                const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return (
                  <div
                    key={time}
                    className="grid gap-1 px-2 py-1 border-b border-emerald-100 hover:bg-emerald-50/30 transition"
                    style={{ gridTemplateColumns: `100px repeat(${DAYS.length}, 1fr)` }}
                  >
                    <div className="text-xs text-center num font-bold bg-emerald-50 rounded-lg p-2 flex flex-col justify-center text-emerald-800">
                      <span>{time}</span>
                      <span className="text-emerald-500">← {endTime}</span>
                    </div>
                    {DAYS.map((_, dayIdx) => {
                      const daySessions = deptSessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                      return (
                        <div key={dayIdx} className="border border-emerald-100 rounded-lg p-1 min-h-16 space-y-1">
                          {daySessions.map(s => (
                            <div
                              key={s.id}
                              className="p-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: (s.color || s.subject?.color || '#3b82f6') + '20',
                                borderRight: `3px solid ${s.color || s.subject?.color || '#3b82f6'}`,
                              }}
                              onClick={() => handleOpenEdit(s)}
                            >
                              <div className="font-bold text-emerald-900">{s.subjectName || '-'}</div>
                              <div className="text-emerald-700">{s.teacherName || '-'}</div>
                              <div className="text-emerald-600">📍 {s.roomName || '-'}</div>
                              <div className="text-emerald-600">👥 {s.groupName || '-'}</div>
                              {isDirector && (
                                <button
                                  className="mt-1 text-xs text-red-600 hover:underline"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          ))}
                          {isDirector && daySessions.length === 0 && (
                            <button
                              className="w-full text-xs text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg p-1 transition-colors border border-dashed border-emerald-200"
                              onClick={() => handleOpenAdd(dayIdx, time, endTime)}
                            >
                              + إضافة
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialog */}
      <SessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingSession}
        formData={formData}
        setFormData={setFormData}
        teachers={teachers}
        rooms={rooms}
        groups={selectedDept !== 'all' ? deptGroups : groups}
        subjects={selectedDept !== 'all' ? deptSubjects : subjects}
        conflicts={conflicts}
        warnings={warnings}
        onSave={handleSave}
        onCheckConflict={(data: any) => checkConflicts(data, editingSession?.id)}
      />
    </div>
  );
}

// ============ CONFLICTS DASHBOARD (لوحة التعارضات) ============
function ConflictsDashboard({ isDirector }: { isDirector: boolean }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/timetable/sessions');
    const data = await res.json();
    setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Detect all conflicts client-side
  const conflicts = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'teacher' | 'room' | 'group';
      severity: 'error';
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      sessions: any[];
      title: string;
      description: string;
    }> = [];

    // Group sessions by day
    for (let day = 0; day < 7; day++) {
      const daySessions = sessions.filter(s => s.dayOfWeek === day);
      // Compare each pair
      for (let i = 0; i < daySessions.length; i++) {
        for (let j = i + 1; j < daySessions.length; j++) {
          const a = daySessions[i];
          const b = daySessions[j];
          // Check time overlap
          const aStart = a.startTime, aEnd = a.endTime;
          const bStart = b.startTime, bEnd = b.endTime;
          if (!timesOverlap(aStart, aEnd, bStart, bEnd)) continue;

          // Teacher conflict
          if (a.teacherId && b.teacherId && a.teacherId === b.teacherId) {
            list.push({
              id: `teacher-${a.id}-${b.id}`,
              type: 'teacher',
              severity: 'error',
              dayOfWeek: day,
              startTime: aStart < bStart ? aStart : bStart,
              endTime: aEnd > bEnd ? aEnd : bEnd,
              sessions: [a, b],
              title: `تعارض أستاذ: ${a.teacherName}`,
              description: `الأستاذ ${a.teacherName} لديه حصتان متعارضتان في ${DAYS[day]}`,
            });
          }
          // Room conflict
          if (a.roomId && b.roomId && a.roomId === b.roomId) {
            list.push({
              id: `room-${a.id}-${b.id}`,
              type: 'room',
              severity: 'error',
              dayOfWeek: day,
              startTime: aStart < bStart ? aStart : bStart,
              endTime: aEnd > bEnd ? aEnd : bEnd,
              sessions: [a, b],
              title: `تعارض قاعة: ${a.roomName}`,
              description: `القاعة ${a.roomName} محجوزة لحصتين في ${DAYS[day]}`,
            });
          }
          // Group conflict
          if (a.groupId && b.groupId && a.groupId === b.groupId) {
            list.push({
              id: `group-${a.id}-${b.id}`,
              type: 'group',
              severity: 'error',
              dayOfWeek: day,
              startTime: aStart < bStart ? aStart : bStart,
              endTime: aEnd > bEnd ? aEnd : bEnd,
              sessions: [a, b],
              title: `تعارض فوج: ${a.groupName}`,
              description: `الفوج ${a.groupName} لديه حصتان متعارضتان في ${DAYS[day]}`,
            });
          }
        }
      }
    }
    return list;
  }, [sessions]);

  // Group conflicts by type for stats
  const conflictStats = useMemo(() => ({
    total: conflicts.length,
    teacher: conflicts.filter(c => c.type === 'teacher').length,
    room: conflicts.filter(c => c.type === 'room').length,
    group: conflicts.filter(c => c.type === 'group').length,
  }), [conflicts]);

  // Sessions involved in conflicts (for grid highlighting)
  const conflictedSessionIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach(c => c.sessions.forEach(s => ids.add(s.id)));
    return ids;
  }, [conflicts]);

  const handleDelete = async (s: any) => {
    if (!confirm('حذف هذه الحصة لحل التعارض؟')) return;
    const res = await fetch(`/api/timetable/sessions/${s.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم حذف الحصة' });
      load();
    }
  };

  // Build time slots
  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    sessions.forEach(s => slots.add(s.startTime));
    return Array.from(slots).sort();
  }, [sessions]);
  const displaySlots = timeSlots.length > 0 ? timeSlots : ['08:00', '10:00', '13:00', '15:00'];

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`rounded-2xl shadow-md border p-4 ${conflictStats.total > 0 ? 'border-red-200 bg-red-50/50' : 'border-emerald-100 bg-emerald-50/50'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">إجمالي التعارضات</span>
            {conflictStats.total > 0
              ? <AlertTriangle className="w-4 h-4 text-red-600" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            }
          </div>
          <p className={`text-2xl font-bold num ${conflictStats.total > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {conflictStats.total}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">تعارضات الأساتذة</span>
            <User className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold num text-amber-700">{conflictStats.teacher}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">تعارضات القاعات</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold num text-amber-700">{conflictStats.room}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">تعارضات الأفواج</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-700">{conflictStats.group}</p>
        </div>
      </div>

      {conflictStats.total === 0 && !loading && (
        <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-emerald-900 mb-1">لا توجد تعارضات</h3>
          <p className="text-sm text-emerald-700">الجدول الحالي خالٍ من تعارضات المواعيد والقاعات والأساتذة</p>
        </div>
      )}

      {/* Conflicts list */}
      {conflicts.length > 0 && (
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold">قائمة التعارضات</h3>
            <Badge variant="destructive" className="mr-2 text-xs">{conflicts.length}</Badge>
          </div>
          <div className="p-4 space-y-2">
            {conflicts.map(c => {
              const isSelected = selectedConflict === c.id;
              const icon = c.type === 'teacher' ? <User className="w-4 h-4" /> :
                           c.type === 'room' ? <Building2 className="w-4 h-4" /> :
                           <Users className="w-4 h-4" />;
              const color = c.type === 'teacher' ? 'text-amber-700 bg-amber-50' :
                            c.type === 'room' ? 'text-amber-700 bg-amber-100' :
                            'text-emerald-700 bg-emerald-50';
              return (
                <div
                  key={c.id}
                  className={`border rounded-xl p-3 cursor-pointer transition-all ${
                    isSelected ? 'border-red-400 bg-red-50/50 shadow-md' : 'border-emerald-100 hover:border-red-200'
                  }`}
                  onClick={() => setSelectedConflict(isSelected ? null : c.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-emerald-900">{c.title}</p>
                        <p className="text-xs text-emerald-700 mt-1">{c.description}</p>
                        <p className="text-xs text-emerald-600 mt-1">
                          📅 {DAYS[c.dayOfWeek]} • ⏰ {c.startTime} - {c.endTime}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">تعارض</Badge>
                  </div>
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-emerald-100 space-y-2">
                      <p className="text-xs font-bold text-emerald-700">الحصص المتعارضة:</p>
                      {c.sessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-emerald-50/50 rounded-lg p-2 border border-emerald-100 text-sm">
                          <div className="flex-1">
                            <span className="font-bold text-emerald-900">{s.subjectName || '-'}</span>
                            <span className="text-emerald-600 mx-2">•</span>
                            <span className="text-emerald-700">{s.teacherName || '-'}</span>
                            <span className="text-emerald-600 mx-2">•</span>
                            <span className="text-emerald-700">📍 {s.roomName || '-'}</span>
                            <span className="text-emerald-600 mx-2">•</span>
                            <span className="text-emerald-700">👥 {s.groupName || '-'}</span>
                            <span className="text-emerald-600 mx-2">•</span>
                            <span className="num text-emerald-900 font-bold">{s.startTime} - {s.endTime}</span>
                          </div>
                          {isDirector && (
                            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDelete(s); }}>
                              <Trash2 className="w-3.5 h-3.5 ml-1" /> حذف
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual week grid with conflict highlighting */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
          <Network className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">الجدول العام مع إبراز التعارضات</h3>
        </div>
        {loading ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Clock className="w-8 h-8 text-emerald-300 animate-spin" />
            </div>
            <p className="font-bold text-emerald-900 text-base">جاري التحميل...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Calendar className="w-8 h-8 text-emerald-300" />
            </div>
            <p className="font-bold text-emerald-900 text-base">لا توجد حصص</p>
            <p className="text-xs text-muted-foreground mt-1">لم يتم العثور على حصص مطابقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-2">
            <div style={{ minWidth: '800px' }}>
              {/* Header */}
              <div
                className="grid gap-1 px-2 py-2 bg-emerald-50 font-bold text-sm border-b border-emerald-100"
                style={{ gridTemplateColumns: `100px repeat(${DAYS.length}, 1fr)` }}
              >
                <div className="text-center text-emerald-900">التوقيت</div>
                {DAYS.map((day, i) => <div key={i} className="text-center text-emerald-900">{day}</div>)}
              </div>
              {/* Rows */}
              {displaySlots.map(time => {
                const [h, m] = time.split(':').map(Number);
                const endH = h + 2;
                const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return (
                  <div
                    key={time}
                    className="grid gap-1 px-2 py-1 border-b border-emerald-100 hover:bg-emerald-50/30 transition"
                    style={{ gridTemplateColumns: `100px repeat(${DAYS.length}, 1fr)` }}
                  >
                    <div className="text-xs text-center num font-bold bg-emerald-50 rounded-lg p-2 flex flex-col justify-center text-emerald-800">
                      <span>{time}</span>
                      <span className="text-emerald-500">← {endTime}</span>
                    </div>
                    {DAYS.map((_, dayIdx) => {
                      const daySessions = sessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                      return (
                        <div key={dayIdx} className="border border-emerald-100 rounded-lg p-1 min-h-16 space-y-1">
                          {daySessions.map(s => {
                            const isConflicted = conflictedSessionIds.has(s.id);
                            const color = s.color || s.subject?.color || '#3b82f6';
                            return (
                              <div
                                key={s.id}
                                className={`p-2 rounded-lg text-xs transition-all ${
                                  isConflicted ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                } ${selectedConflict && conflicts.find(c => c.id === selectedConflict)?.sessions.find(es => es.id === s.id) ? 'ring-4 ring-red-600' : ''
                                }`}
                                style={{
                                  backgroundColor: isConflicted ? '#fef2f2' : color + '20',
                                  borderRight: `3px solid ${isConflicted ? '#ef4444' : color}`,
                                }}
                                title={isConflicted ? 'هذه الحصة في تعارض' : ''}
                              >
                                <div className="font-bold text-emerald-900 flex items-center gap-1">
                                  {isConflicted && <AlertTriangle className="w-3 h-3 text-red-600" />}
                                  {s.subjectName || '-'}
                                </div>
                                <div className="text-emerald-700">{s.teacherName || '-'}</div>
                                <div className="text-emerald-600">📍 {s.roomName || '-'}</div>
                                <div className="text-emerald-600">👥 {s.groupName || '-'}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Helper: check if two time ranges overlap. */
function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = parse(start1), e1 = parse(end1), s2 = parse(start2), e2 = parse(end2);
  return s1 < e2 && s2 < e1;
}

// ============ TIMETABLE GRID (reusable) ============
function TimetableGrid({ sessions, loading }: { sessions: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 text-center">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-500" />
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      </div>
    );
  }

  const timeSlots = Array.from(new Set(sessions.map(s => s.startTime))).sort();
  const today = new Date().getDay();

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      {sessions.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <Calendar className="w-8 h-8 text-emerald-300" />
          </div>
          <p className="font-bold text-emerald-900 text-base">لا توجد حصص</p>
          <p className="text-xs text-muted-foreground mt-1">لم يتم العثور على حصص مطابقة</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-emerald-50">
                <th className="border border-emerald-100 p-2 text-sm w-24 text-emerald-900 font-bold">
                  <Clock className="w-4 h-4 inline ml-1" /> التوقيت
                </th>
                {DAYS.map((day, i) => (
                  <th
                    key={i}
                    className={`border border-emerald-100 p-2 text-sm font-bold ${
                      today === i ? 'bg-amber-100 text-emerald-900' : 'text-emerald-900'
                    }`}
                  >
                    {day}
                    {today === i && <span className="block text-[10px] text-amber-600 font-normal">اليوم</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(time => (
                <tr key={time} className="hover:bg-emerald-50/30 transition">
                  <td className="border border-emerald-100 p-2 text-xs text-center num font-bold bg-emerald-50/50 text-emerald-800">
                    {time}
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const daySessions = sessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                    return (
                      <td key={dayIdx} className="border border-emerald-100 p-1 align-top">
                        <div className="space-y-1">
                          {daySessions.map(s => {
                            const sessionColor = s.color || s.subject?.color || '#3b82f6';
                            const notes = s.notes || '';
                            let badgeClass = '';
                            if (notes.includes('محاضرة')) {
                              badgeClass = 'bg-blue-50 border-blue-200';
                            } else if (notes.includes('أعمال') || notes.includes('تطبيق')) {
                              badgeClass = 'bg-amber-50 border-amber-200';
                            } else {
                              badgeClass = 'bg-emerald-50 border-emerald-200';
                            }
                            return (
                              <div
                                key={s.id}
                                className={`p-2 rounded-xl text-xs border ${badgeClass}`}
                                style={{ borderRight: `4px solid ${sessionColor}` }}
                              >
                                <div className="font-bold text-emerald-900">{s.subjectName || '-'}</div>
                                <div className="text-emerald-700 mt-0.5 flex items-center gap-1">
                                  <User className="w-3 h-3" /> {s.teacherName || '-'}
                                </div>
                                <div className="text-emerald-600 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" /> {s.roomName || '-'}
                                </div>
                                {s.groupName && (
                                  <div className="text-emerald-600 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {s.groupName}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ MANAGEMENT VIEW ============
function ManagementView({ isDirector }: { isDirector: boolean }) {
  const [tab, setTab] = useState('rooms');
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100 p-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 bg-emerald-50">
            <TabsTrigger value="rooms"><DoorOpen className="w-4 h-4 ml-1" /> قاعات</TabsTrigger>
            <TabsTrigger value="groups"><Users className="w-4 h-4 ml-1" /> أفواج</TabsTrigger>
            <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 ml-1" /> مواد</TabsTrigger>
            <TabsTrigger value="timeslots"><Clock className="w-4 h-4 ml-1" /> فترات</TabsTrigger>
            <TabsTrigger value="holidays"><PartyPopper className="w-4 h-4 ml-1" /> عطل</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 ml-1" /> دوام</TabsTrigger>
            {isDirector && <TabsTrigger value="generate"><Sparkles className="w-4 h-4 ml-1" /> توليد</TabsTrigger>}
          </TabsList>
          <div className="mt-4">
            <TabsContent value="rooms"><RoomsManagement isDirector={isDirector} /></TabsContent>
            <TabsContent value="groups"><GroupsManagement isDirector={isDirector} /></TabsContent>
            <TabsContent value="subjects"><SubjectsManagement isDirector={isDirector} /></TabsContent>
            <TabsContent value="timeslots"><TimeSlotsManagement isDirector={isDirector} /></TabsContent>
            <TabsContent value="holidays"><HolidaysManagement isDirector={isDirector} /></TabsContent>
            <TabsContent value="settings"><WorkSettingsManagement /></TabsContent>
            {isDirector && <TabsContent value="generate"><AutoGenerateView /></TabsContent>}
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ============ ROOMS MANAGEMENT ============
function RoomsManagement({ isDirector }: { isDirector: boolean }) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', code: '', capacity: '30', type: 'classroom', building: '', floor: '', notes: '' });
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/rooms');
    const data = await res.json();
    setRooms(data.rooms || []);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const url = editing ? `/api/timetable/rooms/${editing.id}` : '/api/timetable/rooms';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { toast({ title: 'تم' }); setDialogOpen(false); load(); }
    else toast({ title: 'خطأ', variant: 'destructive' });
  };

  const handleDelete = async (r: any) => {
    if (!confirm('حذف القاعة؟')) return;
    await fetch(`/api/timetable/rooms/${r.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">القاعات</h3>
          <Badge className="bg-amber-400 text-emerald-900 border-0">{rooms.length}</Badge>
        </div>
        {isDirector && <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-emerald-900" onClick={() => { setEditing(null); setFormData({ name: '', code: '', capacity: '30', type: 'classroom', building: '', floor: '', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </div>
      <div className="p-2">
        <Table>
          <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100">
            <TableHead className="text-emerald-900 font-bold">الاسم</TableHead><TableHead className="text-emerald-900 font-bold">الكود</TableHead><TableHead className="text-emerald-900 font-bold">النوع</TableHead><TableHead className="text-emerald-900 font-bold">السعة</TableHead>
            <TableHead className="text-center text-emerald-900 font-bold">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rooms.map(r => (
              <TableRow key={r.id} className="hover:bg-emerald-50/30 border-emerald-100">
                <TableCell className="font-bold text-emerald-900">{r.name}</TableCell>
                <TableCell className="num text-emerald-700">{r.code || '-'}</TableCell>
                <TableCell><Badge variant="outline" className="border-emerald-200 text-emerald-700">{ROOM_TYPES.find(rt => rt.value === r.type)?.label || r.type}</Badge></TableCell>
                <TableCell className="num font-bold text-emerald-900">{r.capacity}</TableCell>
                <TableCell className="text-center">
                  {isDirector && <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setFormData({ name: r.name, code: r.code || '', capacity: String(r.capacity), type: r.type, building: r.building || '', floor: r.floor || '', notes: r.notes || '' }); setDialogOpen(true); }}><Edit className="w-4 h-4 text-amber-600" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-emerald-100">
          <DialogHeader><DialogTitle className="text-emerald-900">{editing ? 'تعديل قاعة' : 'إضافة قاعة'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">النوع</Label><Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}><SelectTrigger className="border-emerald-200"><SelectValue /></SelectTrigger><SelectContent>{ROOM_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">السعة</Label><Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">المبنى</Label><Input value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الطابق</Label><Input value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ GROUPS MANAGEMENT ============
function GroupsManagement({ isDirector }: { isDirector: boolean }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', code: '', departmentId: '', specializationId: '', level: '', studentCount: '0', notes: '' });
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/groups');
    const data = await res.json();
    setGroups(data.groups || []);
  };
  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/specializations').then(r => r.json()).then(d => setSpecializations(d.specializations || []));
    load();
  }, []);

  const handleSave = async () => {
    const url = editing ? `/api/timetable/groups/${editing.id}` : '/api/timetable/groups';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { toast({ title: 'تم' }); setDialogOpen(false); load(); }
  };

  const handleDelete = async (g: any) => {
    if (!confirm('حذف الفوج؟')) return;
    await fetch(`/api/timetable/groups/${g.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">الأفواج</h3>
          <Badge className="bg-amber-400 text-emerald-900 border-0">{groups.length}</Badge>
        </div>
        {isDirector && <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-emerald-900" onClick={() => { setEditing(null); setFormData({ name: '', code: '', departmentId: '', specializationId: '', level: '', studentCount: '0', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </div>
      <div className="p-2">
        <Table>
          <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100">
            <TableHead className="text-emerald-900 font-bold">الاسم</TableHead><TableHead className="text-emerald-900 font-bold">القسم</TableHead><TableHead className="text-emerald-900 font-bold">التخصص</TableHead><TableHead className="text-emerald-900 font-bold">العدد</TableHead>
            <TableHead className="text-center text-emerald-900 font-bold">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {groups.map(g => (
              <TableRow key={g.id} className="hover:bg-emerald-50/30 border-emerald-100">
                <TableCell className="font-bold text-emerald-900">{g.name}</TableCell>
                <TableCell className="text-emerald-700">{g.department?.name || '-'}</TableCell>
                <TableCell className="text-emerald-700">{g.specialization?.name || '-'}</TableCell>
                <TableCell className="num font-bold text-emerald-900">{g.studentCount}</TableCell>
                <TableCell className="text-center">
                  {isDirector && <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(g); setFormData({ name: g.name, code: g.code || '', departmentId: g.departmentId || '', specializationId: g.specializationId || '', level: g.level || '', studentCount: String(g.studentCount), notes: g.notes || '' }); setDialogOpen(true); }}><Edit className="w-4 h-4 text-amber-600" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(g)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-emerald-100">
          <DialogHeader><DialogTitle className="text-emerald-900">{editing ? 'تعديل فوج' : 'إضافة فوج'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">القسم</Label><Select value={formData.departmentId || 'none'} onValueChange={(v) => setFormData({ ...formData, departmentId: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">التخصص</Label><Select value={formData.specializationId || 'none'} onValueChange={(v) => setFormData({ ...formData, specializationId: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{specializations.filter(s => !formData.departmentId || s.departmentId === formData.departmentId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">المستوى</Label><Input value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">عدد الطلاب</Label><Input type="number" value={formData.studentCount} onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ SUBJECTS MANAGEMENT ============
function SubjectsManagement({ isDirector }: { isDirector: boolean }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', code: '', departmentId: '', specializationId: '', weeklyHours: '2', requiredRoomType: '', color: '#3b82f6', teacherId: '', notes: '' });
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/subjects');
    const data = await res.json();
    setSubjects(data.subjects || []);
  };
  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/specializations').then(r => r.json()).then(d => setSpecializations(d.specializations || []));
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
    load();
  }, []);

  const handleSave = async () => {
    const url = editing ? `/api/timetable/subjects/${editing.id}` : '/api/timetable/subjects';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { toast({ title: 'تم' }); setDialogOpen(false); load(); }
  };

  const handleDelete = async (s: any) => {
    if (!confirm('حذف المادة؟')) return;
    await fetch(`/api/timetable/subjects/${s.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">المواد</h3>
          <Badge className="bg-amber-400 text-emerald-900 border-0">{subjects.length}</Badge>
        </div>
        {isDirector && <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-emerald-900" onClick={() => { setEditing(null); setFormData({ name: '', code: '', departmentId: '', specializationId: '', weeklyHours: '2', requiredRoomType: '', color: '#3b82f6', teacherId: '', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </div>
      <div className="p-2">
        <Table>
          <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100">
            <TableHead className="text-emerald-900 font-bold">المادة</TableHead><TableHead className="text-emerald-900 font-bold">القسم</TableHead><TableHead className="text-emerald-900 font-bold">ساعات/أسبوع</TableHead><TableHead className="text-emerald-900 font-bold">الأستاذ</TableHead><TableHead className="text-emerald-900 font-bold">النوع المطلوب</TableHead>
            <TableHead className="text-center text-emerald-900 font-bold">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subjects.map(s => (
              <TableRow key={s.id} className="hover:bg-emerald-50/30 border-emerald-100">
                <TableCell className="font-bold text-emerald-900">
                  <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ backgroundColor: s.color || '#3b82f6' }}></span>
                  {s.name}
                </TableCell>
                <TableCell className="text-emerald-700">{s.department?.name || '-'}</TableCell>
                <TableCell className="num font-bold text-emerald-900">{s.weeklyHours}</TableCell>
                <TableCell className="text-emerald-700">{s.teacher?.name || '-'}</TableCell>
                <TableCell>{s.requiredRoomType ? <Badge variant="outline" className="border-emerald-200 text-emerald-700">{ROOM_TYPES.find(rt => rt.value === s.requiredRoomType)?.label || s.requiredRoomType}</Badge> : '-'}</TableCell>
                <TableCell className="text-center">
                  {isDirector && <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setFormData({ name: s.name, code: s.code || '', departmentId: s.departmentId || '', specializationId: s.specializationId || '', weeklyHours: String(s.weeklyHours), requiredRoomType: s.requiredRoomType || '', color: s.color || '#3b82f6', teacherId: s.teacherId || '', notes: s.notes || '' }); setDialogOpen(true); }}><Edit className="w-4 h-4 text-amber-600" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl border-emerald-100">
          <DialogHeader><DialogTitle className="text-emerald-900">{editing ? 'تعديل مادة' : 'إضافة مادة'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">القسم</Label><Select value={formData.departmentId || 'none'} onValueChange={(v) => setFormData({ ...formData, departmentId: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">التخصص</Label><Select value={formData.specializationId || 'none'} onValueChange={(v) => setFormData({ ...formData, specializationId: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{specializations.filter(s => !formData.departmentId || s.departmentId === formData.departmentId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الساعات الأسبوعية</Label><Input type="number" value={formData.weeklyHours} onChange={(e) => setFormData({ ...formData, weeklyHours: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">نوع القاعة المطلوب</Label><Select value={formData.requiredRoomType || 'none'} onValueChange={(v) => setFormData({ ...formData, requiredRoomType: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="أي قاعة" /></SelectTrigger><SelectContent><SelectItem value="none">أي قاعة</SelectItem>{ROOM_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الأستاذ</Label><Select value={formData.teacherId || 'none'} onValueChange={(v) => setFormData({ ...formData, teacherId: v === 'none' ? '' : v })}><SelectTrigger className="border-emerald-200"><SelectValue placeholder="بدون" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">اللون</Label><div className="flex gap-1">{SUBJECT_COLORS.map(c => <button key={c} type="button" className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: c, borderColor: formData.color === c ? '#065f46' : 'transparent' }} onClick={() => setFormData({ ...formData, color: c })} />)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ TIMESLOTS MANAGEMENT ============
function TimeSlotsManagement({ isDirector }: { isDirector: boolean }) {
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', dayOfWeek: '0', startTime: '08:00', endTime: '10:00', order: '1' });
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/timeslots');
    const data = await res.json();
    setTimeSlots(data.timeSlots || []);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const res = await fetch('/api/timetable/timeslots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { toast({ title: 'تم' }); setDialogOpen(false); load(); }
  };

  const handleDelete = async (t: any) => {
    if (!confirm('حذف الفترة؟')) return;
    await fetch(`/api/timetable/timeslots/${t.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">الفترات الزمنية</h3>
          <Badge className="bg-amber-400 text-emerald-900 border-0">{timeSlots.length}</Badge>
        </div>
        {isDirector && <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-emerald-900" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>}
      </div>
      <div className="p-2">
        <Table>
          <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100"><TableHead className="text-emerald-900 font-bold">الاسم</TableHead><TableHead className="text-emerald-900 font-bold">اليوم</TableHead><TableHead className="text-emerald-900 font-bold">من</TableHead><TableHead className="text-emerald-900 font-bold">إلى</TableHead><TableHead className="text-center text-emerald-900 font-bold">إجراء</TableHead></TableRow></TableHeader>
          <TableBody>
            {timeSlots.map(t => (
              <TableRow key={t.id} className="hover:bg-emerald-50/30 border-emerald-100">
                <TableCell className="font-bold text-emerald-900">{t.name}</TableCell>
                <TableCell className="text-emerald-700">{DAYS[t.dayOfWeek]}</TableCell>
                <TableCell className="num font-bold text-emerald-900">{t.startTime}</TableCell>
                <TableCell className="num font-bold text-emerald-900">{t.endTime}</TableCell>
                <TableCell className="text-center">{isDirector && <Button size="sm" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-emerald-100">
          <DialogHeader><DialogTitle className="text-emerald-900">إضافة فترة زمنية</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">الاسم</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="الحصة 1" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">اليوم</Label><Select value={formData.dayOfWeek} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}><SelectTrigger className="border-emerald-200"><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">من</Label><Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">إلى</Label><Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ HOLIDAYS MANAGEMENT ============
function HolidaysManagement({ isDirector }: { isDirector: boolean }) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ name: '', startDate: '', endDate: '', type: 'holiday' });
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/holidays');
    const data = await res.json();
    setHolidays(data.holidays || []);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const res = await fetch('/api/timetable/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) { toast({ title: 'تم' }); setDialogOpen(false); load(); }
  };

  const handleDelete = async (h: any) => {
    if (!confirm('حذف العطلة؟')) return;
    await fetch(`/api/timetable/holidays/${h.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">العطل</h3>
          <Badge className="bg-amber-400 text-emerald-900 border-0">{holidays.length}</Badge>
        </div>
        {isDirector && <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-emerald-900" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>}
      </div>
      <div className="p-2">
        <Table>
          <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100"><TableHead className="text-emerald-900 font-bold">الاسم</TableHead><TableHead className="text-emerald-900 font-bold">من</TableHead><TableHead className="text-emerald-900 font-bold">إلى</TableHead><TableHead className="text-emerald-900 font-bold">النوع</TableHead><TableHead className="text-center text-emerald-900 font-bold">إجراء</TableHead></TableRow></TableHeader>
          <TableBody>
            {holidays.map(h => (
              <TableRow key={h.id} className="hover:bg-emerald-50/30 border-emerald-100">
                <TableCell className="font-bold text-emerald-900">{h.name}</TableCell>
                <TableCell className="num text-emerald-700">{new Date(h.startDate).toLocaleDateString('ar')}</TableCell>
                <TableCell className="num text-emerald-700">{new Date(h.endDate).toLocaleDateString('ar')}</TableCell>
                <TableCell><Badge variant="outline" className="border-emerald-200 text-emerald-700">{h.type === 'holiday' ? 'عطلة' : h.type === 'exam' ? 'امتحان' : 'حدث'}</Badge></TableCell>
                <TableCell className="text-center">{isDirector && <Button size="sm" variant="ghost" onClick={() => handleDelete(h)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-emerald-100">
          <DialogHeader><DialogTitle className="text-emerald-900">إضافة عطلة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2 md:col-span-2"><Label className="text-emerald-900 font-bold">الاسم</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">من تاريخ</Label><Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">إلى تاريخ</Label><Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
            <div className="space-y-2"><Label className="text-emerald-900 font-bold">النوع</Label><Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}><SelectTrigger className="border-emerald-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="holiday">عطلة</SelectItem><SelectItem value="exam">امتحان</SelectItem><SelectItem value="event">حدث</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ WORK SETTINGS ============
function WorkSettingsManagement() {
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    const res = await fetch('/api/timetable/worksettings');
    const data = await res.json();
    setSettings(data.settings || {});
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const res = await fetch('/api/timetable/worksettings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    });
    if (res.ok) toast({ title: 'تم', description: 'تم حفظ الإعدادات' });
  };

  if (loading) return (
    <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
        <Clock className="w-8 h-8 text-emerald-300 animate-spin" />
      </div>
      <p className="font-bold text-emerald-900 text-base">جاري التحميل...</p>
    </div>
  );

  const days = [
    { value: '0', label: 'الأحد' }, { value: '1', label: 'الإثنين' }, { value: '2', label: 'الثلاثاء' },
    { value: '3', label: 'الأربعاء' }, { value: '4', label: 'الخميس' }, { value: '5', label: 'الجمعة' }, { value: '6', label: 'السبت' },
  ];
  const selectedDays = (settings.workDays || '0,1,2,3,4').split(',');

  const toggleDay = (day: string) => {
    const newDays = selectedDays.includes(day) ? selectedDays.filter(d => d !== day) : [...selectedDays, day].sort();
    setSettings({ ...settings, workDays: newDays.join(',') });
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
        <Settings className="w-5 h-5 text-amber-300" />
        <h3 className="font-bold">إعدادات الدوام</h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <Label className="text-emerald-900 font-bold">أيام العمل</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {days.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${selectedDays.includes(d.value) ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">بداية الدوام</Label><Input type="time" value={settings.workStartTime || '08:00'} onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">نهاية الدوام</Label><Input type="time" value={settings.workEndTime || '18:00'} onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">مدة الحصة (دقيقة)</Label><Input type="number" value={settings.sessionDuration || 120} onChange={(e) => setSettings({ ...settings, sessionDuration: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">مدة الاستراحة (دقيقة)</Label><Input type="number" value={settings.breakDuration || 15} onChange={(e) => setSettings({ ...settings, breakDuration: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">حد الأستاذ الأسبوعي (ساعة)</Label><Input type="number" value={settings.maxTeacherHoursPerWeek || 20} onChange={(e) => setSettings({ ...settings, maxTeacherHoursPerWeek: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
          <div className="space-y-2"><Label className="text-emerald-900 font-bold">أقصى عدد حصص/يوم</Label><Input type="number" value={settings.maxSessionsPerDay || 4} onChange={(e) => setSettings({ ...settings, maxSessionsPerDay: e.target.value })} dir="ltr" className="border-emerald-200 focus:border-emerald-500" /></div>
        </div>
        <Button onClick={handleSave} className="bg-emerald-700 hover:bg-emerald-800 text-white">حفظ الإعدادات</Button>
      </div>
    </div>
  );
}

// ============ AUTO GENERATE ============
function AutoGenerateView() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (clearExisting && !confirm('سيتم حذف كل الحصص الموجودة وتوليد جدول جديد. متابعة؟')) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/timetable/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearExisting }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        toast({ title: 'تم التوليد', description: `تم إنشاء ${data.sessionsCreated} حصة` });
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر التوليد', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-300" />
        <h3 className="font-bold">التوليد التلقائي للجدول</h3>
      </div>
      <div className="p-4 space-y-4">
        <Alert className="border-emerald-200 bg-emerald-50/50">
          <Sparkles className="w-4 h-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            سيقوم النظام بتوزيع الحصص تلقائياً على الأسبوع مع مراعاة:
            <ul className="list-disc list-inside mt-2 text-sm space-y-1 text-emerald-700">
              <li>عدم التعارض (أستاذ، قاعة، فوج)</li>
              <li>احترام عدد ساعات المادة الأسبوعية</li>
              <li>عدم تجاوز حد الأستاذ الأسبوعي</li>
              <li>عدم تكرار نفس المادة أكثر من مرتين في اليوم</li>
              <li>إعطاء الأولوية للقاعات المناسبة (مخبر، إعلام آلي)</li>
              <li>تقليل الفراغات بين الحصص</li>
            </ul>
          </AlertDescription>
        </Alert>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
          <span className="text-sm font-bold text-emerald-900">حذف الجدول الحالي قبل التوليد</span>
        </label>

        <Button onClick={handleGenerate} disabled={generating} size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white">
          {generating ? (
            <><Clock className="w-4 h-4 ml-2 animate-spin" /> جاري التوليد...</>
          ) : (
            <><Sparkles className="w-4 h-4 ml-2" /> توليد الجدول تلقائياً</>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <Alert className={result.success ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CheckCircle2 className={`w-4 h-4 ${result.success ? 'text-emerald-600' : 'text-amber-600'}`} />
              <AlertDescription>
                <p className="font-bold text-emerald-900">{result.success ? '✓ تم التوليد بنجاح!' : '⚠ تم التوليد مع بعض الملاحظات'}</p>
                <p className="text-emerald-700">تم إنشاء {result.sessionsCreated} حصة في {result.stats.duration}ms ({result.stats.attempts} محاولة)</p>
              </AlertDescription>
            </Alert>

            {result.unassigned && result.unassigned.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
                <div className="bg-amber-100 p-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                  <h4 className="font-bold text-amber-800">حصص لم تُجدول ({result.unassigned.length})</h4>
                </div>
                <div className="p-3">
                  <div className="space-y-2">
                    {result.unassigned.map((u: any, i: number) => (
                      <div key={i} className="text-sm p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                        <strong>{u.subject.name}</strong> للفوج <strong>{u.group.name}</strong>: {u.reason}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ STATS VIEW ============
function StatsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timetable/stats').then(r => r.json()).then(d => setStats(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
        <Clock className="w-8 h-8 text-emerald-300 animate-spin" />
      </div>
      <p className="font-bold text-emerald-900 text-base">جاري التحميل...</p>
    </div>
  );
  if (!stats) return (
    <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
        <Filter className="w-8 h-8 text-emerald-300" />
      </div>
      <p className="font-bold text-emerald-900 text-base">لا توجد بيانات</p>
      <p className="text-xs text-muted-foreground mt-1">لم يتم العثور على إحصائيات</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <p className="text-sm text-emerald-700">إجمالي الحصص</p>
          <p className="text-2xl font-bold num text-emerald-900">{stats.totalSessions}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <p className="text-sm text-emerald-700">الأساتذة النشطون</p>
          <p className="text-2xl font-bold num text-emerald-900">{stats.teacherStats?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <p className="text-sm text-emerald-700">القاعات المستعملة</p>
          <p className="text-2xl font-bold num text-emerald-900">{stats.roomStats?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <p className="text-sm text-emerald-700">المواد المجدولة</p>
          <p className="text-2xl font-bold num text-emerald-900">{stats.subjectStats?.length || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold">ساعات الأساتذة</h3>
          </div>
          <div className="p-2">
            <Table>
              <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100"><TableHead className="text-emerald-900 font-bold">الأستاذ</TableHead><TableHead className="text-center text-emerald-900 font-bold">حصص</TableHead><TableHead className="text-center text-emerald-900 font-bold">ساعات</TableHead><TableHead className="text-center text-emerald-900 font-bold">استغلال</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.teacherUtilization?.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-emerald-50/30 border-emerald-100">
                    <TableCell className="font-bold text-emerald-900">{t.name}</TableCell>
                    <TableCell className="text-center num text-emerald-700">{t.sessions}</TableCell>
                    <TableCell className="text-center num text-emerald-700">{Math.round(t.hours * 10) / 10}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.utilizationRate > 80 ? 'destructive' : t.utilizationRate > 50 ? 'default' : 'secondary'} className="num">{t.utilizationRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
          <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold">استغلال القاعات</h3>
          </div>
          <div className="p-2">
            <Table>
              <TableHeader><TableRow className="bg-emerald-50 hover:bg-emerald-50 border-emerald-100"><TableHead className="text-emerald-900 font-bold">القاعة</TableHead><TableHead className="text-center text-emerald-900 font-bold">حصص</TableHead><TableHead className="text-center text-emerald-900 font-bold">ساعات</TableHead><TableHead className="text-center text-emerald-900 font-bold">استغلال</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.roomUtilization?.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-emerald-50/30 border-emerald-100">
                    <TableCell className="font-bold text-emerald-900">{r.name}</TableCell>
                    <TableCell className="text-center num text-emerald-700">{r.sessions}</TableCell>
                    <TableCell className="text-center num text-emerald-700">{Math.round(r.hours * 10) / 10}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.utilizationRate > 80 ? 'destructive' : r.utilizationRate > 50 ? 'default' : 'secondary'} className="num">{r.utilizationRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
