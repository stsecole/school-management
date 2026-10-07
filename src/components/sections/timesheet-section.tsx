'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Clock, Calendar, TrendingUp, Activity, Heart, X, Plus, Trash2, BarChart3, Users, Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  present: { label: 'حاضر', variant: 'default' },
  absent: { label: 'غائب', variant: 'destructive' },
  sick: { label: 'مرضي', variant: 'secondary' },
  leave: { label: 'عطلة', variant: 'outline' },
  holiday: { label: 'عطلة رسمية', variant: 'secondary' },
};

interface TimesheetEntry {
  id: string;
  date: string;
  dayOfWeek: number;
  checkIn1: string | null;
  checkOut1: string | null;
  checkIn2: string | null;
  checkOut2: string | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  sickHours: number;
  leaveHours: number;
  status: string;
  notes: string | null;
  user?: { id: string; name: string; username: string; role: string };
}

export function TimesheetSection({ isDirector = false }: { isDirector?: boolean }) {
  const [activeTab, setActiveTab] = useState(isDirector ? 'stats' : 'my-timesheet');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> حضور الموظفين
        </h2>
        <p className="text-muted-foreground text-sm">
          {isDirector ? 'إحصائيات حضور جميع الموظفين والحجم الساعي' : 'سجل حضورك اليومي واحصائياتك'}
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'my-timesheet' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setActiveTab('my-timesheet')}
        >
          <Clock className="w-4 h-4 inline ml-1" /> {isDirector ? 'سجلات الحضور' : 'سجلي'}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 className="w-4 h-4 inline ml-1" /> الإحصائيات
        </button>
      </div>

      {activeTab === 'my-timesheet' && <TimesheetRecords isDirector={isDirector} />}
      {activeTab === 'stats' && <StatsView isDirector={isDirector} />}
    </div>
  );
}

// ============ TIMESHEET RECORDS ============
function TimesheetRecords({ isDirector }: { isDirector: boolean }) {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    checkIn1: '08:00', checkOut1: '12:00',
    checkIn2: '13:00', checkOut2: '17:00',
    status: 'present', notes: '',
    sickHours: '', leaveHours: '', overtimeHours: '',
  });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (isDirector && filterUser !== 'all') params.set('userId', filterUser);
    if (filterMonth) {
      const [y, m] = filterMonth.split('-').map(Number);
      params.set('startDate', `${y}-${String(m).padStart(2, '0')}-01`);
      params.set('endDate', `${y}-${String(m).padStart(2, '0')}-31`);
    }
    const res = await fetch(`/api/timesheet?${params.toString()}`);
    const data = await res.json();
    setEntries(data.timesheets || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isDirector) {
      fetch('/api/users/staff-names').then(r => r.json()).then(d => setUsers(d.staff || []));
    }
  }, [isDirector]);

  useEffect(() => { load(); }, [filterUser, filterMonth]);

  // Calculate live hours
  const liveHours = useMemo(() => {
    const parseTime = (t: string) => {
      if (!t || !t.match(/^\d{1,2}:\d{2}$/)) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    let totalMin = 0;
    const ci1 = parseTime(formData.checkIn1);
    const co1 = parseTime(formData.checkOut1);
    const ci2 = parseTime(formData.checkIn2);
    const co2 = parseTime(formData.checkOut2);
    if (ci1 !== null && co1 !== null) {
      let diff = co1 - ci1;
      if (diff < 0) diff += 24 * 60;
      totalMin += diff;
    }
    if (ci2 !== null && co2 !== null) {
      let diff = co2 - ci2;
      if (diff < 0) diff += 24 * 60;
      totalMin += diff;
    }
    return Math.round((totalMin / 60) * 100) / 100;
  }, [formData.checkIn1, formData.checkOut1, formData.checkIn2, formData.checkOut2]);

  const handleSave = async () => {
    const payload = {
      ...formData,
      userId: isDirector ? filterUser !== 'all' ? filterUser : undefined : undefined,
    };
    const res = await fetch('/api/timesheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم حفظ سجل الحضور' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    await fetch(`/api/timesheet/${id}`, { method: 'DELETE' });
    load();
  };

  // Summary
  const totalHours = entries.reduce((s, e) => s + e.totalHours, 0);
  const totalOvertime = entries.reduce((s, e) => s + e.overtimeHours, 0);
  const totalSick = entries.reduce((s, e) => s + e.sickHours, 0);
  const totalLeave = entries.reduce((s, e) => s + e.leaveHours, 0);
  const presentDays = entries.filter(e => e.status === 'present').length;
  const absentDays = entries.filter(e => e.status === 'absent').length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-muted-foreground">إجمالي الساعات</span></div>
          <p className="text-xl font-bold text-primary num">{Math.round(totalHours * 100) / 100}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1 mb-1"><Activity className="w-3.5 h-3.5 text-emerald-600" /><span className="text-xs text-muted-foreground">أيام الحضور</span></div>
          <p className="text-xl font-bold text-emerald-700 num">{presentDays}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1 mb-1"><X className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-muted-foreground">أيام الغياب</span></div>
          <p className="text-xl font-bold text-red-700 num">{absentDays}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1 mb-1"><TrendingUp className="w-3.5 h-3.5 text-amber-600" /><span className="text-xs text-muted-foreground">وقت إضافي</span></div>
          <p className="text-xl font-bold text-amber-700 num">{Math.round(totalOvertime * 100) / 100} س</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1 mb-1"><Heart className="w-3.5 h-3.5 text-pink-600" /><span className="text-xs text-muted-foreground">مرضي/عطلة</span></div>
          <p className="text-xl font-bold text-pink-700 num">{Math.round((totalSick + totalLeave) * 100) / 100} س</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {isDirector && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموظفين</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" className="max-w-xs" />
            <Button onClick={() => { setFormData({ date: new Date().toISOString().split('T')[0], checkIn1: '08:00', checkOut1: '12:00', checkIn2: '13:00', checkOut2: '17:00', status: 'present', notes: '', sickHours: '', leaveHours: '', overtimeHours: '' }); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" /> تسجيل حضور
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records table - CSS Grid for proper RTL alignment */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: isDirector ? '960px' : '820px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: isDirector
                  ? '40px 100px 80px 1fr 130px 130px 70px 70px 100px 60px'
                  : '40px 100px 80px 130px 130px 70px 70px 100px 60px' }}
              >
                <div className="text-center">#</div>
                <div className="text-right">التاريخ</div>
                <div className="text-right">اليوم</div>
                {isDirector && <div className="text-right">الموظف</div>}
                <div className="text-center">الفترة 1</div>
                <div className="text-center">الفترة 2</div>
                <div className="text-center">الساعات</div>
                <div className="text-center">إضافي</div>
                <div className="text-center">الحالة</div>
                <div className="text-center">إجراء</div>
              </div>

              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد سجلات</div>
              ) : entries.map((e, i) => (
                <div
                  key={e.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: isDirector
                    ? '40px 100px 80px 1fr 130px 130px 70px 70px 100px 60px'
                    : '40px 100px 80px 130px 130px 70px 70px 100px 60px' }}
                >
                  <div className="text-center num text-muted-foreground">{i + 1}</div>
                  <div className="text-right num text-sm">{new Date(e.date).toLocaleDateString('ar')}</div>
                  <div className="text-right text-sm">{DAYS[e.dayOfWeek]}</div>
                  {isDirector && <div className="text-right text-sm font-medium">{e.user?.name || '-'}</div>}
                  <div className="text-center num text-xs" dir="ltr">{e.checkIn1 || '-'} ← {e.checkOut1 || '-'}</div>
                  <div className="text-center num text-xs" dir="ltr">{e.checkIn2 || '-'} ← {e.checkOut2 || '-'}</div>
                  <div className="text-center num font-bold">{e.totalHours}</div>
                  <div className="text-center num text-amber-600">{e.overtimeHours > 0 ? e.overtimeHours : '-'}</div>
                  <div className="text-center">
                    <Badge variant={(STATUS_LABELS[e.status]?.variant as any) || 'outline'}>
                      {STATUS_LABELS[e.status]?.label || e.status}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Footer totals */}
              {entries.length > 0 && (
                <div
                  className="grid items-center gap-2 px-3 py-3 border-t-2 bg-muted/30 font-medium text-sm"
                  style={{ gridTemplateColumns: isDirector
                    ? '40px 100px 80px 1fr 130px 130px 70px 70px 100px 60px'
                    : '40px 100px 80px 130px 130px 70px 70px 100px 60px' }}
                >
                  <div className="text-left" style={{ gridColumn: isDirector ? '1 / span 6' : '1 / span 5' }}>
                    الإجمالي ({entries.length} يوم):
                  </div>
                  <div className="text-center num font-bold">{Math.round(totalHours * 100) / 100}</div>
                  <div className="text-center num">{Math.round(totalOvertime * 100) / 100}</div>
                  <div style={{ gridColumn: isDirector ? '9 / span 2' : '8 / span 2' }}></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>تسجيل حضور</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="sick">مرضي</SelectItem>
                  <SelectItem value="leave">عطلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفترة 1 - دخول</Label>
              <Input type="time" value={formData.checkIn1} onChange={(e) => setFormData({ ...formData, checkIn1: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الفترة 1 - خروج</Label>
              <Input type="time" value={formData.checkOut1} onChange={(e) => setFormData({ ...formData, checkOut1: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الفترة 2 - دخول</Label>
              <Input type="time" value={formData.checkIn2} onChange={(e) => setFormData({ ...formData, checkIn2: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الفترة 2 - خروج</Label>
              <Input type="time" value={formData.checkOut2} onChange={(e) => setFormData({ ...formData, checkOut2: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>ساعات مرضية</Label>
              <Input type="number" step="0.5" value={formData.sickHours} onChange={(e) => setFormData({ ...formData, sickHours: e.target.value })} placeholder="0" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>ساعات عطلة</Label>
              <Input type="number" step="0.5" value={formData.leaveHours} onChange={(e) => setFormData({ ...formData, leaveHours: e.target.value })} placeholder="0" dir="ltr" />
            </div>
            <div className="md:col-span-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm">
                <strong>الساعات المحسوبة:</strong> <span className="num font-bold text-primary">{liveHours} ساعة</span>
                {liveHours > 8 && <span className="text-amber-600 mr-2">(يتضمن {Math.round((liveHours - 8) * 100) / 100} ساعة إضافية)</span>}
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ STATS VIEW ============
function StatsView({ isDirector }: { isDirector: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterMonth) {
      const [y, m] = filterMonth.split('-').map(Number);
      params.set('startDate', `${y}-${String(m).padStart(2, '0')}-01`);
      params.set('endDate', `${y}-${String(m).padStart(2, '0')}-31`);
    }
    fetch(`/api/timesheet/stats?${params.toString()}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [filterMonth]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;
  if (!data) return <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>;

  // Director view: staff stats
  if (data.isDirector && data.staffStats) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Label>الشهر:</Label>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" className="max-w-xs" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> إحصائيات الموظفين</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div style={{ minWidth: '880px' }}>
                {/* Header */}
                <div
                  className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                  style={{ gridTemplateColumns: '1fr 80px 70px 70px 70px 70px 110px 100px 90px' }}
                >
                  <div className="text-right">الموظف</div>
                  <div className="text-center">أيام العمل</div>
                  <div className="text-center">حضور</div>
                  <div className="text-center">غياب</div>
                  <div className="text-center">مرضي</div>
                  <div className="text-center">عطلة</div>
                  <div className="text-center">إجمالي الساعات</div>
                  <div className="text-center">وقت إضافي</div>
                  <div className="text-center">متوسط/يوم</div>
                </div>

                {/* Body */}
                {data.staffStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                ) : data.staffStats.map((s: any) => {
                  const avgPerDay = s.totalDays > 0 ? Math.round((s.totalHours / s.totalDays) * 100) / 100 : 0;
                  return (
                    <div
                      key={s.userId}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '1fr 80px 70px 70px 70px 70px 110px 100px 90px' }}
                    >
                      <div className="text-right font-medium flex items-center gap-2 justify-end">
                        {s.name}
                        <Badge variant={s.role === 'director' ? 'default' : 'secondary'} className="text-xs">
                          {s.role === 'director' ? 'مدير' : 'موظف'}
                        </Badge>
                      </div>
                      <div className="text-center num">{s.totalDays}</div>
                      <div className="text-center num text-emerald-600">{s.presentDays}</div>
                      <div className="text-center num text-red-600">{s.absentDays}</div>
                      <div className="text-center num text-pink-600">{s.sickDays}</div>
                      <div className="text-center num text-blue-600">{s.leaveDays}</div>
                      <div className="text-center num font-bold text-primary">{s.totalHours}</div>
                      <div className="text-center num text-amber-600">{s.overtimeHours > 0 ? s.overtimeHours : '-'}</div>
                      <div className="text-center num">{avgPerDay}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">الحجم الساعي للموظفين</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.staffStats.map((s: any) => {
                  const maxHours = Math.max(...data.staffStats.map((x: any) => x.totalHours), 1);
                  return (
                    <div key={s.userId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="num text-muted-foreground">{s.totalHours} ساعة</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(s.totalHours / maxHours) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {data.staffStats.length === 0 && <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">الوقت الإضافي</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.staffStats.filter((s: any) => s.overtimeHours > 0).map((s: any) => {
                  const maxOT = Math.max(...data.staffStats.filter((x: any) => x.overtimeHours > 0).map((x: any) => x.overtimeHours), 1);
                  return (
                    <div key={s.userId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="num text-amber-600">{s.overtimeHours} ساعة</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(s.overtimeHours / maxOT) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {data.staffStats.filter((s: any) => s.overtimeHours > 0).length === 0 && <p className="text-center text-muted-foreground py-4">لا يوجد وقت إضافي</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Employee view: own stats
  const stats = data.stats;
  if (!stats) return <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Label>الشهر:</Label>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" className="max-w-xs" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1"><Clock className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">الحجم الساعي</span></div>
            <p className="text-2xl font-bold text-primary num">{stats.totalHours}</p>
            <p className="text-xs text-muted-foreground">ساعة</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1"><Activity className="w-4 h-4 text-emerald-600" /><span className="text-xs text-muted-foreground">أيام الحضور</span></div>
            <p className="text-2xl font-bold text-emerald-700 num">{stats.presentDays}</p>
            <p className="text-xs text-muted-foreground">يوم</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1"><X className="w-4 h-4 text-red-600" /><span className="text-xs text-muted-foreground">أيام الغياب</span></div>
            <p className="text-2xl font-bold text-red-700 num">{stats.absentDays}</p>
            <p className="text-xs text-muted-foreground">يوم</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1 mb-1"><TrendingUp className="w-4 h-4 text-amber-600" /><span className="text-xs text-muted-foreground">وقت إضافي</span></div>
            <p className="text-2xl font-bold text-amber-700 num">{stats.overtimeHours}</p>
            <p className="text-xs text-muted-foreground">ساعة</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">تفاصيل إضافية</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span>الساعات العادية:</span>
                <span className="num font-bold">{stats.regularHours} ساعة</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span>ساعات مرضية:</span>
                <span className="num font-bold text-pink-600">{stats.sickHours} ساعة</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span>ساعات عطلة:</span>
                <span className="num font-bold text-blue-600">{stats.leaveHours} ساعة</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span>أيام مرضية:</span>
                <span className="num font-bold text-pink-600">{stats.sickDays} يوم</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/30 rounded">
                <span>أيام عطلة:</span>
                <span className="num font-bold text-blue-600">{stats.leaveDays} يوم</span>
              </div>
              <div className="flex justify-between p-2 bg-primary/10 rounded border border-primary/20">
                <span className="font-medium">متوسط الساعات/يوم:</span>
                <span className="num font-bold text-primary">{stats.avgHoursPerDay} ساعة</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">توزيع الأيام</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'حضور', count: stats.presentDays, color: 'bg-emerald-500', total: stats.totalDays },
                { label: 'غياب', count: stats.absentDays, color: 'bg-red-500', total: stats.totalDays },
                { label: 'مرضي', count: stats.sickDays, color: 'bg-pink-500', total: stats.totalDays },
                { label: 'عطلة', count: stats.leaveDays, color: 'bg-blue-500', total: stats.totalDays },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="num">{item.count} / {item.total} يوم</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
