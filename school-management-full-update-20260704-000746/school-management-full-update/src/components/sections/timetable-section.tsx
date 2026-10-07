'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  CalendarDays, User, Building2, GraduationCap, BookText,
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
  const [activeTab, setActiveTab] = useState('week');
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:grid-cols-8">
          <TabsTrigger value="week"><CalendarDays className="w-4 h-4 ml-1" /> أسبوعي</TabsTrigger>
          <TabsTrigger value="day"><Calendar className="w-4 h-4 ml-1" /> يومي</TabsTrigger>
          <TabsTrigger value="teacher"><User className="w-4 h-4 ml-1" /> أستاذ</TabsTrigger>
          <TabsTrigger value="room"><Building2 className="w-4 h-4 ml-1" /> قاعة</TabsTrigger>
          <TabsTrigger value="group"><Users className="w-4 h-4 ml-1" /> فوج</TabsTrigger>
          <TabsTrigger value="subject"><BookText className="w-4 h-4 ml-1" /> مادة</TabsTrigger>
          <TabsTrigger value="manage"><LayoutGrid className="w-4 h-4 ml-1" /> إدارة</TabsTrigger>
          <TabsTrigger value="stats"><Filter className="w-4 h-4 ml-1" /> إحصائيات</TabsTrigger>
        </TabsList>

        <TabsContent value="week"><WeekView isDirector={canManage} /></TabsContent>
        <TabsContent value="day"><DayView isDirector={canManage} /></TabsContent>
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
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث (أستاذ، قاعة، مادة، فوج)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            {isDirector && (
              <>
                <Button onClick={() => handleOpenAdd()}>
                  <Plus className="w-4 h-4 ml-2" /> إضافة حصة
                </Button>
                <Button variant="outline" onClick={() => window.open('/api/timetable/export/excel?view=week', '_blank')}>
                  <Download className="w-4 h-4 ml-2" /> Excel
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 ml-2" /> طباعة
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Week grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 800 }}>
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-sm w-24">التوقيت</th>
                {DAYS.map((day, i) => (
                  <th key={i} className="border p-2 text-sm">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySlots.map((time) => {
                const [h, m] = time.split(':').map(Number);
                const endH = h + 2;
                const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return (
                  <tr key={time}>
                    <td className="border p-2 text-xs text-center num font-medium bg-muted/30">
                      {time}<br/>← {endTime}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const daySessions = filteredSessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                      return (
                        <td key={dayIdx} className="border p-1 align-top" style={{ minHeight: 60 }}>
                          <div className="space-y-1">
                            {daySessions.map(s => (
                              <div
                                key={s.id}
                                className="p-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: (s.color || s.subject?.color || '#3b82f6') + '20',
                                  borderRight: `3px solid ${s.color || s.subject?.color || '#3b82f6'}`,
                                }}
                                onClick={() => handleOpenEdit(s)}
                              >
                                <div className="font-bold">{s.subjectName || '-'}</div>
                                <div className="text-muted-foreground">{s.teacherName || '-'}</div>
                                <div className="text-muted-foreground">📍 {s.roomName || '-'}</div>
                                <div className="text-muted-foreground">👥 {s.groupName || '-'}</div>
                              </div>
                            ))}
                            {isDirector && daySessions.length === 0 && (
                              <button
                                className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 rounded p-1 transition-colors"
                                onClick={() => handleOpenAdd(dayIdx, time, endTime)}
                              >
                                + إضافة
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
        </CardContent>
      </Card>

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
  const [selectedDay, setSelectedDay] = useState(0);
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>اليوم:</Label>
          <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(parseInt(v))}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">جدول يوم {DAYS[selectedDay]}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
          ) : sessions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">لا توجد حصص في هذا اليوم</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderRight: `4px solid ${s.color || s.subject?.color || '#3b82f6'}` }}>
                  <div className="text-center min-w-20">
                    <Badge variant="outline" className="num">{s.startTime}</Badge>
                    <br/>
                    <Badge variant="outline" className="num mt-1">{s.endTime}</Badge>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{s.subjectName || '-'}</p>
                    <p className="text-sm text-muted-foreground">👤 {s.teacherName || '-'} | 📍 {s.roomName || '-'} | 👥 {s.groupName || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>الأستاذ:</Label>
          <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأساتذة</SelectItem>
              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDirector && selectedTeacher !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/timetable/export/excel?view=teacher&id=${selectedTeacher}`, '_blank')}>
              <Download className="w-4 h-4 ml-1" /> Excel
            </Button>
          )}
        </CardContent>
      </Card>

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
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>القاعة:</Label>
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل القاعات</SelectItem>
              {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDirector && selectedRoom !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/timetable/export/excel?view=room&id=${selectedRoom}`, '_blank')}>
              <Download className="w-4 h-4 ml-1" /> Excel
            </Button>
          )}
        </CardContent>
      </Card>

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
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>الفوج:</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأفواج</SelectItem>
              {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDirector && selectedGroup !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/timetable/export/excel?view=group&id=${selectedGroup}`, '_blank')}>
              <Download className="w-4 h-4 ml-1" /> Excel
            </Button>
          )}
        </CardContent>
      </Card>

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
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>المادة:</Label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المواد</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isDirector && selectedSubject !== 'all' && (
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/timetable/export/excel?view=subject&id=${selectedSubject}`, '_blank')}>
              <Download className="w-4 h-4 ml-1" /> Excel
            </Button>
          )}
        </CardContent>
      </Card>

      <TimetableGrid sessions={sessions} loading={loading} />
    </div>
  );
}

// ============ TIMETABLE GRID (reusable) ============
function TimetableGrid({ sessions, loading }: { sessions: any[]; loading: boolean }) {
  if (loading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  const timeSlots = Array.from(new Set(sessions.map(s => s.startTime))).sort();

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        {sessions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">لا توجد حصص</p>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-sm w-24">التوقيت</th>
                {DAYS.map((day, i) => <th key={i} className="border p-2 text-sm">{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(time => (
                <tr key={time}>
                  <td className="border p-2 text-xs text-center num font-medium bg-muted/30">{time}</td>
                  {DAYS.map((_, dayIdx) => {
                    const daySessions = sessions.filter(s => s.dayOfWeek === dayIdx && s.startTime === time);
                    return (
                      <td key={dayIdx} className="border p-1 align-top">
                        <div className="space-y-1">
                          {daySessions.map(s => (
                            <div
                              key={s.id}
                              className="p-2 rounded text-xs"
                              style={{
                                backgroundColor: (s.color || s.subject?.color || '#3b82f6') + '20',
                                borderRight: `3px solid ${s.color || s.subject?.color || '#3b82f6'}`,
                              }}
                            >
                              <div className="font-bold">{s.subjectName || '-'}</div>
                              <div className="text-muted-foreground">{s.teacherName || '-'}</div>
                              <div className="text-muted-foreground">📍 {s.roomName || '-'}</div>
                              <div className="text-muted-foreground">👥 {s.groupName || '-'}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MANAGEMENT VIEW ============
function ManagementView({ isDirector }: { isDirector: boolean }) {
  const [tab, setTab] = useState('rooms');
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-7">
          <TabsTrigger value="rooms"><DoorOpen className="w-4 h-4 ml-1" /> قاعات</TabsTrigger>
          <TabsTrigger value="groups"><Users className="w-4 h-4 ml-1" /> أفواج</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 ml-1" /> مواد</TabsTrigger>
          <TabsTrigger value="timeslots"><Clock className="w-4 h-4 ml-1" /> فترات</TabsTrigger>
          <TabsTrigger value="holidays"><PartyPopper className="w-4 h-4 ml-1" /> عطل</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 ml-1" /> دوام</TabsTrigger>
          {isDirector && <TabsTrigger value="generate"><Sparkles className="w-4 h-4 ml-1" /> توليد</TabsTrigger>}
        </TabsList>
        <TabsContent value="rooms"><RoomsManagement isDirector={isDirector} /></TabsContent>
        <TabsContent value="groups"><GroupsManagement isDirector={isDirector} /></TabsContent>
        <TabsContent value="subjects"><SubjectsManagement isDirector={isDirector} /></TabsContent>
        <TabsContent value="timeslots"><TimeSlotsManagement isDirector={isDirector} /></TabsContent>
        <TabsContent value="holidays"><HolidaysManagement isDirector={isDirector} /></TabsContent>
        <TabsContent value="settings"><WorkSettingsManagement /></TabsContent>
        {isDirector && <TabsContent value="generate"><AutoGenerateView /></TabsContent>}
      </Tabs>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">القاعات ({rooms.length})</CardTitle>
        {isDirector && <Button size="sm" onClick={() => { setEditing(null); setFormData({ name: '', code: '', capacity: '30', type: 'classroom', building: '', floor: '', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>الكود</TableHead><TableHead>النوع</TableHead><TableHead>السعة</TableHead>
            <TableHead className="text-center">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rooms.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="num">{r.code || '-'}</TableCell>
                <TableCell><Badge variant="outline">{ROOM_TYPES.find(rt => rt.value === r.type)?.label || r.type}</Badge></TableCell>
                <TableCell className="num">{r.capacity}</TableCell>
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
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل قاعة' : 'إضافة قاعة'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>النوع</Label><Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROOM_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>السعة</Label><Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>المبنى</Label><Input value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} /></div>
            <div className="space-y-2"><Label>الطابق</Label><Input value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">الأفواج ({groups.length})</CardTitle>
        {isDirector && <Button size="sm" onClick={() => { setEditing(null); setFormData({ name: '', code: '', departmentId: '', specializationId: '', level: '', studentCount: '0', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الاسم</TableHead><TableHead>القسم</TableHead><TableHead>التخصص</TableHead><TableHead>العدد</TableHead>
            <TableHead className="text-center">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {groups.map(g => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{g.department?.name || '-'}</TableCell>
                <TableCell>{g.specialization?.name || '-'}</TableCell>
                <TableCell className="num">{g.studentCount}</TableCell>
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
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل فوج' : 'إضافة فوج'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>القسم</Label><Select value={formData.departmentId || 'none'} onValueChange={(v) => setFormData({ ...formData, departmentId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>التخصص</Label><Select value={formData.specializationId || 'none'} onValueChange={(v) => setFormData({ ...formData, specializationId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{specializations.filter(s => !formData.departmentId || s.departmentId === formData.departmentId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>المستوى</Label><Input value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value })} /></div>
            <div className="space-y-2"><Label>عدد الطلاب</Label><Input type="number" value={formData.studentCount} onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })} dir="ltr" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">المواد ({subjects.length})</CardTitle>
        {isDirector && <Button size="sm" onClick={() => { setEditing(null); setFormData({ name: '', code: '', departmentId: '', specializationId: '', weeklyHours: '2', requiredRoomType: '', color: '#3b82f6', teacherId: '', notes: '' }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-1" /> إضافة
        </Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>المادة</TableHead><TableHead>القسم</TableHead><TableHead>ساعات/أسبوع</TableHead><TableHead>الأستاذ</TableHead><TableHead>النوع المطلوب</TableHead>
            <TableHead className="text-center">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subjects.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ backgroundColor: s.color || '#3b82f6' }}></span>
                  {s.name}
                </TableCell>
                <TableCell>{s.department?.name || '-'}</TableCell>
                <TableCell className="num">{s.weeklyHours}</TableCell>
                <TableCell>{s.teacher?.name || '-'}</TableCell>
                <TableCell>{s.requiredRoomType ? <Badge variant="outline">{ROOM_TYPES.find(rt => rt.value === s.requiredRoomType)?.label || s.requiredRoomType}</Badge> : '-'}</TableCell>
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
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'تعديل مادة' : 'إضافة مادة'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>الكود</Label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>القسم</Label><Select value={formData.departmentId || 'none'} onValueChange={(v) => setFormData({ ...formData, departmentId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>التخصص</Label><Select value={formData.specializationId || 'none'} onValueChange={(v) => setFormData({ ...formData, specializationId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{specializations.filter(s => !formData.departmentId || s.departmentId === formData.departmentId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>الساعات الأسبوعية</Label><Input type="number" value={formData.weeklyHours} onChange={(e) => setFormData({ ...formData, weeklyHours: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>نوع القاعة المطلوب</Label><Select value={formData.requiredRoomType || 'none'} onValueChange={(v) => setFormData({ ...formData, requiredRoomType: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="أي قاعة" /></SelectTrigger><SelectContent><SelectItem value="none">أي قاعة</SelectItem>{ROOM_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>الأستاذ</Label><Select value={formData.teacherId || 'none'} onValueChange={(v) => setFormData({ ...formData, teacherId: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger><SelectContent><SelectItem value="none">بدون</SelectItem>{teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>اللون</Label><div className="flex gap-1">{SUBJECT_COLORS.map(c => <button key={c} type="button" className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: c, borderColor: formData.color === c ? '#000' : 'transparent' }} onClick={() => setFormData({ ...formData, color: c })} />)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">الفترات الزمنية ({timeSlots.length})</CardTitle>
        {isDirector && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>اليوم</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead className="text-center">إجراء</TableHead></TableRow></TableHeader>
          <TableBody>
            {timeSlots.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{DAYS[t.dayOfWeek]}</TableCell>
                <TableCell className="num">{t.startTime}</TableCell>
                <TableCell className="num">{t.endTime}</TableCell>
                <TableCell className="text-center">{isDirector && <Button size="sm" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة فترة زمنية</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2"><Label>الاسم</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="الحصة 1" /></div>
            <div className="space-y-2"><Label>اليوم</Label><Select value={formData.dayOfWeek} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>من</Label><Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>إلى</Label><Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} dir="ltr" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">العطل ({holidays.length})</CardTitle>
        {isDirector && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>النوع</TableHead><TableHead className="text-center">إجراء</TableHead></TableRow></TableHeader>
          <TableBody>
            {holidays.map(h => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell className="num">{new Date(h.startDate).toLocaleDateString('ar')}</TableCell>
                <TableCell className="num">{new Date(h.endDate).toLocaleDateString('ar')}</TableCell>
                <TableCell><Badge variant="outline">{h.type === 'holiday' ? 'عطلة' : h.type === 'exam' ? 'امتحان' : 'حدث'}</Badge></TableCell>
                <TableCell className="text-center">{isDirector && <Button size="sm" variant="ghost" onClick={() => handleDelete(h)}><Trash2 className="w-4 h-4 text-red-600" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة عطلة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-2 md:col-span-2"><Label>الاسم</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>من تاريخ</Label><Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>إلى تاريخ</Label><Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>النوع</Label><Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="holiday">عطلة</SelectItem><SelectItem value="exam">امتحان</SelectItem><SelectItem value="event">حدث</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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

  if (loading) return <div className="text-center py-8">جاري التحميل...</div>;

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
    <Card>
      <CardHeader><CardTitle className="text-lg">إعدادات الدوام</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>أيام العمل</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {days.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`px-3 py-1.5 rounded-lg text-sm ${selectedDays.includes(d.value) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-2"><Label>بداية الدوام</Label><Input type="time" value={settings.workStartTime || '08:00'} onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>نهاية الدوام</Label><Input type="time" value={settings.workEndTime || '18:00'} onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>مدة الحصة (دقيقة)</Label><Input type="number" value={settings.sessionDuration || 120} onChange={(e) => setSettings({ ...settings, sessionDuration: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>مدة الاستراحة (دقيقة)</Label><Input type="number" value={settings.breakDuration || 15} onChange={(e) => setSettings({ ...settings, breakDuration: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>حد الأستاذ الأسبوعي (ساعة)</Label><Input type="number" value={settings.maxTeacherHoursPerWeek || 20} onChange={(e) => setSettings({ ...settings, maxTeacherHoursPerWeek: e.target.value })} dir="ltr" /></div>
          <div className="space-y-2"><Label>أقصى عدد حصص/يوم</Label><Input type="number" value={settings.maxSessionsPerDay || 4} onChange={(e) => setSettings({ ...settings, maxSessionsPerDay: e.target.value })} dir="ltr" /></div>
        </div>
        <Button onClick={handleSave}>حفظ الإعدادات</Button>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> التوليد التلقائي للجدول</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Sparkles className="w-4 h-4" />
          <AlertDescription>
            سيقوم النظام بتوزيع الحصص تلقائياً على الأسبوع مع مراعاة:
            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
              <li>عدم التعارض (أستاذ، قاعة، فوج)</li>
              <li>احترام عدد ساعات المادة الأسبوعية</li>
              <li>عدم تجاوز حد الأستاذ الأسبوعي</li>
              <li>عدم تكرار نفس المادة أكثر من مرتين في اليوم</li>
              <li>إعطاء الأولوية للقاعات المناسبة (مخبر، إعلام آلي)</li>
              <li>تقليل الفراغات بين الحصص</li>
            </ul>
          </AlertDescription>
        </Alert>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm">حذف الجدول الحالي قبل التوليد</span>
        </label>

        <Button onClick={handleGenerate} disabled={generating} size="lg">
          {generating ? (
            <><Clock className="w-4 h-4 ml-2 animate-spin" /> جاري التوليد...</>
          ) : (
            <><Sparkles className="w-4 h-4 ml-2" /> توليد الجدول تلقائياً</>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <Alert className={result.success ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                <p className="font-bold">{result.success ? '✓ تم التوليد بنجاح!' : '⚠ تم التوليد مع بعض الملاحظات'}</p>
                <p>تم إنشاء {result.sessionsCreated} حصة في {result.stats.duration}ms ({result.stats.attempts} محاولة)</p>
              </AlertDescription>
            </Alert>

            {result.unassigned && result.unassigned.length > 0 && (
              <Card className="border-amber-200">
                <CardHeader><CardTitle className="text-base text-amber-700">حصص لم تُجدول ({result.unassigned.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.unassigned.map((u: any, i: number) => (
                      <div key={i} className="text-sm p-2 bg-amber-50 rounded">
                        <strong>{u.subject.name}</strong> للفوج <strong>{u.group.name}</strong>: {u.reason}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ STATS VIEW ============
function StatsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timetable/stats').then(r => r.json()).then(d => setStats(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8">جاري التحميل...</div>;
  if (!stats) return <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">إجمالي الحصص</p><p className="text-2xl font-bold num">{stats.totalSessions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">الأساتذة النشطون</p><p className="text-2xl font-bold num">{stats.teacherStats?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">القاعات المستعملة</p><p className="text-2xl font-bold num">{stats.roomStats?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">المواد المجدولة</p><p className="text-2xl font-bold num">{stats.subjectStats?.length || 0}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">ساعات الأساتذة</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>الأستاذ</TableHead><TableHead className="text-center">حصص</TableHead><TableHead className="text-center">ساعات</TableHead><TableHead className="text-center">استغلال</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.teacherUtilization?.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-center num">{t.sessions}</TableCell>
                    <TableCell className="text-center num">{Math.round(t.hours * 10) / 10}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={t.utilizationRate > 80 ? 'destructive' : t.utilizationRate > 50 ? 'default' : 'secondary'} className="num">{t.utilizationRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">استغلال القاعات</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>القاعة</TableHead><TableHead className="text-center">حصص</TableHead><TableHead className="text-center">ساعات</TableHead><TableHead className="text-center">استغلال</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats.roomUtilization?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center num">{r.sessions}</TableCell>
                    <TableCell className="text-center num">{Math.round(r.hours * 10) / 10}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.utilizationRate > 80 ? 'destructive' : r.utilizationRate > 50 ? 'default' : 'secondary'} className="num">{r.utilizationRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
