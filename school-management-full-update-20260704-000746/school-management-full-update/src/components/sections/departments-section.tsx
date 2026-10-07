'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, BookOpen, Users, GraduationCap, Layers, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Specialization {
  id: string;
  name: string;
  departmentId: string;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isFixed: boolean;
  hasInstallments: boolean;
  installmentMonths: number | null;
  defaultMonthlyAmount: number | null;
  _count?: { students: number; teachers: number; courses: number; specializations: number };
  specializations?: Specialization[];
}

export function DepartmentsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', code: '', description: '',
    hasInstallments: false, installmentMonths: '', defaultMonthlyAmount: '',
  });
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null);
  const [specFormData, setSpecFormData] = useState<any>({ name: '', departmentId: '' });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/departments');
    const data = await res.json();
    setDepartments(data.departments || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ name: '', code: '', description: '', hasInstallments: false, installmentMonths: '', defaultMonthlyAmount: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (d: Department) => {
    setEditing(d);
    setFormData({
      name: d.name, code: d.code || '', description: d.description || '',
      hasInstallments: d.hasInstallments,
      installmentMonths: d.installmentMonths ? String(d.installmentMonths) : '',
      defaultMonthlyAmount: d.defaultMonthlyAmount ? String(d.defaultMonthlyAmount) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'اسم القسم مطلوب', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/departments/${editing.id}` : '/api/departments';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (d: Department) => {
    if (!confirm(`حذف القسم "${d.name}"؟`)) return;
    const res = await fetch(`/api/departments/${d.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'تعذر الحذف', variant: 'destructive' });
    }
  };

  // Specialization handlers
  const handleOpenAddSpec = (deptId: string) => {
    setEditingSpec(null);
    setSpecFormData({ name: '', departmentId: deptId });
    setSpecDialogOpen(true);
  };

  const handleOpenEditSpec = (s: Specialization) => {
    setEditingSpec(s);
    setSpecFormData({ name: s.name, departmentId: s.departmentId });
    setSpecDialogOpen(true);
  };

  const handleSaveSpec = async () => {
    if (!specFormData.name.trim()) {
      toast({ title: 'تنبيه', description: 'اسم التخصص مطلوب', variant: 'destructive' });
      return;
    }
    const url = editingSpec ? `/api/specializations/${editingSpec.id}` : '/api/specializations';
    const method = editingSpec ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(specFormData),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: editingSpec ? 'تم التحديث' : 'تمت الإضافة' });
      setSpecDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDeleteSpec = async (s: Specialization) => {
    if (!confirm(`حذف التخصص "${s.name}"؟`)) return;
    const res = await fetch(`/api/specializations/${s.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'تعذر الحذف', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">الأقسام والشعب</h2>
          <p className="text-muted-foreground text-sm">إجمالي: {departments.length} قسم</p>
        </div>
        {isDirector && (
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> إضافة قسم</Button>
        )}
      </div>

      {!isDirector && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              إدارة الأقسام والتخصصات متاحة للمدير فقط. يمكنك تصفح القائمة ولكن لا يمكنك التعديل.
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : departments.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">لا توجد أقسام</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {d.name}
                        {d.isFixed && <Badge variant="secondary" className="text-[10px]">ثابت</Badge>}
                        {d.hasInstallments && <Badge variant="outline" className="text-[10px] text-orange-600">{d.installmentMonths} شهر</Badge>}
                      </CardTitle>
                      {d.code && <Badge variant="outline" className="text-xs mt-1 num">{d.code}</Badge>}
                    </div>
                  </div>
                  {isDirector && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(d)}>
                        <Edit className="w-4 h-4 text-amber-600" />
                      </Button>
                      {!d.isFixed && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(d)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {d.description && <p className="text-sm text-muted-foreground mb-3">{d.description}</p>}
                <div className="flex items-center gap-4 text-sm mb-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="num font-medium">{d._count?.students || 0}</span>
                    <span className="text-muted-foreground">طالب</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <span className="num font-medium">{d._count?.teachers || 0}</span>
                    <span className="text-muted-foreground">أستاذ</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span className="num font-medium">{d._count?.specializations || 0}</span>
                    <span className="text-muted-foreground">تخصص</span>
                  </div>
                </div>

                {/* Specializations list */}
                <div className="border-t pt-3 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">التخصصات (الشعب)</span>
                    {isDirector && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleOpenAddSpec(d.id)}>
                        <Plus className="w-3 h-3 ml-1" /> تخصص
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.specializations && d.specializations.length > 0 ? (
                      d.specializations.map(s => (
                        <div key={s.id} className="inline-flex items-center gap-1 group">
                          <Badge variant="outline" className="text-xs">
                            {s.name}
                            {isDirector && (
                              <>
                                <button onClick={() => handleOpenEditSpec(s)} className="mr-1 hover:text-amber-600">
                                  <Edit className="w-3 h-3 inline" />
                                </button>
                                <button onClick={() => handleDeleteSpec(s)} className="hover:text-red-600">
                                  <Trash2 className="w-3 h-3 inline" />
                                </button>
                              </>
                            )}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">لا توجد تخصصات</span>
                    )}
                  </div>
                </div>

                {d.hasInstallments && d.defaultMonthlyAmount && (
                  <div className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    القسط الشهري الافتراضي: <span className="num font-medium">{d.defaultMonthlyAmount} دج</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Department dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم القسم *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={editing?.isFixed} placeholder="مثال: قسم جديد" />
              {editing?.isFixed && <p className="text-xs text-muted-foreground">لا يمكن تغيير اسم الأقسام الثابتة</p>}
            </div>
            <div className="space-y-2">
              <Label>الرمز</Label>
              <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="مثال: TS" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hasInstallments}
                  onChange={(e) => setFormData({ ...formData, hasInstallments: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">قسم بأقساط شهرية (مثل التقني سامي - 30 شهر)</span>
              </label>
            </div>
            {formData.hasInstallments && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50/50 rounded-lg border border-orange-200">
                <div className="space-y-2">
                  <Label>عدد الأشهر</Label>
                  <Input type="number" value={formData.installmentMonths} onChange={(e) => setFormData({ ...formData, installmentMonths: e.target.value })} placeholder="30" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>القسط الشهري الافتراضي (دج)</Label>
                  <Input type="number" value={formData.defaultMonthlyAmount} onChange={(e) => setFormData({ ...formData, defaultMonthlyAmount: e.target.value })} placeholder="3000" dir="ltr" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialization dialog */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpec ? 'تعديل التخصص' : 'إضافة تخصص جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم التخصص *</Label>
              <Input value={specFormData.name} onChange={(e) => setSpecFormData({ ...specFormData, name: e.target.value })} placeholder="مثال: صيدلة" />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select value={specFormData.departmentId} onValueChange={(v) => setSpecFormData({ ...specFormData, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveSpec}>{editingSpec ? 'حفظ' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
