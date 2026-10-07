'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Shield, Plus, Edit, Trash2, Save, X, Users, Lock, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Permission {
  section: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  usersCount: number;
  permissions: Permission[];
}

interface SectionDef {
  id: string;
  label: string;
  icon: string;
  category: string;
}

const categoryLabels: Record<string, string> = {
  core: 'أساسية',
  academic: 'أكاديمية',
  finance: 'مالية',
  communication: 'تواصل',
  admin: 'إدارة',
};

const categoryColors: Record<string, string> = {
  core: 'bg-blue-50 border-blue-200',
  academic: 'bg-purple-50 border-purple-200',
  finance: 'bg-emerald-50 border-emerald-200',
  communication: 'bg-orange-50 border-orange-200',
  admin: 'bg-red-50 border-red-200',
};

export function PermissionsSection() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, Permission>,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setRoles(data.roles || []);
      setSections(data.sections || []);
    } catch {
      toast({ title: 'خطأ', description: 'فشل التحميل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    if (type === 'success') toast({ title: 'تم', description: text });
    else toast({ title: 'خطأ', description: text, variant: 'destructive' });
  };

  const handleEdit = (role: Role) => {
    const perms: Record<string, Permission> = {};
    for (const p of role.permissions) {
      perms[p.section] = { ...p };
    }
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: perms,
    });
    setEditingRole(role);
    setShowForm(true);
  };

  const handleNew = () => {
    // ابدأ بأذونات فارغة
    const perms: Record<string, Permission> = {};
    for (const s of sections) {
      perms[s.id] = { section: s.id, canView: false, canCreate: false, canEdit: false, canDelete: false };
    }
    setFormData({ name: '', description: '', permissions: perms });
    setEditingRole(null);
    setShowForm(true);
  };

  const togglePermission = (section: string, action: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    setFormData(prev => {
      const perm = prev.permissions[section] || { section, canView: false, canCreate: false, canEdit: false, canDelete: false };
      const newPerm = { ...perm, [action]: !perm[action] };
      // إن تم تفعيل إنشاء/تعديل/حذف، فعّل العرض تلقائياً
      if (action !== 'canView' && newPerm[action] && !newPerm.canView) {
        newPerm.canView = true;
      }
      // إن تم إيقاف العرض، أوقف الباقي
      if (action === 'canView' && !newPerm.canView) {
        newPerm.canCreate = false;
        newPerm.canEdit = false;
        newPerm.canDelete = false;
      }
      return { ...prev, permissions: { ...prev.permissions, [section]: newPerm } };
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showStatus('error', 'اسم الدور مطلوب');
      return;
    }

    setSaving(true);
    try {
      const permissions = Object.values(formData.permissions);
      const method = editingRole ? 'PUT' : 'POST';
      const body: any = { name: formData.name, description: formData.description, permissions };
      if (editingRole) body.id = editingRole.id;

      const res = await fetch('/api/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showStatus('success', editingRole ? 'تم تعديل الدور' : 'تم إنشاء الدور');
        setShowForm(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        showStatus('error', err.error || 'فشل الحفظ');
      }
    } catch (e: any) {
      showStatus('error', 'خطأ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا الدور؟')) return;
    const res = await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showStatus('success', 'تم الحذف');
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      showStatus('error', err.error || 'فشل الحذف');
    }
  };

  // تجميع الأقسام حسب الفئة
  const sectionsByCategory = sections.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, SectionDef[]>);

  if (loading) {
    return <div className="text-center py-12">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-white">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">إدارة الصلاحيات</h2>
            <p className="text-sm text-muted-foreground">تحكم في وصول المستخدمين للأقسام والعمليات</p>
          </div>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 ml-2" /> دور جديد
        </Button>
      </div>

      {/* نموذج الإنشاء/التعديل */}
      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle>{editingRole ? `تعديل: ${editingRole.name}` : 'دور جديد'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم الدور *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مشرف قسم"
                  disabled={editingRole?.isSystem}
                />
              </div>
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف مختصر للدور"
                />
              </div>
            </div>

            {/* جدول الصلاحيات */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-3 grid grid-cols-12 gap-2 text-xs font-semibold">
                <div className="col-span-6">القسم</div>
                <div className="col-span-2 text-center">عرض</div>
                <div className="col-span-1 text-center">إضافة</div>
                <div className="col-span-2 text-center">تعديل</div>
                <div className="col-span-1 text-center">حذف</div>
              </div>
              {Object.entries(sectionsByCategory).map(([cat, secs]) => (
                <div key={cat}>
                  <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {categoryLabels[cat] || cat}
                  </div>
                  {secs.map(s => {
                    const perm = formData.permissions[s.id] || { section: s.id, canView: false, canCreate: false, canEdit: false, canDelete: false };
                    return (
                      <div key={s.id} className="px-3 py-2 grid grid-cols-12 gap-2 items-center border-t hover:bg-muted/30">
                        <div className="col-span-6 text-sm">{s.label}</div>
                        <div className="col-span-2 text-center">
                          <Checkbox checked={perm.canView} onCheckedChange={() => togglePermission(s.id, 'canView')} />
                        </div>
                        <div className="col-span-1 text-center">
                          <Checkbox checked={perm.canCreate} onCheckedChange={() => togglePermission(s.id, 'canCreate')} />
                        </div>
                        <div className="col-span-2 text-center">
                          <Checkbox checked={perm.canEdit} onCheckedChange={() => togglePermission(s.id, 'canEdit')} />
                        </div>
                        <div className="col-span-1 text-center">
                          <Checkbox checked={perm.canDelete} onCheckedChange={() => togglePermission(s.id, 'canDelete')} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* قائمة الأدوار */}
      <div className="space-y-3">
        {roles.map(role => (
          <Card key={role.id}>
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedRole === role.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{role.name}</h3>
                      {role.isSystem && <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" /> افتراضي</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{role.description || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" /> {role.usersCount}
                  </Badge>
                  <Badge variant="outline">
                    {role.permissions.filter(p => p.canView).length} قسم
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(role); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(role.id); }}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>

              {/* تفاصيل الصلاحيات */}
              {expandedRole === role.id && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {Object.entries(sectionsByCategory).map(([cat, secs]) => (
                    <div key={cat}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{categoryLabels[cat]}</p>
                      <div className="flex flex-wrap gap-2">
                        {secs.map(s => {
                          const perm = role.permissions.find(p => p.section === s.id);
                          if (!perm?.canView) return null;
                          const actions = ['canView', 'canCreate', 'canEdit', 'canDelete']
                            .filter(a => perm[a as keyof Permission])
                            .map(a => a.replace('can', '').charAt(0))
                            .join('');
                          return (
                            <Badge key={s.id} variant="outline" className="text-xs gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              {s.label} {actions && <span className="text-muted-foreground">({actions})</span>}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
