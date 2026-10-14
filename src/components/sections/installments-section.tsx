'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Wallet, CheckCircle2, Clock, AlertCircle, Loader2, Plus, Trash2,
  RefreshCw, Users, Receipt, Undo2, Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: 'مدفوع', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' },
  DUE: { label: 'مستحق', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
  OVERDUE: { label: 'متأخر', color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
  PENDING: { label: 'معلق', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300' },
};

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

interface InstallmentRow {
  id: string;
  amount: number;
  installmentNumber: number;
  dueDate: string;
  status: string;
  student: { id: string; name: string; studentNumber: string | null; phone: string | null; department: { name: string } | null };
  payment: { id: string; receiptNumber: string; paymentDate: string; paymentMethod: string } | null;
  paymentPlan: { id: string; name: string };
}

interface Stats {
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  totalOverdue: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  dueCount: number;
  overdueCount: number;
}

interface Plan {
  id: string;
  name: string;
  totalAmount: number;
  monthsCount: number;
  monthlyAmount: number;
  active: boolean;
  _count: { installments: number };
}

export function InstallmentsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const { toast } = useToast();

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [recording, setRecording] = useState(false);

  // Plan creation dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', description: '', totalAmount: '', monthsCount: '', startDate: new Date().toISOString().split('T')[0] });
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [creatingPlan, setCreatingPlan] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('planId', planFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/installments/dashboard?${params.toString()}`);
      const data = await res.json();
      setInstallments(data.installments || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/installments/plans');
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setAllStudents(data.students || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, [statusFilter, planFilter, search]);
  useEffect(() => { loadPlans(); }, []);

  const handleOverdueCheck = async () => {
    try {
      const res = await fetch('/api/installments/overdue-check');
      const data = await res.json();
      toast({ title: 'تم', description: `تم تحديث ${data.overdueUpdated} قسط متأخر و ${data.dueCount || 0} قسط مستحق` });
      load();
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل التحديث', variant: 'destructive' });
    }
  };

  const toggleInstallment = (id: string) => {
    setSelectedInstallments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRecordPayment = async () => {
    if (selectedInstallments.size === 0) {
      toast({ title: 'تنبيه', description: 'اختر قسطاً واحداً على الأقل', variant: 'destructive' });
      return;
    }
    setRecording(true);
    try {
      const installmentsPayload = Array.from(selectedInstallments).map(id => {
        const inst = installments.find(i => i.id === id);
        return { id, amount: inst?.amount || 0 };
      });
      const res = await fetch('/api/installments/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installments: installmentsPayload, paymentMethod, paymentDate, notes: paymentNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: `تم تسجيل الدفعة - رقم الوصل: ${data.receiptNumber}` });
        setPaymentDialogOpen(false);
        setSelectedInstallments(new Set());
        setPaymentNotes('');
        load();
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل التسجيل', variant: 'destructive' });
    } finally {
      setRecording(false);
    }
  };

  const handleRevertPayment = async (receiptNumber: string) => {
    if (!confirm(`تراجع عن الدفعة رقم ${receiptNumber}؟`)) return;
    try {
      const res = await fetch(`/api/installments/payments?receiptNumber=${receiptNumber}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'تم', description: 'تم التراجع عن الدفعة' });
        load();
      } else {
        toast({ title: 'خطأ', description: 'فشل التراجع', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل الاتصال', variant: 'destructive' });
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.name || !planForm.totalAmount || !planForm.monthsCount || !planForm.startDate) {
      toast({ title: 'تنبيه', description: 'املأ جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    if (selectedStudents.size === 0) {
      toast({ title: 'تنبيه', description: 'اختر طالباً واحداً على الأقل', variant: 'destructive' });
      return;
    }
    setCreatingPlan(true);
    try {
      const res = await fetch('/api/installments/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          totalAmount: parseFloat(planForm.totalAmount),
          monthsCount: parseInt(planForm.monthsCount),
          studentIds: Array.from(selectedStudents),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: `تم إنشاء الخطة وتوليد ${data.installmentsCreated} قسط` });
        setPlanDialogOpen(false);
        setPlanForm({ name: '', description: '', totalAmount: '', monthsCount: '', startDate: new Date().toISOString().split('T')[0] });
        setSelectedStudents(new Set());
        loadPlans();
        load();
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'فشل الإنشاء', variant: 'destructive' });
    } finally {
      setCreatingPlan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> نظام الأقساط المالية
          </h2>
          <p className="text-muted-foreground text-sm">إدارة خطط الدفع والأقساط والمدفوعات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleOverdueCheck}>
            <RefreshCw className="w-4 h-4 ml-2" /> فحص المتأخرات
          </Button>
          {isDirector && (
            <Button size="sm" onClick={() => { loadStudents(); setPlanDialogOpen(true); }}>
              <Plus className="w-4 h-4 ml-2" /> خطة دفع جديدة
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1"><Wallet className="w-3.5 h-3.5 text-blue-600" /><span className="text-xs text-muted-foreground">إجمالي الأقساط</span></div>
              <p className="text-lg font-bold text-blue-700 num">{currency(stats.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span className="text-xs text-muted-foreground">المبالغ المدفوعة</span></div>
              <p className="text-lg font-bold text-emerald-700 num">{currency(stats.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5 text-orange-600" /><span className="text-xs text-muted-foreground">المتبقي</span></div>
              <p className="text-lg font-bold text-orange-700 num">{currency(stats.totalRemaining)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-muted-foreground">المتأخرات</span></div>
              <p className="text-lg font-bold text-red-700 num">{currency(stats.totalOverdue)}</p>
              <p className="text-xs text-red-500 num">{stats.overdueCount} قسط</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم..." className="pr-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="PENDING">معلق</SelectItem>
                <SelectItem value="DUE">مستحق</SelectItem>
                <SelectItem value="OVERDUE">متأخر</SelectItem>
                <SelectItem value="PAID">مدفوع</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="الخطة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخطط</SelectItem>
                {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedInstallments.size > 0 && (
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                <Receipt className="w-4 h-4 ml-2" /> تسجيل دفعة ({selectedInstallments.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Installments Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>القسط</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الوصل</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : installments.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد أقساط</TableCell></TableRow>
                ) : installments.map((inst) => {
                  const statusCfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.PENDING;
                  return (
                    <TableRow key={inst.id} className={inst.status === 'PAID' ? 'bg-emerald-50/30' : inst.status === 'OVERDUE' ? 'bg-red-50/30' : ''}>
                      <TableCell>
                        {inst.status !== 'PAID' && (
                          <Checkbox checked={selectedInstallments.has(inst.id)} onCheckedChange={() => toggleInstallment(inst.id)} />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{inst.student.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{inst.student.department?.name || '-'}</TableCell>
                      <TableCell className="num text-xs">#{inst.installmentNumber}</TableCell>
                      <TableCell className="num text-xs">{new Date(inst.dueDate).toLocaleDateString('ar')}</TableCell>
                      <TableCell className="num font-bold">{currency(inst.amount)}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </TableCell>
                      <TableCell>{inst.payment ? <code className="text-xs num">{inst.payment.receiptNumber}</code> : '-'}</TableCell>
                      <TableCell className="text-center">
                        {inst.payment && isDirector && (
                          <Button size="sm" variant="ghost" onClick={() => handleRevertPayment(inst.payment!.receiptNumber)} title="تراجع">
                            <Undo2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> تسجيل دفعة</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              عدد الأقساط المحددة: <strong className="num">{selectedInstallments.size}</strong>
              <br />
              المبلغ الإجمالي: <strong className="num">{currency(Array.from(selectedInstallments).reduce((s, id) => s + (installments.find(i => i.id === id)?.amount || 0), 0))}</strong>
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقداً</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="cheque">شيك</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>تاريخ الدفع</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={2} placeholder="ملاحظات..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleRecordPayment} disabled={recording}>
              {recording ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري...</> : <><Receipt className="w-4 h-4 ml-2" /> تسجيل</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> خطة دفع جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>اسم الخطة *</Label>
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="مثال: تقني سامي - دفعة 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المبلغ الإجمالي (دج) *</Label>
                <Input type="number" value={planForm.totalAmount} onChange={(e) => setPlanForm({ ...planForm, totalAmount: e.target.value })} dir="ltr" />
              </div>
              <div>
                <Label>عدد الأشهر *</Label>
                <Input type="number" value={planForm.monthsCount} onChange={(e) => setPlanForm({ ...planForm, monthsCount: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div>
              <Label>تاريخ بداية الأقساط *</Label>
              <Input type="date" value={planForm.startDate} onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })} dir="ltr" />
            </div>
            {planForm.totalAmount && planForm.monthsCount && (
              <div className="p-2 bg-blue-50 rounded text-sm text-blue-700">
                القسط الشهري: <strong className="num">{currency(parseFloat(planForm.totalAmount) / parseInt(planForm.monthsCount))}</strong>
              </div>
            )}
            <div>
              <Label>اختر الطلاب ({selectedStudents.size}/{allStudents.length})</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {allStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 border-b">
                    <Checkbox
                      checked={selectedStudents.has(s.id)}
                      onCheckedChange={() => {
                        setSelectedStudents(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                    />
                    <span className="text-sm">{s.name}</span>
                    {s.department && <span className="text-xs text-muted-foreground">({s.department.name})</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreatePlan} disabled={creatingPlan}>
              {creatingPlan ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري...</> : <><Plus className="w-4 h-4 ml-2" /> إنشاء</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
