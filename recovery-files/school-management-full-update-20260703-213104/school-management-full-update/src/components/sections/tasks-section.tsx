'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Download, CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">متابعة المهام</h2>
          <p className="text-muted-foreground text-sm">
            <span className="num font-medium">{tasks.length}</span> مهمة •
            <span className="num font-medium text-amber-600 mx-1">{pending}</span> معلقة •
            <span className="num font-medium text-red-600 mx-1">{overdue}</span> متأخرة •
            <span className="num font-medium text-emerald-600 mx-1">{completed}</span> مكتملة
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/tasks', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> مهمة جديدة</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="pending">المعلقة</SelectItem>
                <SelectItem value="completed">المكتملة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأولويات</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterResponsible} onValueChange={setFilterResponsible}>
              <SelectTrigger><SelectValue placeholder="كل المسؤولين" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المسؤولين</SelectItem>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">إكتمال</TableHead>
                  <TableHead>المهام</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>تاريخ البدأ</TableHead>
                  <TableHead>الأجال</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد مهام</TableCell></TableRow>
                ) : tasks.map((t) => (
                  <TableRow key={t.id} className={`hover:bg-muted/50 ${isOverdue(t) ? 'bg-red-50/40' : ''}`}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={t.completed}
                        onCheckedChange={() => handleToggleComplete(t)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className={t.completed ? 'line-through text-muted-foreground' : ''}>{t.title}</div>
                      {t.notes && <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'}>
                        {t.priorityLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.responsible || '-'}</TableCell>
                    <TableCell className="num text-xs">{t.startDate ? new Date(t.startDate).toLocaleDateString('ar') : '-'}</TableCell>
                    <TableCell className="num text-xs">
                      {t.deadline ? (
                        <span className={isOverdue(t) ? 'text-red-600 font-medium' : ''}>
                          {new Date(t.deadline).toLocaleDateString('ar')}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {t.completed ? (
                        <Badge variant="default" className="bg-emerald-600"><CheckCircle2 className="w-3 h-3 ml-1" /> مكتملة</Badge>
                      ) : isOverdue(t) ? (
                        <Badge variant="destructive"><AlertCircle className="w-3 h-3 ml-1" /> متأخرة</Badge>
                      ) : (
                        <Badge variant="secondary"><Clock className="w-3 h-3 ml-1" /> معلقة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(t)}><Edit className="w-4 h-4 text-amber-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(t)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل المهمة' : 'مهمة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>المهمة *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="مثال: تحضير قوائم الحضور" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select value={formData.priorityLabel} onValueChange={(v) => setFormData({ ...formData, priorityLabel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عالي">عالي</SelectItem>
                    <SelectItem value="متوسط">متوسط</SelectItem>
                    <SelectItem value="منخفض">منخفض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المسؤول</Label>
                <Select
                  value={formData.responsible || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, responsible: v === 'none' ? '' : v })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر المسؤول" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مسؤول</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>تاريخ البدأ</Label>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>الأجال (الموعد النهائي)</Label>
                <Input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="completed"
                checked={formData.completed}
                onCheckedChange={(v) => setFormData({ ...formData, completed: v === true, status: v === true ? 'done' : 'pending', statusValue: v === true ? '1' : '0' })}
              />
              <Label htmlFor="completed">مكتملة</Label>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
