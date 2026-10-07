'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Download, Clock, Timer, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Attendance {
  id: string;
  date: string;
  courseName: string;
  level: string | null;
  startTime: string | null;
  endTime: string | null;
  timeSlot: string | null;
  teacherName: string | null;
  totalCount: number;
  maleCount: number;
  femaleCount: number;
  durationMinutes: number;
  unpaidCount: number;
  notes: string | null;
}

interface Teacher { id: string; name: string; }
interface Course { id: string; name: string; }
interface Level { id: string; name: string; }

const empty = {
  date: new Date().toISOString().split('T')[0],
  courseId: '', courseName: '', level: '',
  startTime: '08:00', endTime: '10:00',
  teacherId: '', teacherName: '',
  totalCount: '0', maleCount: '0', femaleCount: '0',
  unpaidCount: '0', notes: '',
};

/** Parse "HH:MM" → minutes since midnight. Returns null if invalid. */
function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Compute duration in minutes between start and end. Handles overnight. */
function computeDurationMinutes(start: string, end: string): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Format minutes as "Xh Ym" or "Ym" or "Xh". */
function formatDuration(mins: number): string {
  if (mins <= 0) return '0د';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
}

/** Convert minutes to decimal hours (e.g. 90 → 1.5). */
function toHours(mins: number): number {
  return Math.round((mins / 60) * 100) / 100;
}

export function AttendanceSection() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState<any>(empty);
  const { toast } = useToast();

  // Compute duration live as the user types start/end times
  const liveDuration = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return 0;
    return computeDurationMinutes(formData.startTime, formData.endTime);
  }, [formData.startTime, formData.endTime]);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterTeacher !== 'all') params.set('teacherId', filterTeacher);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await fetch(`/api/attendance?${params.toString()}`);
    const data = await res.json();
    setAttendances(data.attendances || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
    fetch('/api/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
    fetch('/api/levels').then(r => r.json()).then(d => setLevels(d.levels || []));
  }, []);
  useEffect(() => { load(); }, [search, filterTeacher, startDate, endDate]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ ...empty, date: new Date().toISOString().split('T')[0] });
    setDialogOpen(true);
  };

  const handleOpenEdit = (a: Attendance) => {
    setEditing(a);
    setFormData({
      date: a.date.split('T')[0],
      courseId: '', courseName: a.courseName, level: a.level || '',
      startTime: a.startTime || '08:00',
      endTime: a.endTime || '10:00',
      teacherId: '', teacherName: a.teacherName || '',
      totalCount: String(a.totalCount), maleCount: String(a.maleCount),
      femaleCount: String(a.femaleCount),
      unpaidCount: String(a.unpaidCount), notes: a.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validate required time fields
    if (!formData.startTime || !formData.endTime) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال وقت البداية ووقت النهاية (إجباري)', variant: 'destructive' });
      return;
    }
    if (parseTimeToMinutes(formData.startTime) === null) {
      toast({ title: 'خطأ', description: 'صيغة وقت البداية غير صحيحة. استخدم HH:MM', variant: 'destructive' });
      return;
    }
    if (parseTimeToMinutes(formData.endTime) === null) {
      toast({ title: 'خطأ', description: 'صيغة وقت النهاية غير صحيحة. استخدم HH:MM', variant: 'destructive' });
      return;
    }
    if (liveDuration <= 0) {
      toast({ title: 'خطأ', description: 'وقت النهاية يجب أن يكون بعد وقت البداية', variant: 'destructive' });
      return;
    }

    const url = editing ? `/api/attendance/${editing.id}` : '/api/attendance';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (a: Attendance) => {
    if (!confirm('حذف سجل الحضور؟')) return;
    const res = await fetch(`/api/attendance/${a.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  // Aggregate stats
  const totalStudents = attendances.reduce((s, a) => s + a.totalCount, 0);
  const totalMale = attendances.reduce((s, a) => s + a.maleCount, 0);
  const totalFemale = attendances.reduce((s, a) => s + a.femaleCount, 0);
  const totalDurationMinutes = attendances.reduce((s, a) => s + (a.durationMinutes || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">قوائم الحضور</h2>
          <p className="text-muted-foreground text-sm">
            {attendances.length} سجل • {totalStudents} حضور ({totalMale} ذكر، {totalFemale} أنثى) • إجمالي المدة: <span className="num font-medium text-primary">{formatDuration(totalDurationMinutes)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/attendance', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> تسجيل حضور</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger><SelectValue placeholder="كل الأساتذة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأساتذة</SelectItem>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" placeholder="من تاريخ" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" placeholder="إلى تاريخ" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> التوقيت
                    </div>
                  </TableHead>
                  <TableHead>الأستاذ</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Timer className="w-3.5 h-3.5" /> المدة
                    </div>
                  </TableHead>
                  <TableHead className="text-center">حضور</TableHead>
                  <TableHead className="text-center">ذكر</TableHead>
                  <TableHead className="text-center">أنثى</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : attendances.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
                ) : attendances.map((a, i) => (
                  <TableRow key={a.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenEdit(a)}>
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="num text-sm">{new Date(a.date).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{a.courseName}</TableCell>
                    <TableCell>{a.level || '-'}</TableCell>
                    <TableCell>
                      {a.startTime && a.endTime ? (
                        <Badge variant="outline" className="num font-mono">
                          <Clock className="w-3 h-3 ml-1" />
                          {a.startTime} ← {a.endTime}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.teacherName || '-'}</TableCell>
                    <TableCell className="text-center">
                      {a.durationMinutes > 0 ? (
                        <Badge variant="secondary" className="num">
                          {formatDuration(a.durationMinutes)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center num font-bold">{a.totalCount}</TableCell>
                    <TableCell className="text-center num">{a.maleCount}</TableCell>
                    <TableCell className="text-center num">{a.femaleCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {/* Footer with totals */}
              {attendances.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 font-medium">
                    <td colSpan={6} className="px-4 py-3 text-left">الإجمالي ({attendances.length} سجل):</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="num">{formatDuration(totalDurationMinutes)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center num">{totalStudents}</td>
                    <td className="px-4 py-3 text-center num">{totalMale}</td>
                    <td className="px-4 py-3 text-center num">{totalFemale}</td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل سجل الحضور' : 'تسجيل حضور جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Time fields - required, with live duration calculation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> وقت البداية <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> وقت النهاية <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                dir="ltr"
                required
              />
            </div>

            {/* Live duration display */}
            <div className="md:col-span-2">
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                liveDuration > 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Timer className={`w-5 h-5 ${liveDuration > 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      المدة المحسوبة:
                    </p>
                    <p className={`text-lg font-bold num ${liveDuration > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {liveDuration > 0 ? formatDuration(liveDuration) : '—'}
                    </p>
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                  <p>بالساعات العشرية: <span className="num font-medium">{toHours(liveDuration)} س</span></p>
                  <p>بالدقائق: <span className="num font-medium">{liveDuration} د</span></p>
                </div>
              </div>
              {liveDuration === 0 && formData.startTime && formData.endTime && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> تأكد من أن وقت النهاية بعد وقت البداية
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>المادة</Label>
              <Select value={formData.courseId} onValueChange={(v) => {
                const c = courses.find(c => c.id === v);
                setFormData({ ...formData, courseId: v, courseName: c?.name || formData.courseName });
              }}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={formData.courseName} onChange={(e) => setFormData({ ...formData, courseName: e.target.value })} placeholder="أو أدخل اسم المادة يدوياً" className="mt-2" />
            </div>
            <div className="space-y-2">
              <Label>الأستاذ</Label>
              <Select value={formData.teacherId} onValueChange={(v) => {
                const t = teachers.find(t => t.id === v);
                setFormData({ ...formData, teacherId: v, teacherName: t?.name || formData.teacherName });
              }}>
                <SelectTrigger><SelectValue placeholder="اختر الأستاذ" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الحضور الإجمالي</Label>
              <Input type="number" min="0" value={formData.totalCount} onChange={(e) => setFormData({ ...formData, totalCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عدد الذكور</Label>
              <Input type="number" min="0" value={formData.maleCount} onChange={(e) => setFormData({ ...formData, maleCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عدد الإناث</Label>
              <Input type="number" min="0" value={formData.femaleCount} onChange={(e) => setFormData({ ...formData, femaleCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={liveDuration <= 0}>
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
