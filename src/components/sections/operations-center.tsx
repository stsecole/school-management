'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Edit, Trash2, Search, Users, GraduationCap, BookOpen, Layers,
  DoorOpen, BookText, ClipboardList, CalendarCheck, ListTodo, Wallet,
  UserCog, Calendar, Loader2, AlertCircle, CheckCircle2, Zap, FolderTree,
  Building2, Award, Briefcase, Lock, Unlock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isDirector: boolean;
  onNavigate?: (section: string) => void;
}

/**
 * OperationsCenter
 *
 * واجهة موحدة تجمع كل عمليات التطبيق (إضافة/تعديل/حذف) في مكان واحد.
 * كل تبويب يعرض قائمة بالعناصر + نافذة حوار للإضافة/التعديل + زر حذف.
 *
 * المدعوم حالياً:
 *  - الأقسام (Departments)
 *  - المستويات (Levels)
 *  - التخصصات (Specializations)
 *  - الأساتذة (Teachers)
 *  - المواد (Courses)
 *  - القاعات (Rooms)
 *  - المستخدمون (Users) — للمدير فقط
 */
export function OperationsCenter({ isDirector, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState('departments');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">مركز العمليات</h2>
          <p className="text-sm text-muted-foreground">
            جميع عمليات الإضافة والتعديل والحذف في واجهة واحدة
          </p>
        </div>
      </div>

      {/* Quick stats overview */}
      <OperationsStats isDirector={isDirector} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto flex-wrap">
          <TabsTrigger value="departments"><BookOpen className="w-4 h-4 ml-1" /> الأقسام</TabsTrigger>
          <TabsTrigger value="levels"><Layers className="w-4 h-4 ml-1" /> المستويات</TabsTrigger>
          <TabsTrigger value="specializations"><Award className="w-4 h-4 ml-1" /> التخصصات</TabsTrigger>
          <TabsTrigger value="teachers"><GraduationCap className="w-4 h-4 ml-1" /> الأساتذة</TabsTrigger>
          <TabsTrigger value="courses"><BookText className="w-4 h-4 ml-1" /> المواد</TabsTrigger>
          <TabsTrigger value="rooms"><DoorOpen className="w-4 h-4 ml-1" /> القاعات</TabsTrigger>
          {isDirector && (
            <TabsTrigger value="users"><UserCog className="w-4 h-4 ml-1" /> المستخدمون</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="departments"><DepartmentsManager isDirector={isDirector} /></TabsContent>
        <TabsContent value="levels"><LevelsManager /></TabsContent>
        <TabsContent value="specializations"><SpecializationsManager /></TabsContent>
        <TabsContent value="teachers"><TeachersManager /></TabsContent>
        <TabsContent value="courses"><CoursesManager /></TabsContent>
        <TabsContent value="rooms"><RoomsManager /></TabsContent>
        {isDirector && <TabsContent value="users"><UsersManager /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ============ Stats overview ============
function OperationsStats({ isDirector }: { isDirector: boolean }) {
  const [stats, setStats] = useState({
    departments: 0, levels: 0, specializations: 0,
    teachers: 0, courses: 0, rooms: 0, users: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/departments').then(r => r.json()).catch(() => ({ departments: [] })),
      fetch('/api/levels').then(r => r.json()).catch(() => ({ levels: [] })),
      fetch('/api/specializations').then(r => r.json()).catch(() => ({ specializations: [] })),
      fetch('/api/teachers').then(r => r.json()).catch(() => ({ teachers: [] })),
      fetch('/api/courses').then(r => r.json()).catch(() => ({ courses: [] })),
      fetch('/api/timetable/rooms').then(r => r.json()).catch(() => ({ rooms: [] })),
      ...(isDirector ? [fetch('/api/users').then(r => r.json()).catch(() => ({ users: [] }))] : []),
    ]).then(([d, l, s, t, c, r, u]) => {
      setStats({
        departments: d.departments?.length || 0,
        levels: l.levels?.length || 0,
        specializations: s.specializations?.length || 0,
        teachers: t.teachers?.length || 0,
        courses: c.courses?.length || 0,
        rooms: r.rooms?.length || 0,
        users: u?.users?.length || 0,
      });
    });
  }, [isDirector]);

  const cards = [
    { label: 'الأقسام', value: stats.departments, icon: BookOpen, color: 'text-blue-600 bg-blue-100' },
    { label: 'المستويات', value: stats.levels, icon: Layers, color: 'text-purple-600 bg-purple-100' },
    { label: 'التخصصات', value: stats.specializations, icon: Award, color: 'text-pink-600 bg-pink-100' },
    { label: 'الأساتذة', value: stats.teachers, icon: GraduationCap, color: 'text-emerald-600 bg-emerald-100' },
    { label: 'المواد', value: stats.courses, icon: BookText, color: 'text-amber-600 bg-amber-100' },
    { label: 'القاعات', value: stats.rooms, icon: DoorOpen, color: 'text-cyan-600 bg-cyan-100' },
    ...(isDirector ? [{ label: 'المستخدمون', value: stats.users, icon: UserCog, color: 'text-red-600 bg-red-100' }] : []),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i}>
            <CardContent className="p-3">
              <div className={`w-8 h-8 rounded-lg ${c.color} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold num">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ Generic delete confirmation hook ============
function useDeleteConfirmation() {
  const { toast } = useToast();
  return async (endpoint: string, label: string, onDone: () => void) => {
    if (!confirm(`حذف "${label}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        let msg = `فشل الحذف (status ${res.status})`;
        try { const data = await res.json(); if (data.error) msg = data.error; } catch {}
        toast({ title: 'خطأ', description: msg, variant: 'destructive' });
        return;
      }
      toast({ title: 'تم', description: 'تم الحذف بنجاح' });
      onDone();
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم: ' + (e.message || ''), variant: 'destructive' });
    }
  };
}

/**
 * Helper: send JSON to an API endpoint with robust error handling.
 * Returns { ok, data } so callers can branch cleanly.
 */
async function apiFetch(url: string, method: 'POST' | 'PUT', body: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      try { return { ok: true, data: await res.json() }; } catch { return { ok: true }; }
    }
    let errorMsg = `فشل (status ${res.status})`;
    try { const d = await res.json(); if (d.error) errorMsg = d.error; } catch {}
    return { ok: false, error: errorMsg };
  } catch (e: any) {
    return { ok: false, error: 'تعذر الاتصال بالخادم: ' + (e.message || '') };
  }
}

// ============ Departments Manager ============
function DepartmentsManager({ isDirector }: { isDirector: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', hasInstallments: false, installmentMonths: 30 });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => {
    setLoading(true);
    fetch('/api/departments').then(r => r.json()).then(d => {
      setItems(d.departments || []);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(d => !search || d.name.includes(search));

  const openAdd = () => { setEditing(null); setForm({ name: '', code: '', hasInstallments: false, installmentMonths: 30 }); setDialogOpen(true); };
  const openEdit = (d: any) => { setEditing(d); setForm({ name: d.name, code: d.code || '', hasInstallments: d.hasInstallments, installmentMonths: d.installmentMonths || 30 }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
    const url = editing ? `/api/departments/${editing.id}` : '/api/departments';
    const method = editing ? 'PUT' : 'POST';
    const result = await apiFetch(url, method, form);
    if (result.ok) {
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: result.error || 'فشل الحفظ', variant: 'destructive' });
    }
  };

  // Toggle the isFixed flag on a department (director-only feature to "unfix" fixed departments)
  const toggleFixed = async (d: any) => {
    const action = d.isFixed ? 'تحرير' : 'تثبيت';
    if (!confirm(`${action} القسم "${d.name}"؟`)) return;
    try {
      const res = await fetch(`/api/departments/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFixed: !d.isFixed }),
      });
      if (res.ok) {
        toast({ title: 'تم', description: d.isFixed ? 'تم تحرير القسم — يمكن الآن حذفه' : 'تم تثبيت القسم' });
        load();
      } else {
        const data = await res.json();
        toast({ title: 'خطأ', description: data.error || `فشل ${action} القسم`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-5 h-5" /> إدارة الأقسام</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 w-40" />
            </div>
            <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Help banner explaining fixed departments */}
        {items.some(d => d.isFixed) && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              الأقسام ذات شارة «🔒 ثابت» محمية من الحذف. لتحرير قسم، اضغط على أيقونة
              <Unlock className="w-3 h-3 inline mx-1" /> بجانبه، ثم سيصبح قابلاً للحذف.
            </span>
          </div>
        )}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">لا توجد أقسام</p>
        ) : (
          <div className="divide-y">
            {filtered.map((d, i) => (
              <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {d.name}
                      {d.isFixed && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800" title="قسم ثابت — اضغط على أيقونة القفل لتحريره">
                          🔒 ثابت
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.code && <span className="num">[{d.code}]</span>}
                      {d.hasInstallments && <Badge variant="secondary" className="ml-2 text-xs">{d.installmentMonths} شهر</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* Edit button — disabled for fixed departments (only monthly amount can be edited via API) */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(d)}
                    title={d.isFixed ? 'تعديل (محدود للقسم الثابت)' : 'تعديل'}
                  >
                    <Edit className="w-4 h-4 text-amber-600" />
                  </Button>
                  {/* Toggle fixed/lock button — director can "unfix" a department to allow deletion */}
                  {isDirector && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleFixed(d)}
                      title={d.isFixed ? 'تحرير القسم (لإتاحة الحذف)' : 'تثبيت القسم (منع الحذف)'}
                    >
                      {d.isFixed
                        ? <Unlock className="w-4 h-4 text-emerald-600" />
                        : <Lock className="w-4 h-4 text-amber-600" />}
                    </Button>
                  )}
                  {/* Delete button — disabled for fixed departments with explanatory tooltip */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={d.isFixed}
                    onClick={() => doDelete(`/api/departments/${d.id}`, d.name, load)}
                    title={d.isFixed ? 'لا يمكن حذف قسم ثابت — حرّره أولاً بالضغط على أيقونة القفل' : 'حذف'}
                    className={d.isFixed ? 'opacity-40 cursor-not-allowed' : ''}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل قسم' : 'إضافة قسم'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم القسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الرمز (اختياري)</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: TS, LANG, WOM" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="hasInst" checked={form.hasInstallments} onChange={(e) => setForm({ ...form, hasInstallments: e.target.checked })} />
              <Label htmlFor="hasInst">يحتوي على أقساط شهرية</Label>
            </div>
            {form.hasInstallments && (
              <div className="space-y-2">
                <Label>عدد الأشهر</Label>
                <Input type="number" value={form.installmentMonths} onChange={(e) => setForm({ ...form, installmentMonths: parseInt(e.target.value) || 30 })} dir="ltr" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Levels Manager ============
function LevelsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', order: 0 });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => { setLoading(true); fetch('/api/levels').then(r => r.json()).then(d => { setItems(d.levels || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', order: 0 }); setDialogOpen(true); };
  const openEdit = (l: any) => { setEditing(l); setForm({ name: l.name, order: l.order || 0 }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
    const url = editing ? `/api/levels?id=${editing.id}` : '/api/levels';
    const method = editing ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, order: Number(form.order) || 0 }),
      });
      if (res.ok) {
        toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
        setDialogOpen(false);
        load();
      } else {
        let errorMsg = 'فشل الحفظ (status ' + res.status + ')';
        try { const d = await res.json(); if (d.error) errorMsg = d.error; } catch {}
        toast({ title: 'خطأ', description: errorMsg, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم: ' + (e.message || ''), variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="w-5 h-5" /> إدارة المستويات</CardTitle>
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          items.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا توجد مستويات</p> :
          <div className="divide-y">
            {items.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium">{l.name}</div>
                    {l.order && <div className="text-xs text-muted-foreground num">ترتيب: {l.order}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(l)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/levels?id=${l.id}`, l.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل مستوى' : 'إضافة مستوى'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم المستوى *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: السنة الأولى، السنة الثانية" />
            </div>
            <div className="space-y-2">
              <Label>الترتيب</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} dir="ltr" />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Specializations Manager ============
function SpecializationsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', departmentId: '' });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => {
    setLoading(true);
    fetch('/api/specializations').then(r => r.json()).then(d => { setItems(d.specializations || []); setLoading(false); });
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', departmentId: '' }); setDialogOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ name: s.name, departmentId: s.departmentId || '' }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name || !form.departmentId) { toast({ title: 'خطأ', description: 'الاسم والقسم مطلوبان', variant: 'destructive' }); return; }
    const url = editing ? `/api/specializations/${editing.id}` : '/api/specializations';
    const method = editing ? 'PUT' : 'POST';
    const result = await apiFetch(url, method, form);
    if (result.ok) { toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' }); setDialogOpen(false); load(); }
    else { toast({ title: 'خطأ', description: result.error || 'فشل', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Award className="w-5 h-5" /> إدارة التخصصات</CardTitle>
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          items.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا توجد تخصصات</p> :
          <div className="divide-y">
            {items.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.department?.name || '-'}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/specializations/${s.id}`, s.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل تخصص' : 'إضافة تخصص'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم التخصص *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>القسم *</Label>
              <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Teachers Manager ============
function TeachersManager() {
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', departmentId: '', salary: 0 });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => {
    setLoading(true);
    fetch('/api/teachers').then(r => r.json()).then(d => { setItems(d.teachers || []); setLoading(false); });
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(t => !search || t.name.includes(search) || (t.phone || '').includes(search));

  const openAdd = () => { setEditing(null); setForm({ name: '', email: '', phone: '', departmentId: '', salary: 0 }); setDialogOpen(true); };
  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name, email: t.email || '', phone: t.phone || '', departmentId: t.departmentId || '', salary: t.salary || 0 }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
    const url = editing ? `/api/teachers/${editing.id}` : '/api/teachers';
    const method = editing ? 'PUT' : 'POST';
    const result = await apiFetch(url, method, { ...form, salary: Number(form.salary) || 0 });
    if (result.ok) { toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' }); setDialogOpen(false); load(); }
    else { toast({ title: 'خطأ', description: result.error || 'فشل', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-5 h-5" /> إدارة الأساتذة</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 w-40" />
            </div>
            <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          filtered.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا يوجد أساتذة</p> :
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {filtered.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground num">
                      {t.phone && <span>{t.phone}</span>}
                      {t.department?.name && <span className="mr-2">• {t.department.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/teachers/${t.id}`, t.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل أستاذ' : 'إضافة أستاذ'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label>الاسم *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select value={form.departmentId || 'none'} onValueChange={(v) => setForm({ ...form, departmentId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الراتب</Label>
              <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: parseFloat(e.target.value) || 0 })} dir="ltr" />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Courses Manager ============
function CoursesManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => { setLoading(true); fetch('/api/courses').then(r => r.json()).then(d => { setItems(d.courses || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
    const result = await apiFetch('/api/courses', 'POST', form);
    if (result.ok) { toast({ title: 'تم', description: 'تمت الإضافة' }); setDialogOpen(false); load(); setForm({ name: '' }); }
    else { toast({ title: 'خطأ', description: result.error || 'فشل', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><BookText className="w-5 h-5" /> إدارة المواد</CardTitle>
          <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          items.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا توجد مواد</p> :
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {items.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div className="font-medium">{c.name}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/courses?id=${c.id}`, c.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة مادة</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم المادة *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: رياضيات، فيزياء" />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>إضافة</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Rooms Manager ============
function RoomsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: 'classroom', capacity: 30 });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const ROOM_TYPES = [
    { value: 'classroom', label: 'قاعة عادية' },
    { value: 'lab', label: 'مخبر' },
    { value: 'computer_lab', label: 'مخبر إعلام آلي' },
    { value: 'amphitheater', label: 'مدرج' },
  ];

  const load = () => { setLoading(true); fetch('/api/timetable/rooms').then(r => r.json()).then(d => { setItems(d.rooms || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', type: 'classroom', capacity: 30 }); setDialogOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name, type: r.type, capacity: r.capacity }); setDialogOpen(true); };

  const save = async () => {
    if (!form.name) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
    const url = editing ? `/api/timetable/rooms/${editing.id}` : '/api/timetable/rooms';
    const method = editing ? 'PUT' : 'POST';
    const result = await apiFetch(url, method, { ...form, capacity: Number(form.capacity) || 30 });
    if (result.ok) { toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' }); setDialogOpen(false); load(); }
    else { toast({ title: 'خطأ', description: result.error || 'فشل', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><DoorOpen className="w-5 h-5" /> إدارة القاعات</CardTitle>
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          items.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا توجد قاعات</p> :
          <div className="divide-y">
            {items.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground num">
                      {ROOM_TYPES.find(t => t.value === r.type)?.label || r.type} • {r.capacity} مقعد
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/timetable/rooms/${r.id}`, r.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل قاعة' : 'إضافة قاعة'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم القاعة *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: قاعة 01" />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>السعة</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 30 })} dir="ltr" />
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Users Manager ============
function UsersManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'employee' });
  const { toast } = useToast();
  const doDelete = useDeleteConfirmation();

  const load = () => { setLoading(true); fetch('/api/users').then(r => r.json()).then(d => { setItems(d.users || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ username: '', name: '', password: '', role: 'employee' }); setDialogOpen(true); };
  const openEdit = (u: any) => { setEditing(u); setForm({ username: u.username, name: u.name, password: '', role: u.role }); setDialogOpen(true); };

  const save = async () => {
    if (!form.username || !form.name) { toast({ title: 'خطأ', description: 'اسم المستخدم والاسم مطلوبان', variant: 'destructive' }); return; }
    if (!editing && !form.password) { toast({ title: 'خطأ', description: 'كلمة المرور مطلوبة', variant: 'destructive' }); return; }
    const body: any = { username: form.username, name: form.name, role: form.role };
    if (form.password) body.password = form.password;
    const url = editing ? `/api/users/${editing.id}` : '/api/users';
    const method = editing ? 'PUT' : 'POST';
    const result = await apiFetch(url, method, body);
    if (result.ok) { toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' }); setDialogOpen(false); load(); }
    else { toast({ title: 'خطأ', description: result.error || 'فشل', variant: 'destructive' }); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><UserCog className="w-5 h-5" /> إدارة المستخدمين</CardTitle>
          <Button onClick={openAdd}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> :
          items.length === 0 ? <p className="text-center py-8 text-muted-foreground">لا يوجد مستخدمون</p> :
          <div className="divide-y">
            {items.map((u, i) => (
              <div key={u.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="num">{i + 1}</Badge>
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground num">@{u.username}</div>
                  </div>
                  <Badge variant={u.role === 'director' ? 'default' : 'secondary'}>
                    {u.role === 'director' ? 'مدير' : 'موظف'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doDelete(`/api/users/${u.id}`, u.name, load)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل مستخدم' : 'إضافة مستخدم'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>اسم المستخدم *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{editing ? 'كلمة المرور (اتركها فارغة للإبقاء)' : 'كلمة المرور *'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="director">مدير</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button><Button onClick={save}>{editing ? 'حفظ' : 'إضافة'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
