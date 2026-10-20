'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Edit, Trash2, Download, CheckCircle2, Clock, AlertCircle,
  Calendar, ListTodo, Sparkles, User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  priority: string;
  priorityLabel: string | null;
  responsible: string | null;
  startDate: string | null;
  deadline: string | null;
  completed: boolean;
  status: string;
  statusValue: number;
  notes: string | null;
}

const empty = {
  title: '', priorityLabel: 'متوسط', responsible: '',
  startDate: '', deadline: '', completed: false, status: 'pending', statusValue: 0,
  notes: '',
};

export function TasksSection() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<{id: string; name: string; role: string; label: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterResponsible, setFilterResponsible] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [formData, setFormData] = useState<any>(empty);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterPriority !== 'all') params.set('priority', filterPriority);
    if (filterResponsible !== 'all') params.set('search', filterResponsible);
    const res = await fetch(`/api/tasks?${params.toString()}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/users/staff-names').then(r => r.json()).then(d => setStaff(d.staff || []));
  }, []);

  useEffect(() => { load(); }, [search, filterStatus, filterPriority, filterResponsible]);

  const handleOpenAdd = () => { setEditing(null); setFormData(empty); setDialogOpen(true); };

  const handleOpenEdit = (t: Task) => {
    setEditing(t);
    setFormData({
      title: t.title,
      priorityLabel: t.priorityLabel || 'متوسط',
      responsible: t.responsible || '',
      startDate: t.startDate ? t.startDate.split('T')[0] : '',
      deadline: t.deadline ? t.deadline.split('T')[0] : '',
      completed: t.completed,
      status: t.status,
      statusValue: String(t.statusValue),
      notes: t.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'تنبيه', description: 'عنوان المهمة مطلوب', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/tasks/${editing.id}` : '/api/tasks';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (res.ok) {
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleToggleComplete = async (t: Task) => {
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...t,
        completed: !t.completed,
        status: !t.completed ? 'done' : 'pending',
        statusValue: String(!t.completed ? 1 : 0),
        startDate: t.startDate ? t.startDate.split('T')[0] : '',
        deadline: t.deadline ? t.deadline.split('T')[0] : '',
      }),
    });
    if (res.ok) load();
  };

  const handleDelete = async (t: Task) => {
    if (!confirm('حذف المهمة؟')) return;
    const res = await fetch(`/api/tasks/${t.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  const isOverdue = (t: Task) => {
    if (t.completed || !t.deadline) return false;
    return new Date(t.deadline) < new Date();
  };

  const pending = tasks.filter(t => !t.completed).length;
  const overdue = tasks.filter(isOverdue).length;
  const completed = tasks.filter(t => t.completed).length;

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    const date = new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  return (
    <div className="space-y-4">
      {/* Header - أخضر جذاب */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
            <ListTodo className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">متابعة المهام</h2>
            <p className="text-sm text-emerald-100">
              <span className="num font-medium">{tasks.length}</span> مهمة •
              <span className="num font-medium text-amber-200 mx-1">{pending}</span> معلقة •
              <span className="num font-medium text-red-200 mx-1">{overdue}</span> متأخرة •
              <span className="num font-medium text-emerald-200 mx-1">{completed}</span> مكتملة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/api/export/tasks', '_blank')}
            className="bg-emerald-900/40 border-emerald-700 text-white hover:bg-emerald-900/60"
          >
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-amber-400 hover:bg-amber-500 text-emerald-900 font-bold"
          >
            <Plus className="w-4 h-4 ml-2" /> مهمة جديدة
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">الإجمالي</span>
            <ListTodo className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-900">{tasks.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-amber-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-amber-700">معلقة</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold num text-amber-700">{pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-red-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-700">متأخرة</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold num text-red-700">{overdue}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">مكتملة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-700">{completed}</p>
        </div>
      </div>

      {/* Filters - elegant */}
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <Input
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">المعلقة</SelectItem>
              <SelectItem value="completed">المكتملة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأولويات</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterResponsible} onValueChange={setFilterResponsible}>
            <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue placeholder="كل المسؤولين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المسؤولين</SelectItem>
              {staff.map(s => (
                <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tasks table - elegant green theme with proper column widths */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">قائمة المهام</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold num">
            {tasks.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          {/* CSS Grid table - ensures perfect header/body alignment */}
          <div className="min-w-[900px]">
            {/* Header row */}
            <div
              className="grid bg-emerald-50 border-b border-emerald-200 font-bold text-emerald-900 text-sm"
              style={{ gridTemplateColumns: '40px minmax(200px, 2fr) 100px 140px 110px 110px 130px 90px' }}
            >
              <div className="text-center py-2 px-1 border-l border-emerald-200">✓</div>
              <div className="py-2 px-3 border-l border-emerald-200">المهمة</div>
              <div className="py-2 px-2 border-l border-emerald-200">الأولوية</div>
              <div className="py-2 px-2 border-l border-emerald-200">المسؤول</div>
              <div className="py-2 px-2 border-l border-emerald-200 text-center">تاريخ البدء</div>
              <div className="py-2 px-2 border-l border-emerald-200 text-center">الأجل</div>
              <div className="py-2 px-2 border-l border-emerald-200 text-center">الحالة</div>
              <div className="py-2 px-2 text-center">إجراءات</div>
            </div>

            {/* Body rows */}
            {loading ? (
              <div className="text-center py-8 text-emerald-600">
                <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                جاري التحميل...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <ListTodo className="w-8 h-8 text-emerald-300" />
                </div>
                <p className="font-bold text-emerald-900 text-base">لا توجد مهام</p>
                <p className="text-xs text-muted-foreground mt-1">أضف مهمة جديدة للبدء</p>
              </div>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className={`grid border-b border-emerald-50 transition ${
                    isOverdue(t) ? 'bg-red-50/40 hover:bg-red-50/60' :
                    t.completed ? 'bg-emerald-50/30 hover:bg-emerald-50/50' :
                    'hover:bg-emerald-50/30'
                  }`}
                  style={{ gridTemplateColumns: '40px minmax(200px, 2fr) 100px 140px 110px 110px 130px 90px' }}
                >
                  {/* 1) Completion checkbox */}
                  <div className="flex items-center justify-center px-1 border-l border-emerald-50">
                    <Checkbox
                      checked={t.completed}
                      onCheckedChange={() => handleToggleComplete(t)}
                    />
                  </div>

                  {/* 2) Task title */}
                  <div className="py-2 px-3 border-l border-emerald-50">
                    <div className={`font-medium ${t.completed ? 'line-through text-emerald-500' : 'text-emerald-900'}`}>
                      {t.title}
                    </div>
                    {t.notes && <div className="text-xs text-emerald-600 mt-1">{t.notes}</div>}
                  </div>

                  {/* 3) Priority */}
                  <div className="py-2 px-2 border-l border-emerald-50 flex items-center">
                    <Badge
                      variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'}
                      className={
                        t.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                        t.priority === 'medium' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }
                    >
                      {t.priorityLabel}
                    </Badge>
                  </div>

                  {/* 4) Responsible */}
                  <div className="py-2 px-2 border-l border-emerald-50 flex items-center text-sm text-emerald-800">
                    {t.responsible ? (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        <span className="truncate">{t.responsible}</span>
                      </div>
                    ) : <span className="text-emerald-400">-</span>}
                  </div>

                  {/* 5) Start date */}
                  <div className="py-2 px-2 border-l border-emerald-50 flex items-center justify-center num text-xs text-emerald-800">
                    {t.startDate ? formatDate(t.startDate) : <span className="text-emerald-400">-</span>}
                  </div>

                  {/* 6) Deadline */}
                  <div className="py-2 px-2 border-l border-emerald-50 flex items-center justify-center num text-xs">
                    {t.deadline ? (
                      <span className={isOverdue(t) ? 'text-red-600 font-bold' : 'text-emerald-800'}>
                        {formatDate(t.deadline)}
                      </span>
                    ) : <span className="text-emerald-400">-</span>}
                  </div>

                  {/* 7) Status */}
                  <div className="py-2 px-2 border-l border-emerald-50 flex items-center justify-center">
                    {t.completed ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 ml-1" /> مكتملة
                      </Badge>
                    ) : isOverdue(t) ? (
                      <Badge className="bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                        <AlertCircle className="w-3 h-3 ml-1" /> متأخرة
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                        <Clock className="w-3 h-3 ml-1" /> معلقة
                      </Badge>
                    )}
                  </div>

                  {/* 8) Actions */}
                  <div className="py-2 px-2 flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(t)}
                      className="h-8 w-8 p-0 hover:bg-amber-50"
                      title="تعديل"
                    >
                      <Edit className="w-4 h-4 text-amber-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(t)}
                      className="h-8 w-8 p-0 hover:bg-red-50"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
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
            <span className="text-emerald-800">مكتملة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-emerald-800">معلقة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-emerald-800">متأخرة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-emerald-800">أولوية متوسطة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-700" />
            <span className="text-emerald-800">أولوية عالية</span>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-emerald-900 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-emerald-700" />
              {editing ? 'تعديل المهمة' : 'مهمة جديدة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">المهمة *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: تحضير قوائم الحضور"
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">الأولوية</Label>
                <Select value={formData.priorityLabel} onValueChange={(v) => setFormData({ ...formData, priorityLabel: v })}>
                  <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عالي">عالي</SelectItem>
                    <SelectItem value="متوسط">متوسط</SelectItem>
                    <SelectItem value="منخفض">منخفض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">المسؤول</Label>
                <Select
                  value={formData.responsible || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, responsible: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue placeholder="اختر المسؤول" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مسؤول</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">تاريخ البدء</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">الأجل (الموعد النهائي)</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
              <Checkbox
                id="completed"
                checked={formData.completed}
                onCheckedChange={(v) => setFormData({ ...formData, completed: v === true, status: v === true ? 'done' : 'pending', statusValue: v === true ? '1' : '0' })}
              />
              <Label htmlFor="completed" className="text-emerald-900 font-medium cursor-pointer">مكتملة</Label>
            </div>
            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
