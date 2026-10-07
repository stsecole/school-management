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
import { Plus, Edit, Trash2, KeyRound, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  username: string;
  name: string;
  role: 'director' | 'employee';
  canManageTimetable: boolean;
  createdAt: string;
}

const empty = { username: '', name: '', password: '', role: 'employee', canManageTimetable: false };

export function UsersSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [formData, setFormData] = useState<any>(empty);
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(empty);
    setDialogOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditing(u);
    setFormData({ username: u.username, name: u.name, password: '', role: u.role, canManageTimetable: u.canManageTimetable });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.name) {
      toast({ title: 'تنبيه', description: 'يرجى ملء الاسم واسم المستخدم', variant: 'destructive' });
      return;
    }
    if (!editing && !formData.password) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال كلمة المرور للحساب الجديد', variant: 'destructive' });
      return;
    }

    try {
      if (editing) {
        // Update existing
        const res = await fetch(`/api/users/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: formData.username, name: formData.name, role: formData.role }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'خطأ', description: data.error || 'فشل التحديث', variant: 'destructive' });
          return;
        }
        toast({ title: 'تم', description: 'تم تحديث الحساب' });
      } else {
        // Create new
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: 'خطأ', description: data.error || 'فشل الإنشاء', variant: 'destructive' });
          return;
        }
        toast({ title: 'تم', description: 'تم إنشاء الحساب بنجاح' });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`هل أنت متأكد من حذف حساب "${u.name}" (${u.username})؟`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: 'تم حذف الحساب' });
      load();
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل الحذف', variant: 'destructive' });
    }
  };

  const handleChangePassword = async () => {
    if (!passwordDialog.user) return;
    if (!newPassword || newPassword.length < 4) {
      toast({ title: 'تنبيه', description: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/users/${passwordDialog.user.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: 'تم', description: 'تم تغيير كلمة المرور بنجاح' });
      setPasswordDialog({ open: false, user: null });
      setNewPassword('');
    } else {
      toast({ title: 'خطأ', description: data.error || 'فشل التغيير', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> إدارة الحسابات
          </h2>
          <p className="text-muted-foreground text-sm">إجمالي: {users.length} حساب</p>
        </div>
        <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> إضافة حساب</Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">قسم محمي - للمدير فقط</p>
            <p className="text-amber-700 mt-1">
              هنا يمكنك إنشاء حسابات للموظفين وتحديد صلاحياتهم. الموظفون لا يمكنهم الوصول للقسم المالي أو إدارة الحسابات.
            </p>
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
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead className="text-center">صلاحية الجدول</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حسابات</TableCell></TableRow>
                ) : users.map((u, i) => (
                  <TableRow key={u.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="font-mono num">{u.username}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'director' ? 'default' : 'secondary'}>
                        {u.role === 'director' ? 'مدير' : 'موظف'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {u.role === 'director' ? (
                        <Badge variant="default">تلقائياً</Badge>
                      ) : u.canManageTimetable ? (
                        <Badge className="bg-blue-600">✓ مخوّل</Badge>
                      ) : (
                        <Badge variant="outline">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="num text-sm">{new Date(u.createdAt).toLocaleDateString('ar')}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(u)} title="تعديل">
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPasswordDialog({ open: true, user: u }); setNewPassword(''); }} title="تغيير كلمة المرور">
                          <KeyRound className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(u)} title="حذف">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: موظف التسجيل" />
            </div>
            <div className="space-y-2">
              <Label>اسم المستخدم *</Label>
              <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="مثال: employee2" dir="ltr" />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>كلمة المرور *</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="4 أحرف على الأقل" dir="ltr" />
              </div>
            )}
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v, canManageTimetable: v === 'director' ? true : formData.canManageTimetable })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">موظف (لا يرى القسم المالي)</SelectItem>
                  <SelectItem value="director">مدير (صلاحيات كاملة)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.role === 'employee' && (
              <div className="md:col-span-2 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canManageTimetable}
                    onChange={(e) => setFormData({ ...formData, canManageTimetable: e.target.checked })}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-blue-900">صلاحية إدارة الجدول الزمني</span>
                    <p className="text-xs text-blue-700 mt-1">
                      يسمح للموظف بإضافة وتعديل وحذف الحصص في الجدول الأسبوعي (القاعات، الأفواج، المواد، الفترات، العطل).
                      تبقى صلاحية التوليد التلقائي والتصدير للمدير فقط.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ' : 'إنشاء'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password change dialog */}
      <Dialog open={passwordDialog.open} onOpenChange={(v) => setPasswordDialog({ ...passwordDialog, open: v })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              تغيير كلمة المرور
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">
                تغيير كلمة المرور لـ: <span className="font-medium">{passwordDialog.user?.name}</span>
                {' '}(<span className="font-mono num">{passwordDialog.user?.username}</span>)
              </p>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4 أحرف على الأقل"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> سيحتاج المستخدم لتسجيل الدخول بكلمة المرور الجديدة في المرة القادمة
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog({ open: false, user: null })}>إلغاء</Button>
            <Button onClick={handleChangePassword}>تغيير كلمة المرور</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
