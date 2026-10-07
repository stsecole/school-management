'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2, Plus, Edit, Trash2, Phone, MapPin, Mail, User, Loader2,
  Users, GraduationCap, Wallet, TrendingDown, Power, Search, CheckCircle2, XCircle,
  Download, Upload,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Branch {
  id: string;
  name: string;
  code: string | null;
  receiptPrefix: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  managerName: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  _count?: {
    students: number;
    teachers: number;
    users: number;
    payments: number;
    expenses: number;
  };
}

interface Props {
  isDirector: boolean;
}

/**
 * BranchesSection — manage school branches (CRUD + per-branch stats).
 *
 * Director-only. Each branch shows: students count, teachers count, users count,
 * payments count, expenses count. Branches can be activated/deactivated.
 */
export function BranchesSection({ isDirector }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', receiptPrefix: '', address: '', phone: '', email: '',
    managerName: '', isActive: true, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/branches');
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load branches', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.code || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q) ||
      (b.managerName || '').toLowerCase().includes(q)
    );
  }, [branches, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', receiptPrefix: '', address: '', phone: '', email: '', managerName: '', isActive: true, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code || '',
      receiptPrefix: b.receiptPrefix || '',
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      managerName: b.managerName || '',
      isActive: b.isActive,
      notes: b.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Branch name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/branches?id=${editing.id}` : '/api/branches';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: editing ? 'Branch updated' : 'Branch created' });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: 'Network error: ' + (e.message || ''), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: Branch) => {
    if (!confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/branches?id=${b.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: 'Branch deleted' });
        load();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  const toggleActive = async (b: Branch) => {
    try {
      const res = await fetch(`/api/branches?id=${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: b.isActive ? 'Branch deactivated' : 'Branch activated' });
        load();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
  };

  // ===== Export branch data as Excel =====
  const handleExport = (b: Branch) => {
    // Open the export URL in a new tab — browser will trigger download
    window.open(`/api/branches/export?id=${b.id}`, '_blank');
    toast({ title: 'جاري التصدير', description: `تصدير بيانات ${b.name}...` });
  };

  // ===== Import branch data from Excel =====
  const [importingId, setImportingId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [pendingImportId, setPendingImportId] = useState<string | null>(null);

  const handleImportClick = (b: Branch) => {
    setPendingImportId(b.id);
    importFileRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const branchId = pendingImportId;
    if (!file || !branchId) return;

    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون Excel (.xlsx أو .xls)', variant: 'destructive' });
      return;
    }

    if (!confirm(`استيراد بيانات من "${file.name}" إلى فرع "${branch.name}"؟\n\nملاحظة:\n• الطلاب والأساتذة الموجودون بنفس الاسم سيتم تخطّيهم\n• المدفوعات لا تُستورد (لتفادي تكرار أرقام الوصولات)\n• المصاريف والمهام ستُضاف كما هي`)) {
      if (importFileRef.current) importFileRef.current.value = '';
      setPendingImportId(null);
      return;
    }

    setImportingId(branchId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/branches/import?id=${branchId}`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        const s = data.stats;
        toast({
          title: 'تم الاستيراد',
          description: `طلاب: +${s.studentsImported} (${s.studentsSkipped} متخطّى) • أساتذة: +${s.teachersImported} (${s.teachersSkipped} متخطّى) • مصاريف: +${s.expensesImported} • مهام: +${s.tasksImported}`,
        });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الاستيراد', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم: ' + (err.message || ''), variant: 'destructive' });
    } finally {
      setImportingId(null);
      setPendingImportId(null);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  // Aggregate stats across all branches
  const totals = useMemo(() => {
    return branches.reduce((acc, b) => ({
      students: acc.students + (b._count?.students || 0),
      teachers: acc.teachers + (b._count?.teachers || 0),
      payments: acc.payments + (b._count?.payments || 0),
      expenses: acc.expenses + (b._count?.expenses || 0),
    }), { students: 0, teachers: 0, payments: 0, expenses: 0 });
  }, [branches]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Branches Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage school branches and view their statistics
            </p>
          </div>
        </div>
        {isDirector && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 ml-2" /> Add Branch
          </Button>
        )}
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Branches</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold num text-indigo-700">{branches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Students</span>
              <GraduationCap className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold num text-emerald-700">{totals.students}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Teachers</span>
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold num text-amber-700">{totals.teachers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Payments</span>
              <Wallet className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold num text-purple-700">{totals.payments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, address, or manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branches list */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading branches...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No branches match your search' : 'No branches yet'}</p>
            {!search && isDirector && (
              <Button className="mt-3" onClick={openAdd}>
                <Plus className="w-4 h-4 ml-2" /> Create the first branch
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <Card
              key={b.id}
              className={`overflow-hidden transition-all hover:shadow-lg ${
                b.isActive ? 'border-muted' : 'border-muted opacity-60'
              }`}
            >
              {/* Card header */}
              <div className="p-4 bg-gradient-to-l from-indigo-500/10 to-purple-500/10 border-b">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      b.isActive ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{b.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.code && <Badge variant="outline" className="text-xs num">{b.code}</Badge>}
                        {b.receiptPrefix && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">وصولات: {b.receiptPrefix}-</Badge>}
                        {b.isActive ? (
                          <Badge variant="default" className="text-xs bg-emerald-600">
                            <CheckCircle2 className="w-3 h-3 ml-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="w-3 h-3 ml-1" /> Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card body — contact info */}
              <CardContent className="p-4 space-y-2 text-sm">
                {b.managerName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{b.managerName}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span className="num truncate" dir="ltr">{b.phone}</span>
                  </div>
                )}
                {b.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate" dir="ltr">{b.email}</span>
                  </div>
                )}
                {b.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{b.address}</span>
                  </div>
                )}
              </CardContent>

              {/* Stats footer */}
              <div className="px-4 py-3 bg-muted/30 border-t grid grid-cols-4 gap-1 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="font-bold num text-emerald-700">{b._count?.students || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teachers</p>
                  <p className="font-bold num text-amber-700">{b._count?.teachers || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Users</p>
                  <p className="font-bold num text-blue-700">{b._count?.users || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payments</p>
                  <p className="font-bold num text-purple-700">{b._count?.payments || 0}</p>
                </div>
              </div>

              {/* Actions */}
              {isDirector && (
                <div className="px-4 py-2 border-t flex items-center justify-end gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleExport(b)}
                    title="تصدير بيانات الفرع (Excel)"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleImportClick(b)}
                    disabled={importingId === b.id}
                    title="استيراد بيانات من ملف Excel"
                  >
                    {importingId === b.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-blue-600" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(b)}
                    title={b.isActive ? 'Deactivate branch' : 'Activate branch'}
                  >
                    <Power className={`w-4 h-4 ${b.isActive ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(b)}
                    title="Edit branch"
                  >
                    <Edit className="w-4 h-4 text-amber-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(b)}
                    title="Delete branch"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              {editing ? 'Edit Branch' : 'Add New Branch'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Main Branch"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. BR1"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Receipt Prefix — مهم لتمييز الوصولات بين الفروع */}
            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
              <Label className="font-medium text-amber-800">بادئة رقم الوصل (Receipt Prefix)</Label>
              <Input
                value={form.receiptPrefix}
                onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value })}
                placeholder="مثال: X أو Y أو Z"
                dir="ltr"
                maxLength={3}
                className="max-w-32"
              />
              <p className="text-xs text-amber-700">
                كل وصل في هذا الفرع سيبدأ بهذه البادئة. مثلاً إذا وضعت <strong>X</strong>،
                أرقام الوصولات ستكون: <code>X-2001</code>, <code>X-2002</code>, ...
                <br />
                فرع آخر ببادئة <strong>Y</strong>: <code>Y-2003</code>, <code>Y-2004</code>, ...
                <br />
                بدون بادئة: تستخدم <code>W</code> (افتراضي).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Manager Name</Label>
              <Input
                value={form.managerName}
                onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                placeholder="Branch manager"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Branch address"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Optional notes about this branch"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Branch is active (users can be assigned to it)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> Saving...</> : (editing ? 'Save' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for importing Excel */}
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Help banner explaining export/import */}
      {isDirector && branches.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 text-xs text-blue-800 space-y-1">
            <p className="font-medium">تصدير واستيراد بيانات الفروع:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><strong>تصدير</strong> (⬇️): يحفظ كل بيانات الفرع في ملف Excel متعدد الصفحات (طلاب، أساتذة، مدفوعات، مصاريف، حضور، مهام، وثائق)</li>
              <li><strong>استيراد</strong> (⬆️): يرفع ملف Excel لإضافة بيانات لفرع محدد — الطلاب والأساتذة الموجودون بنفس الاسم يُتجاوزون</li>
              <li>المدفوعات <strong>لا تُستورد</strong> لتجنب تكرار أرقام الوصولات</li>
              <li>يمكن استخدام التصدير كنسخة احتياطية لكل فرع</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
