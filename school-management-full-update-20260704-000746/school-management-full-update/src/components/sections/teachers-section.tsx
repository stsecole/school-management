'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  specialty: string | null;
  departmentId: string | null;
  salary: number;
  hireDate: string | null;
  status: string;
  department?: { name: string };
}

interface Department { id: string; name: string; }

const empty = {
  name: '', email: '', phone: '', gender: 'ذكر', specialty: '',
  departmentId: '', salary: '0', hireDate: '', status: 'active',
};

export function TeachersSection({ isDirector = false }: { isDirector?: boolean }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<any>(empty);

  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterDept !== 'all') params.set('departmentId', filterDept);
    const res = await fetch(`/api/teachers?${params.toString()}`);
    const data = await res.json();
    setTeachers(data.teachers || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
  }, []);
  useEffect(() => { load(); }, [search, filterDept]);

  const handleOpenAdd = () => { setEditing(null); setFormData(empty); setDialogOpen(true); };
  const handleOpenEdit = (t: Teacher) => {
    setEditing(t);
    setFormData({
      name: t.name, email: t.email || '', phone: t.phone || '', gender: t.gender || 'ذكر',
      specialty: t.specialty || '', departmentId: t.departmentId || '',
      salary: String(t.salary), hireDate: t.hireDate ? t.hireDate.split('T')[0] : '', status: t.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'اسم الأستاذ مطلوب', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/teachers/${editing.id}` : '/api/teachers';
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

  const handleDelete = async (t: Teacher) => {
    if (!confirm(`حذف الأستاذ "${t.name}"؟`)) return;
    const res = await fetch(`/api/teachers/${t.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">إدارة الأساتذة</h2>
          <p className="text-muted-foreground text-sm">إجمالي: {teachers.length} أستاذ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/teachers', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> إضافة أستاذ</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو التخصص..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>التخصص</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>الهاتف</TableHead>
                  {isDirector && <TableHead>الراتب</TableHead>}
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isDirector ? 8 : 7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : teachers.length === 0 ? (
                  <TableRow><TableCell colSpan={isDirector ? 8 : 7} className="text-center py-8 text-muted-foreground">لا يوجد أساتذة</TableCell></TableRow>
                ) : teachers.map((t, i) => (
                  <TableRow key={t.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.specialty || '-'}</TableCell>
                    <TableCell>{t.department?.name || '-'}</TableCell>
                    <TableCell className="num text-xs">{t.phone || '-'}</TableCell>
                    {isDirector && <TableCell className="num font-medium">{new Intl.NumberFormat('ar-DZ').format(t.salary)} دج</TableCell>}
                    <TableCell>
                      <Badge variant={t.status === 'active' ? 'default' : 'outline'}>
                        {t.status === 'active' ? 'نشط' : 'غير نشط'}
                      </Badge>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل بيانات الأستاذ' : 'إضافة أستاذ جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>الاسم *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: أ. قروي محمد" />
            </div>
            <div className="space-y-2">
              <Label>الجنس</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التخصص</Label>
              <Input value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} placeholder="مثال: الصيدلة" />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDirector && (
              <div className="space-y-2">
                <Label>الراتب الشهري (دج)</Label>
                <Input type="number" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} dir="ltr" />
              </div>
            )}
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0661..." dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ التوظيف</Label>
              <Input type="date" value={formData.hireDate} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
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
