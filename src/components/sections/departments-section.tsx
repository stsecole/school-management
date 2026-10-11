'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, BookOpen, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Specialization { id: string; name: string; departmentId: string; }
interface Department {
  id: string; name: string; code: string | null; description: string | null;
  isFixed: boolean; hasInstallments: boolean; installmentMonths: number | null;
  defaultMonthlyAmount: number | null;
  _count?: { students: number; teachers: number; courses: number; specializations: number };
  specializations?: Specialization[];
}

export function DepartmentsSection({ canCreate = false, canEdit = false, canDelete = false }: {
  canCreate?: boolean; canEdit?: boolean; canDelete?: boolean;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formData, setFormData] = useState<any>({
    name: '', code: '', description: '',
    hasInstallments: false, installmentMonths: '', defaultMonthlyAmount: '',
  });
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

  const handleOpenEdit = (dept: Department) => {
    setEditing(dept);
    setFormData({
      name: dept.name, code: dept.code || '', description: dept.description || '',
      hasInstallments: dept.hasInstallments || false,
      installmentMonths: dept.installmentMonths || '',
      defaultMonthlyAmount: dept.defaultMonthlyAmount || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editing ? `/api/departments/${editing.id}` : '/api/departments';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        installmentMonths: formData.installmentMonths ? parseInt(formData.installmentMonths) : null,
        defaultMonthlyAmount: formData.defaultMonthlyAmount ? parseFloat(formData.defaultMonthlyAmount) : null,
      }),
    });
    if (res.ok) {
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف القسم "${name}"؟`)) return;
    const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم حذف القسم' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> الأقسام
        </h2>
        {canCreate && (
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 ml-2" /> إضافة قسم
          </Button>
        )}
      </div>

      {!canCreate && !canEdit && !canDelete && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>لديك صلاحية الاطلاع فقط. التعديل والإضافة متاح للمدير أو حسب الصلاحيات الممنوحة.</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا توجد أقسام</div>
            ) : (
              departments.map((dept, i) => (
                <div key={dept.id} className="p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="num">{i + 1}</Badge>
                      <div>
                        <p className="font-bold text-lg">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dept.code && <span className="ml-2">الكود: {dept.code}</span>}
                          {dept._count && (
                            <span className="ml-2">
                              | الطلاب: {dept._count.students || 0} | الأساتذة: {dept._count.teachers || 0}
                            </span>
                          )}
                          {dept.hasInstallments && (
                            <Badge variant="secondary" className="ml-2">أقساط ({dept.installmentMonths} أشهر)</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(dept)}>
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                      )}
                      {canDelete && !dept.isFixed && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(dept.id, dept.name)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'تعديل قسم' : 'إضافة قسم'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>اسم القسم *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الكود</Label>
                <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div>
                <Label>عدد أشهر الأقساط</Label>
                <Input type="number" value={formData.installmentMonths} onChange={(e) => setFormData({ ...formData, installmentMonths: e.target.value })} disabled={!formData.hasInstallments} />
              </div>
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox" id="hasInstallments" checked={formData.hasInstallments}
                onChange={(e) => setFormData({ ...formData, hasInstallments: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="hasInstallments" className="text-sm font-medium">يدعم نظام الأقساط الشهرية</label>
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