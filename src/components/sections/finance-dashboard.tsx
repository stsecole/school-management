'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Trash2, Download, Printer, Wallet, TrendingUp, TrendingDown,
  Users, GraduationCap, BarChart3, FileText, Receipt, ReceiptIndianRupee, Edit,
  UserCog, Loader2, Ban, RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

// ===== Cancel/uncancel receipt helper =====
async function toggleCancelReceipt(type: 'student' | 'teacher' | 'staff', id: string, action: 'cancel' | 'uncancel', reason?: string) {
  const res = await fetch(`/api/finance/cancel/${type}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل');
  return data;
}

// ===== Cancel reason dialog state =====
function CancelReceiptDialog({ open, onOpenChange, onConfirm, receiptLabel }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (reason: string) => void;
  receiptLabel: string;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Ban className="w-5 h-5" /> تأكيد شطب الوصل
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">سيتم شطب الوصل: <span className="font-mono font-bold">{receiptLabel}</span></p>
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
            <p className="font-medium">تنبيه:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>المبلغ سيُستبعد من الإحصائيات</li>
              <li>سيظهر خط أحمر على الوصل</li>
              <li>يمكن إرجاع الشطب لاحقاً</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label>سبب الشطب (اختياري)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="مثال: خطأ في المبلغ، دفعة مكررة..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setReason(''); }}>إلغاء</Button>
          <Button variant="destructive" onClick={() => { onConfirm(reason); setReason(''); }}>
            <Ban className="w-4 h-4 ml-2" /> شطب الوصل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Stable date formatter — uses Latin digits, DD/MM/YYYY format
const formatDate = (iso: string | Date) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

interface StudentPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentType: string;
  paymentLabel: string | null;
  paymentDate: string;
  paymentMethod: string | null;
  notes: string | null;
  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  student: { id: string; name: string; studentNumber: string | null; department?: { name: string } };
}

interface TeacherPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  month: string;
  paymentType: string;
  paymentLabel: string | null;
  paymentDate: string;
  notes: string | null;
  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  teacher: { id: string; name: string; department?: { name: string } };
}

interface Report {
  month: string | null;
  studentPayments: StudentPayment[];
  teacherPayments: TeacherPayment[];
  expenses: Expense[];
  totalIncome: number;
  totalTeacherExpense: number;
  totalSecondaryExpense: number;
  totalExpense: number;
  balance: number;
  expensesByType: Record<string, number>;
  allTime: { totalIncome: number; totalTeacherExpense: number; totalSecondaryExpense: number; totalExpense: number; balance: number };
  outstanding: { id: string; name: string; studentNumber: string | null; department: string | null; paid: number; fees: number; remaining: number }[];
  teacherTotals: { id: string; name: string; salary: number; paid: number }[];
}

export function FinanceDashboard({ isDirector = false }: { isDirector?: boolean }) {
  // Employees start on student-payments tab; directors on overview
  const [tab, setTab] = useState(isDirector ? 'overview' : 'student-payments');

  // Define which tabs are visible based on role
  const visibleTabs = isDirector
    ? [
        { value: 'overview', label: 'نظرة عامة', icon: BarChart3 },
        { value: 'student-payments', label: 'أقساط الطلاب', icon: Users },
        { value: 'teacher-payments', label: 'رواتب الأساتذة', icon: GraduationCap },
        { value: 'staff-payments', label: 'رواتب الموظفين', icon: UserCog },
        { value: 'expenses', label: 'مصاريف ثانوية', icon: ReceiptIndianRupee },
        { value: 'reports', label: 'التقارير', icon: FileText },
        { value: 'receipts', label: 'الوصولات', icon: Receipt },
      ]
    : [
        { value: 'student-payments', label: 'أقساط الطلاب', icon: Users },
        { value: 'receipts', label: 'وصولات الطلاب', icon: Receipt },
      ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`grid w-full grid-cols-2 ${isDirector ? 'md:grid-cols-7' : ''}`}>
          {visibleTabs.map(t => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value}>
                <Icon className="w-4 h-4 ml-2" /> {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {isDirector && <TabsContent value="overview"><OverviewTab /></TabsContent>}
        <TabsContent value="student-payments"><StudentPaymentsTab isDirector={isDirector} /></TabsContent>
        {isDirector && <TabsContent value="teacher-payments"><TeacherPaymentsTab /></TabsContent>}
        {isDirector && <TabsContent value="staff-payments"><StaffPaymentsTab /></TabsContent>}
        {isDirector && <TabsContent value="expenses"><ExpensesTab /></TabsContent>}
        {isDirector && <TabsContent value="reports"><ReportsTab /></TabsContent>}
        <TabsContent value="receipts"><ReceiptsTab isDirector={isDirector} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    fetch('/api/finance/reports')
      .then(async r => {
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        if (!r.ok) {
          throw new Error(data.error || `خطأ ${r.status}: ${r.statusText}`);
        }
        return data;
      })
      .then(d => {
        if (!isMounted) return;
        // ضمان وجود allTime حتى لو أعاد الـ API استجابة ناقصة
        if (!d.allTime) {
          d.allTime = {
            totalIncome: d.totalIncome || 0,
            totalTeacherExpense: d.totalTeacherExpense || 0,
            totalSecondaryExpense: d.totalSecondaryExpense || 0,
            totalExpense: d.totalExpense || 0,
            balance: d.balance || 0,
          };
        }
        if (!d.outstanding) d.outstanding = [];
        if (!d.teacherTotals) d.teacherTotals = [];
        if (!d.expensesByType) d.expensesByType = {};
        setReport(d);
      })
      .catch(err => {
        if (!isMounted) return;
        const msg = err.message || 'حدث خطأ';
        // إذا كان خطأ مصادقة، اعرض رسالة مناسبة
        if (msg.includes('401') || msg.includes('مصرح') || msg.includes('UNAUTHORIZED')) {
          setError('يجب تسجيل الدخول كمدير للوصول للقسم المالي');
        } else if (msg.includes('403') || msg.includes('FORBIDDEN') || msg.includes('كلمة سر')) {
          setError('القسم المالي متاح للمدير فقط. أدخل كلمة سر القسم المالي');
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setError('تعذر الاتصال بالخادم. تحقق من تشغيل الخادم');
        } else {
          setError(msg);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  if (loading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;
  if (error) return (
    <div className="text-center py-8 space-y-3">
      <p className="text-red-600 font-medium">⚠️ {error}</p>
      <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md mx-auto">
        <p className="font-medium mb-1">إذا استمر الخطأ، تأكد من:</p>
        <ul className="list-disc list-inside space-y-0.5 text-right">
          <li>تشغيل <code className="bg-muted px-1 rounded">npx prisma db push</code></li>
          <li>تشغيل <code className="bg-muted px-1 rounded">npx prisma generate</code></li>
          <li>إعادة تشغيل الخادم <code className="bg-muted px-1 rounded">npm run dev</code></li>
        </ul>
      </div>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>إعادة المحاولة</Button>
    </div>
  );
  if (!report) return <div className="text-center py-8 text-muted-foreground">تعذر التحميل</div>;

  // حماية إضافية: استخدم allTime مع قيم افتراضية
  const allTime = (report.allTime || {}) as any;
  const safeAllTime = {
    totalIncome: allTime.totalIncome || 0,
    totalTeacherExpense: allTime.totalTeacherExpense || 0,
    totalStaffExpense: allTime.totalStaffExpense || 0,
    totalSecondaryExpense: allTime.totalSecondaryExpense || 0,
    totalExpense: allTime.totalExpense || 0,
    balance: allTime.balance || 0,
  };

  return (
    <div className="space-y-4">
      {/* All-time totals */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">إجمالي المداخيل</span>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 num">{currency(safeAllTime.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">رواتب الأساتذة</span>
              <GraduationCap className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700 num">{currency(safeAllTime.totalTeacherExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">رواتب الموظفين</span>
              <UserCog className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700 num">{currency(safeAllTime.totalStaffExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">مصاريف ثانوية</span>
              <ReceiptIndianRupee className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-700 num">{currency(safeAllTime.totalSecondaryExpense)}</p>
          </CardContent>
        </Card>
        <Card className={safeAllTime.balance >= 0 ? 'border-primary bg-primary/5' : 'border-red-200 bg-red-50/50'}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">الرصيد الإجمالي</span>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <p className={`text-2xl font-bold num ${safeAllTime.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
              {currency(safeAllTime.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary expenses summary by type */}
      {report.expensesByType && Object.keys(report.expensesByType).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">توزيع المصاريف الثانوية حسب النوع</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(report.expensesByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, amount]) => {
                  const maxAmt = Math.max(...Object.values(report.expensesByType), 1);
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium">{type}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full"
                          style={{ width: `${(amount / maxAmt) * 100}%` }}
                        />
                      </div>
                      <div className="w-32 text-left num text-sm font-medium text-orange-700">{currency(amount)}</div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding balances */}
      <Card>
        <CardHeader><CardTitle className="text-lg">الطلاب الذين عليهم مبالغ متبقية ({report.outstanding.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto">
            <div style={{ minWidth: '560px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                style={{ gridTemplateColumns: '1fr 120px 120px 120px 120px' }}
              >
                <div className="text-right">الطالب</div>
                <div className="text-center">القسم</div>
                <div className="text-center">المدفوع</div>
                <div className="text-center">الرسوم</div>
                <div className="text-center">المتبقي</div>
              </div>
              {/* Body */}
              {report.outstanding.length === 0 ? (
                <div className="text-center py-4 text-emerald-600">لا يوجد طلاب عليهم مبالغ</div>
              ) : report.outstanding.map(s => (
                <div
                  key={s.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '1fr 120px 120px 120px 120px' }}
                >
                  <div className="text-right font-medium">{s.name}</div>
                  <div className="text-center text-sm">{s.department || '-'}</div>
                  <div className="text-center num text-emerald-600">{currency(s.paid)}</div>
                  <div className="text-center num">{currency(s.fees)}</div>
                  <div className="text-center num font-bold text-red-600">{currency(s.remaining)}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher payment totals */}
      <Card>
        <CardHeader><CardTitle className="text-lg">رواتب الأساتذة - ملخص</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div style={{ minWidth: '480px' }}>
            {/* Header */}
            <div
              className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
              style={{ gridTemplateColumns: '1fr 160px 160px' }}
            >
              <div className="text-right">الأستاذ</div>
              <div className="text-center">الراتب الشهري</div>
              <div className="text-center">المدفوع الكلي</div>
            </div>
            {/* Body */}
            {report.teacherTotals.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">لا توجد بيانات</div>
            ) : report.teacherTotals.map(t => (
              <div
                key={t.id}
                className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                style={{ gridTemplateColumns: '1fr 160px 160px' }}
              >
                <div className="text-right font-medium">{t.name}</div>
                <div className="text-center num">{currency(t.salary)}</div>
                <div className="text-center num text-emerald-600">{currency(t.paid)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentPaymentsTab({ isDirector = false }: { isDirector?: boolean }) {
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStudent, setFilterStudent] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ type: 'student'; id: string; label: string } | null>(null);
  const [formData, setFormData] = useState<any>({
    studentId: '', amount: '', paymentType: 'installment', paymentLabel: 'قسط',
    paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'cash', notes: '',
  });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterStudent !== 'all') params.set('studentId', filterStudent);
    const res = await fetch(`/api/finance/student-payments?${params.toString()}`);
    const data = await res.json();
    setPayments(data.payments || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/students').then(r => r.json()).then(d => setStudents(d.students || []));
  }, []);
  useEffect(() => { load(); }, [search, filterStudent]);

  const handleSave = async () => {
    if (!formData.studentId || !formData.amount) {
      toast({ title: 'تنبيه', description: 'يرجى اختيار الطالب وإدخال المبلغ', variant: 'destructive' });
      return;
    }
    const res = await fetch('/api/finance/student-payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم تسجيل الدفعة' });
      setDialogOpen(false);
      setFormData({ ...formData, studentId: '', amount: '', notes: '' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذه الدفعة؟')) return;
    const res = await fetch(`/api/finance/student-payments/${id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  const handlePrint = (id: string) => {
    window.open(`/api/receipt-print/${id}?type=student`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">إجمالي: <span className="num font-bold text-emerald-700">{currency(total)}</span></p>
        </div>
        <div className="flex gap-2">
          {isDirector && (
            <Button variant="outline" size="sm" onClick={() => window.open('/api/export/student-payments', '_blank')}>
              <Download className="w-4 h-4 ml-2" /> تصدير
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-2" /> دفعة جديدة</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث برقم الوصل أو اسم الطالب..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger><SelectValue placeholder="كل الطلاب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الطلاب</SelectItem>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '880px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '40px 130px 110px 1fr 130px 110px 120px 110px' }}
              >
                <div className="text-center">#</div>
                <div className="text-right">رقم الوصل</div>
                <div className="text-right">التاريخ</div>
                <div className="text-right">الطالب</div>
                <div className="text-right">القسم</div>
                <div className="text-center">النوع</div>
                <div className="text-center">المبلغ</div>
                <div className="text-center">إجراءات</div>
              </div>

              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد دفعات</div>
              ) : payments.map((p, i) => (
                <div
                  key={p.id}
                  className={`grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm ${p.isCancelled ? 'opacity-60' : ''}`}
                  style={{ gridTemplateColumns: '40px 130px 110px 1fr 130px 110px 120px 110px', textDecoration: p.isCancelled ? 'line-through red' : 'none', textDecorationColor: p.isCancelled ? 'red' : undefined, textDecorationThickness: p.isCancelled ? '2px' : undefined }}
                >
                  <div className="text-center num text-muted-foreground">{i + 1}</div>
                  <div className="text-right font-mono text-xs num">{p.receiptNumber}{p.isCancelled && <span className="text-red-600 text-[10px] block">مشطوب</span>}</div>
                  <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                  <div className="text-right font-medium">{p.student.name}</div>
                  <div className="text-right text-sm">{p.student.department?.name || '-'}</div>
                  <div className="text-center"><Badge variant="outline">{p.paymentLabel}</Badge></div>
                  <div className="text-center num font-bold text-emerald-700">{currency(p.amount)}</div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handlePrint(p.id)} title="طباعة الوصل">
                        <Printer className="w-4 h-4 text-blue-600" />
                      </Button>
                      {isDirector && !p.isCancelled && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ type: 'student', id: p.id, label: p.receiptNumber })} title="شطب">
                          <Ban className="w-4 h-4 text-orange-600" />
                        </Button>
                      )}
                      {isDirector && p.isCancelled && (
                        <Button size="sm" variant="ghost" onClick={async () => { await toggleCancelReceipt('student', p.id, 'uncancel'); toast({ title: 'تم', description: 'تم إرجاع الشطب' }); load(); }} title="إرجاع الشطب">
                          <RotateCcw className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      {isDirector && (
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} title="حذف">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>تسجيل دفعة جديدة</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>الطالب *</Label>
              <Select value={formData.studentId} onValueChange={(v) => setFormData({ ...formData, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.studentNumber ? `(${s.studentNumber})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (دج) *</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الدفع</Label>
              <Input type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>نوع الدفعة</Label>
              <Select value={formData.paymentLabel} onValueChange={(v) => {
                const typeMap: Record<string, string> = { 'تسجيل': 'registration', 'قسط أول': 'installment', 'قسط ثاني': 'installment', 'قسط ثالث': 'installment', 'دفع كامل': 'full' };
                setFormData({ ...formData, paymentLabel: v, paymentType: typeMap[v] || 'installment' });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="تسجيل">تسجيل</SelectItem>
                  <SelectItem value="قسط أول">قسط أول</SelectItem>
                  <SelectItem value="قسط ثاني">قسط ثاني</SelectItem>
                  <SelectItem value="قسط ثالث">قسط ثالث</SelectItem>
                  <SelectItem value="دفع كامل">دفع كامل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدا</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="cheque">شيك</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>تسجيل الدفعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel receipt dialog */}
      <CancelReceiptDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        receiptLabel={cancelTarget?.label || ''}
        onConfirm={async (reason) => {
          if (!cancelTarget) return;
          try {
            await toggleCancelReceipt(cancelTarget.type, cancelTarget.id, 'cancel', reason);
            toast({ title: 'تم', description: 'تم شطب الوصل' });
            setCancelTarget(null);
            load();
          } catch (e: any) {
            toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}

function TeacherPaymentsTab() {
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherPayment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ type: 'teacher'; id: string; label: string } | null>(null);
  const [formData, setFormData] = useState<any>({
    teacherId: '', amount: '', month: '', paymentDate: new Date().toISOString().split('T')[0],
    paymentType: 'salary', paymentLabel: 'راتب', notes: '',
  });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterTeacher !== 'all') params.set('teacherId', filterTeacher);
    if (filterMonth) params.set('month', filterMonth);
    const res = await fetch(`/api/finance/teacher-payments?${params.toString()}`);
    const data = await res.json();
    setPayments(data.payments || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
  }, []);
  useEffect(() => { load(); }, [search, filterTeacher, filterMonth]);

  const handleSave = async () => {
    if (!formData.teacherId || !formData.amount || !formData.month) {
      toast({ title: 'تنبيه', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/finance/teacher-payments/${editing.id}` : '/api/finance/teacher-payments';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (res.ok) {
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تم تسجيل الدفعة' });
      setDialogOpen(false);
      setEditing(null);
      setFormData({ ...formData, teacherId: '', amount: '', month: '', notes: '' });
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleEdit = (p: TeacherPayment) => {
    setEditing(p);
    setFormData({
      teacherId: p.teacher.id,
      amount: String(p.amount),
      month: p.month,
      paymentDate: p.paymentDate.split('T')[0],
      paymentType: p.paymentType,
      paymentLabel: p.paymentLabel || 'راتب',
      notes: p.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذه الدفعة؟')) return;
    const res = await fetch(`/api/finance/teacher-payments/${id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
    else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'خطأ', description: data.error || 'فشل الحذف', variant: 'destructive' });
    }
  };

  const handlePrint = (id: string) => {
    window.open(`/api/receipt-print/${id}?type=teacher`, '_blank');
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({
      teacherId: '', amount: '', month: '', paymentDate: new Date().toISOString().split('T')[0],
      paymentType: 'salary', paymentLabel: 'راتب', notes: '',
    });
    setDialogOpen(true);
  };

  const handleUncancel = async (id: string) => {
    try {
      await toggleCancelReceipt('teacher', id, 'uncancel');
      toast({ title: 'تم', description: 'تم إرجاع الشطب' });
      load();
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">إجمالي: <span className="num font-bold text-red-700">{currency(total)}</span></p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/teacher-payments', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> دفعة جديدة</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger><SelectValue placeholder="كل الأساتذة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأساتذة</SelectItem>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '880px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '40px 130px 110px 1fr 110px 110px 120px 140px' }}
              >
                <div className="text-center">#</div>
                <div className="text-right">رقم الوصل</div>
                <div className="text-right">التاريخ</div>
                <div className="text-right">الأستاذ</div>
                <div className="text-center">الشهر</div>
                <div className="text-center">النوع</div>
                <div className="text-center">المبلغ</div>
                <div className="text-center">إجراءات</div>
              </div>

              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد دفعات</div>
              ) : payments.map((p, i) => (
                <div
                  key={p.id}
                  className={`grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm ${p.isCancelled ? 'opacity-60' : ''}`}
                  style={{ gridTemplateColumns: '40px 130px 110px 1fr 110px 110px 120px 140px', textDecoration: p.isCancelled ? 'line-through red' : 'none', textDecorationColor: p.isCancelled ? 'red' : undefined, textDecorationThickness: p.isCancelled ? '2px' : undefined }}
                >
                  <div className="text-center num text-muted-foreground">{i + 1}</div>
                  <div className="text-right font-mono text-xs num">{p.receiptNumber}{p.isCancelled && <span className="text-red-600 text-[10px] block">مشطوب</span>}</div>
                  <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                  <div className="text-right font-medium">{p.teacher.name}</div>
                  <div className="text-center num">{p.month}</div>
                  <div className="text-center"><Badge variant="outline">{p.paymentLabel}</Badge></div>
                  <div className="text-center num font-bold text-red-700">{currency(p.amount)}</div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handlePrint(p.id)} title="طباعة الوصل">
                        <Printer className="w-4 h-4 text-blue-600" />
                      </Button>
                      {!p.isCancelled && (
                        <Button size="sm" variant="ghost" onClick={() => setCancelTarget({ type: 'teacher', id: p.id, label: p.receiptNumber })} title="شطب">
                          <Ban className="w-4 h-4 text-orange-600" />
                        </Button>
                      )}
                      {p.isCancelled && (
                        <Button size="sm" variant="ghost" onClick={() => handleUncancel(p.id)} title="إرجاع الشطب">
                          <RotateCcw className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(p)} title="تعديل">
                        <Edit className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} title="حذف">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'تعديل دفعة' : 'تسجيل دفعة لأستاذ'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>الأستاذ *</Label>
              <Select value={formData.teacherId} onValueChange={(v) => {
                const t = teachers.find(t => t.id === v);
                setFormData({ ...formData, teacherId: v, amount: t ? String(t.salary) : formData.amount });
              }}>
                <SelectTrigger><SelectValue placeholder="اختر الأستاذ" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name} (راتب: {t.salary} دج)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (دج) *</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الشهر *</Label>
              <Input type="month" value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الدفع</Label>
              <Input type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>نوع الدفعة</Label>
              <Select value={formData.paymentLabel} onValueChange={(v) => {
                const typeMap: Record<string, string> = { 'راتب': 'salary', 'منحة': 'bonus', 'سلفة': 'advance' };
                setFormData({ ...formData, paymentLabel: v, paymentType: typeMap[v] || 'salary' });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="راتب">راتب</SelectItem>
                  <SelectItem value="منحة">منحة</SelectItem>
                  <SelectItem value="سلفة">سلفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); }}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ التعديل' : 'تسجيل الدفعة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تأكيد الشطب */}
      <CancelReceiptDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        receiptLabel={cancelTarget?.label || ''}
        onConfirm={async (reason) => {
          if (!cancelTarget) return;
          try {
            await toggleCancelReceipt(cancelTarget.type, cancelTarget.id, 'cancel', reason);
            toast({ title: 'تم', description: 'تم شطب الوصل' });
            setCancelTarget(null);
            load();
          } catch (e: any) {
            toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
          }
        }}
      />
    </div>
  );
}

function ReportsTab() {
  const [month, setMonth] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [specializationId, setSpecializationId] = useState('all');
  const [groupBy, setGroupBy] = useState('none');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/specializations').then(r => r.json()).then(d => setSpecializations(d.specializations || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (departmentId !== 'all') params.set('departmentId', departmentId);
    if (specializationId !== 'all') params.set('specializationId', specializationId);
    if (groupBy !== 'none') params.set('groupBy', groupBy);
    const res = await fetch(`/api/finance/reports?${params.toString()}`);
    const data = await res.json();
    setReport(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, departmentId, specializationId, groupBy]);

  const availableSpecializations = departmentId !== 'all'
    ? specializations.filter((s: any) => s.departmentId === departmentId)
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">الشهر</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">القسم</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setSpecializationId('all'); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">التخصص</Label>
              <Select value={specializationId} onValueChange={setSpecializationId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التخصصات</SelectItem>
                  {availableSpecializations.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تجميع حسب</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تجميع</SelectItem>
                  <SelectItem value="department">حسب القسم</SelectItem>
                  <SelectItem value="specialization">حسب التخصص</SelectItem>
                  <SelectItem value="student">حسب الطالب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setMonth(''); setDepartmentId('all'); setSpecializationId('all'); setGroupBy('none'); }} className="w-full">
                إعادة تعيين
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grouped results */}
      {report?.grouped && report.grouped.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">
            {groupBy === 'department' && 'المداخيل حسب القسم'}
            {groupBy === 'specialization' && 'المداخيل حسب التخصص'}
            {groupBy === 'student' && 'المداخيل حسب الطالب'}
          </CardTitle></CardHeader>
          <CardContent className="p-0">
            <div style={{ minWidth: '560px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns:
                  groupBy === 'specialization' ? '1fr 1fr 100px 140px'
                  : groupBy === 'student' ? '1fr 100px 100px 140px'
                  : '1fr 100px 140px' }}
              >
                <div className="text-right">{groupBy === 'department' ? 'القسم' : groupBy === 'specialization' ? 'التخصص' : 'الطالب'}</div>
                {groupBy === 'specialization' && <div className="text-right">القسم</div>}
                <div className="text-center">عدد الطلاب</div>
                {groupBy === 'student' && <div className="text-center">عدد الدفعات</div>}
                <div className="text-center">إجمالي المداخيل</div>
              </div>
              {/* Body */}
              {report.grouped.map((g: any, i: number) => (
                <div
                  key={i}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns:
                    groupBy === 'specialization' ? '1fr 1fr 100px 140px'
                    : groupBy === 'student' ? '1fr 100px 100px 140px'
                    : '1fr 100px 140px' }}
                >
                  <div className="text-right font-medium">{g.name}</div>
                  {groupBy === 'specialization' && <div className="text-right text-sm">{g.department}</div>}
                  <div className="text-center num">{g.studentsCount}</div>
                  {groupBy === 'student' && <div className="text-center num">{g.payments}</div>}
                  <div className="text-center num font-bold text-emerald-700">{currency(g.income)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">المداخيل {month && `(${month})`}</span>
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-emerald-700 num">{currency(report.totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">رواتب الأساتذة {month && `(${month})`}</span>
                  <GraduationCap className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-700 num">{currency(report.totalTeacherExpense)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">مصاريف ثانوية {month && `(${month})`}</span>
                  <ReceiptIndianRupee className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-orange-700 num">{currency(report.totalSecondaryExpense)}</p>
              </CardContent>
            </Card>
            <Card className={report.balance >= 0 ? 'border-primary bg-primary/5' : 'border-red-200 bg-red-50/50'}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">الرصيد {month && `(${month})`}</span>
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <p className={`text-2xl font-bold num ${report.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
                  {currency(report.balance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">تفاصيل مداخيل الطلاب ({report.studentPayments.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <div style={{ minWidth: '560px' }}>
                  {/* Header */}
                  <div
                    className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                    style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px' }}
                  >
                    <div className="text-right">رقم الوصل</div>
                    <div className="text-right">التاريخ</div>
                    <div className="text-right">الطالب</div>
                    <div className="text-center">النوع</div>
                    <div className="text-center">المبلغ</div>
                  </div>
                  {/* Body */}
                  {report.studentPayments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">لا توجد مداخيل</div>
                  ) : report.studentPayments.map(p => (
                    <div
                      key={p.id}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px' }}
                    >
                      <div className="text-right font-mono text-xs num">{p.receiptNumber}</div>
                      <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                      <div className="text-right font-medium">{p.student.name}</div>
                      <div className="text-center"><Badge variant="outline">{p.paymentLabel}</Badge></div>
                      <div className="text-center num text-emerald-700">{currency(p.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">تفاصيل مصاريف الأساتذة ({report.teacherPayments.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <div style={{ minWidth: '560px' }}>
                  {/* Header */}
                  <div
                    className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                    style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px' }}
                  >
                    <div className="text-right">رقم الوصل</div>
                    <div className="text-right">التاريخ</div>
                    <div className="text-right">الأستاذ</div>
                    <div className="text-center">الشهر</div>
                    <div className="text-center">المبلغ</div>
                  </div>
                  {/* Body */}
                  {report.teacherPayments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">لا توجد مصاريف</div>
                  ) : report.teacherPayments.map(p => (
                    <div
                      key={p.id}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px' }}
                    >
                      <div className="text-right font-mono text-xs num">{p.receiptNumber}</div>
                      <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                      <div className="text-right font-medium">{p.teacher.name}</div>
                      <div className="text-center num">{p.month}</div>
                      <div className="text-center num text-red-700">{currency(p.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">تفاصيل المصاريف الثانوية ({report.expenses?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <div style={{ minWidth: '560px' }}>
                  {/* Header */}
                  <div
                    className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                    style={{ gridTemplateColumns: '110px 110px 1fr 120px' }}
                  >
                    <div className="text-right">التاريخ</div>
                    <div className="text-center">النوع</div>
                    <div className="text-right">الوصف</div>
                    <div className="text-center">المبلغ</div>
                  </div>
                  {/* Body */}
                  {!report.expenses || report.expenses.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">لا توجد مصاريف ثانوية</div>
                  ) : report.expenses.map(e => (
                    <div
                      key={e.id}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '110px 110px 1fr 120px' }}
                    >
                      <div className="text-right num text-sm">{formatDate(e.date)}</div>
                      <div className="text-center"><Badge variant="outline">{e.type}</Badge></div>
                      <div className="text-right text-sm">{e.description || '-'}</div>
                      <div className="text-center num text-orange-700">{currency(e.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function ReceiptsTab({ isDirector = false }: { isDirector?: boolean }) {
  const [allPayments, setAllPayments] = useState<StudentPayment[]>([]);
  const [recentTeacherPayments, setRecentTeacherPayments] = useState<TeacherPayment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetches = [fetch('/api/finance/student-payments').then(r => r.json())];
    if (isDirector) {
      fetches.push(fetch('/api/finance/teacher-payments').then(r => r.json()));
    }
    fetch('/api/students').then(r => r.json()).then(d => setStudents(d.students || []));
    Promise.all(fetches).then((results: any[]) => {
      setAllPayments(results[0]?.payments || []);
      if (isDirector && results[1]) {
        setRecentTeacherPayments(results[1].payments?.slice(0, 20) || []);
      }
    }).finally(() => setLoading(false));
  }, [isDirector]);

  // Filter payments
  const filteredPayments = allPayments.filter(p => {
    if (filterStudent !== 'all' && p.studentId !== filterStudent) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.receiptNumber.toLowerCase().includes(q) &&
        !p.student?.name.toLowerCase().includes(q) &&
        !(p.student?.studentNumber || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Group by student for batch printing
  const selectedStudent = filterStudent !== 'all'
    ? students.find(s => s.id === filterStudent)
    : null;
  const selectedStudentPayments = selectedStudent
    ? filteredPayments
    : [];

  return (
    <div className="space-y-4">
      {/* Student receipts with filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between flex-wrap gap-2">
            <span>وصولات الطلاب - للطباعة</span>
            {selectedStudent && selectedStudentPayments.length > 0 && (
              <Button
                size="sm"
                onClick={() => window.open(`/receipts-batch?studentId=${selectedStudent.id}`, '_blank')}
                className="bg-primary"
              >
                <Printer className="w-4 h-4 ml-1" /> طباعة كل وصولات {selectedStudent.name} ({selectedStudentPayments.length})
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الوصل أو اسم الطالب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger><SelectValue placeholder="كل الطلاب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الطلاب</SelectItem>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.studentNumber ? `(${s.studentNumber})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary for filtered student */}
          {selectedStudent && selectedStudentPayments.length > 0 && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedStudent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStudentPayments.length} وصل | إجمالي: {currency(selectedStudentPayments.reduce((s, p) => s + p.amount, 0))}
                </p>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => window.open(`/receipts-batch?studentId=${selectedStudent.id}`, '_blank')}
              >
                <Printer className="w-4 h-4 ml-1" /> طباعة الكل
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <div style={{ minWidth: '720px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px 100px' }}
              >
                <div className="text-right">رقم الوصل</div>
                <div className="text-right">التاريخ</div>
                <div className="text-right">الطالب</div>
                <div className="text-center">النوع</div>
                <div className="text-center">المبلغ</div>
                <div className="text-center">طباعة</div>
              </div>
              {/* Body */}
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">لا توجد وصولات</div>
              ) : filteredPayments.map(p => (
                <div
                  key={p.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px 100px' }}
                >
                  <div className="text-right font-mono text-xs num">{p.receiptNumber}</div>
                  <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                  <div className="text-right font-medium">{p.student?.name || '-'}</div>
                  <div className="text-center"><Badge variant="outline">{p.paymentLabel}</Badge></div>
                  <div className="text-center num font-bold text-emerald-700">{currency(p.amount)}</div>
                  <div className="text-center">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/receipt-print/${p.id}?type=student`, '_blank')}>
                      <Printer className="w-4 h-4 ml-1" /> طباعة
                    </Button>
                  </div>
                </div>
              ))}
              {/* Footer totals */}
              {filteredPayments.length > 0 && (
                <div
                  className="grid items-center gap-2 px-3 py-3 border-t-2 bg-muted/30 font-medium text-sm"
                  style={{ gridTemplateColumns: '130px 110px 1fr 110px 120px 100px' }}
                >
                  <div style={{ gridColumn: '1 / span 4' }} className="text-left">
                    الإجمالي ({filteredPayments.length} وصل):
                  </div>
                  <div className="text-center num font-bold text-emerald-700">{currency(filteredPayments.reduce((s, p) => s + p.amount, 0))}</div>
                  <div></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isDirector && (
      <Card>
        <CardHeader><CardTitle className="text-lg">وصولات الأساتذة - للطباعة</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <div style={{ minWidth: '640px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                style={{ gridTemplateColumns: '130px 110px 1fr 120px 100px' }}
              >
                <div className="text-right">رقم الوصل</div>
                <div className="text-right">التاريخ</div>
                <div className="text-right">الأستاذ</div>
                <div className="text-center">المبلغ</div>
                <div className="text-center">طباعة</div>
              </div>
              {/* Body */}
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">جاري التحميل...</div>
              ) : recentTeacherPayments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">لا توجد وصولات</div>
              ) : recentTeacherPayments.map(p => (
                <div
                  key={p.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '130px 110px 1fr 120px 100px' }}
                >
                  <div className="text-right font-mono text-xs num">{p.receiptNumber}</div>
                  <div className="text-right num text-sm">{formatDate(p.paymentDate)}</div>
                  <div className="text-right font-medium">{p.teacher.name}</div>
                  <div className="text-center num font-bold text-red-700">{currency(p.amount)}</div>
                  <div className="text-center">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/api/receipt-print/${p.id}?type=teacher`, '_blank')}>
                      <Printer className="w-4 h-4 ml-1" /> طباعة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

// ===== Expenses Tab - المصاريف الثانوية =====
interface Expense {
  id: string;
  date: string;
  type: string;
  description: string | null;
  amount: number;
}

const EXPENSE_TYPES = [
  'إيجار', 'كهرباء', 'ماء', 'قرطاسية', 'صيانة', 'إنترنت', 'نقل', 'ضيافة', 'هاتف', 'وقود', 'أخرى',
];

const emptyExpense = {
  date: new Date().toISOString().split('T')[0],
  type: 'إيجار',
  description: '',
  amount: '',
};

// ===== Staff Payments Tab (رواتب الموظفين) =====
interface StaffPayment {
  id: string;
  receiptNumber: string;
  userId: string;
  userName: string;
  amount: number;
  month: string;
  paymentDate: string;
  paymentType: string;
  paymentLabel: string | null;
  notes: string | null;
  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
}
interface StaffMember { id: string; name: string; role: string; }
const emptyStaffPayment = {
  userId: '', amount: '',
  month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  paymentDate: new Date().toISOString().split('T')[0],
  paymentType: 'salary', paymentLabel: '', notes: '',
};
function StaffPaymentsTab() {
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffPayment | null>(null);
  const [formData, setFormData] = useState<any>(emptyStaffPayment);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterUserId, setFilterUserId] = useState('all');
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterMonth) params.set('month', filterMonth);
    if (filterUserId !== 'all') params.set('userId', filterUserId);
    try {
      const res = await fetch(`/api/finance/staff-payments?${params.toString()}`);
      const data = await res.json();
      setPayments(data.payments || []);
    } catch { toast({ title: 'خطأ', description: 'تعذر تحميل البيانات', variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch('/api/users/staff-names').then(r => r.json()).then(d => setStaff(d.staff || [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [filterMonth, filterUserId]);
  const handleOpenAdd = () => { setEditing(null); setFormData({ ...emptyStaffPayment, paymentDate: new Date().toISOString().split('T')[0] }); setDialogOpen(true); };
  const handleOpenEdit = (p: StaffPayment) => {
    setEditing(p);
    setFormData({ userId: p.userId, amount: String(p.amount), month: p.month, paymentDate: p.paymentDate.split('T')[0], paymentType: p.paymentType, paymentLabel: p.paymentLabel || '', notes: p.notes || '' });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!formData.userId || !formData.amount || !formData.paymentDate) { toast({ title: 'تنبيه', description: 'الموظف والمبلغ وتاريخ الدفع مطلوبون', variant: 'destructive' }); return; }
    const url = editing ? `/api/finance/staff-payments/${editing.id}` : '/api/finance/staff-payments';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    const data = await res.json();
    if (!res.ok) { toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' }); return; }
    toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
    setDialogOpen(false); load();
  };
  const handleDelete = async (p: StaffPayment) => {
    if (!confirm(`حذف سجل راتب ${p.userName}؟`)) return;
    const res = await fetch(`/api/finance/staff-payments/${p.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };
  const fmtCurrency = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + ' دج';
  const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const paymentTypeLabels: Record<string, string> = { salary: 'راتب', bonus: 'منحة', advance: 'سلفة' };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">رواتب الموظفين</h3>
          <p className="text-sm text-muted-foreground">{payments.length} سجل • الإجمالي: <span className="num font-medium text-primary">{fmtCurrency(totalAmount)}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} dir="ltr" className="w-36" />
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الموظفين</SelectItem>
              {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> دفع راتب</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div style={{ minWidth: '700px' }} className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <div className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0 z-10" style={{ gridTemplateColumns: '40px 1fr 100px 100px 120px 100px 80px' }}>
              <div className="text-center">#</div><div className="text-center">الموظف</div><div className="text-center">المبلغ</div><div className="text-center">النوع</div><div className="text-center">الشهر</div><div className="text-center">التاريخ</div><div className="text-center">إجراءات</div>
            </div>
            {loading ? (<div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : payments.length === 0 ? (<div className="text-center py-8 text-muted-foreground">لا توجد سجلات</div>
            ) : payments.map((p, i) => (
              <div key={p.id} className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm" style={{ gridTemplateColumns: '40px 1fr 100px 100px 120px 100px 80px' }}>
                <div className="text-center num text-muted-foreground">{i + 1}</div>
                <div className="text-right font-medium">{p.userName}</div>
                <div className="text-center num font-bold text-emerald-700">{fmtCurrency(p.amount)}</div>
                <div className="text-center">{paymentTypeLabels[p.paymentType] || p.paymentType}</div>
                <div className="text-center num text-xs">{p.month}</div>
                <div className="text-center num text-xs">{fmtDate(p.paymentDate)}</div>
                <div className="text-center">
                  <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(p)} className="h-7 w-7 p-0"><Edit className="w-3.5 h-3.5 text-amber-600" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} className="h-7 w-7 p-0"><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                </div>
              </div>
            ))}
            {payments.length > 0 && (
              <div className="grid items-center gap-2 px-3 py-3 border-t-2 bg-muted/30 font-medium text-sm" style={{ gridTemplateColumns: '40px 1fr 100px 100px 120px 100px 80px' }}>
                <div className="text-center" style={{ gridColumn: '1 / span 2' }}>الإجمالي ({payments.length}):</div>
                <div className="text-center num font-bold text-emerald-700">{fmtCurrency(totalAmount)}</div>
                <div colSpan={4}></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'تعديل راتب' : 'دفع راتب موظف'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>الموظف *</Label>
              <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.role === 'director' ? 'مدير' : 'موظف'})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>المبلغ (دج) *</Label><Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>الشهر</Label><Input type="month" value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>تاريخ الدفع *</Label><Input type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} dir="ltr" /></div>
            <div className="space-y-2"><Label>النوع</Label>
              <Select value={formData.paymentType} onValueChange={(v) => setFormData({ ...formData, paymentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">راتب</SelectItem>
                  <SelectItem value="bonus">منحة</SelectItem>
                  <SelectItem value="advance">سلفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label>ملاحظات</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} /></div>
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

function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [byType, setByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<any>(emptyExpense);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterType !== 'all') params.set('type', filterType);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await fetch(`/api/finance/expenses?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      setByType(data.byType || {});
    } else if (res.status === 403) {
      // Finance access expired
      toast({ title: 'انتهت الجلسة', description: 'يرجى إعادة إدخال كلمة سر القسم المالي', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterType, startDate, endDate]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(emptyExpense);
    setDialogOpen(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditing(e);
    setFormData({
      date: e.date.split('T')[0],
      type: e.type,
      description: e.description || '',
      amount: String(e.amount),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.type || !formData.amount || !formData.date) {
      toast({ title: 'تنبيه', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/finance/expenses/${editing.id}` : '/api/finance/expenses';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
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

  const handleDelete = async (e: Expense) => {
    if (!confirm('حذف هذا المصروف؟')) return;
    const res = await fetch(`/api/finance/expenses/${e.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    }
  };

  const sortedByType = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const maxTypeAmount = sortedByType.length > 0 ? sortedByType[0][1] : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          إجمالي المصاريف الثانوية: <span className="num font-bold text-red-700">{currency(total)}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/expenses', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> مصروف جديد</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" placeholder="من تاريخ" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" placeholder="إلى تاريخ" />
          </div>
        </CardContent>
      </Card>

      {/* Summary by type */}
      {sortedByType.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">توزيع المصاريف حسب النوع</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedByType.map(([type, amount]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">{type}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${(amount / maxTypeAmount) * 100}%` }}
                    />
                  </div>
                  <div className="w-32 text-left num text-sm font-medium text-red-700">{currency(amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '720px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '40px 110px 110px 1fr 120px 110px' }}
              >
                <div className="text-center">#</div>
                <div className="text-right">التاريخ</div>
                <div className="text-center">النوع</div>
                <div className="text-right">الوصف</div>
                <div className="text-center">المبلغ</div>
                <div className="text-center">إجراءات</div>
              </div>
              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد مصاريف</div>
              ) : expenses.map((e, i) => (
                <div
                  key={e.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '40px 110px 110px 1fr 120px 110px' }}
                >
                  <div className="text-center num text-muted-foreground">{i + 1}</div>
                  <div className="text-right num text-sm">{formatDate(e.date)}</div>
                  <div className="text-center"><Badge variant="outline">{e.type}</Badge></div>
                  <div className="text-right text-sm">{e.description || '-'}</div>
                  <div className="text-center num font-bold text-red-700">{currency(e.amount)}</div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(e)}>
                        <Edit className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(e)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {/* Footer totals */}
              {expenses.length > 0 && (
                <div
                  className="grid items-center gap-2 px-3 py-3 border-t-2 bg-muted/30 font-medium text-sm"
                  style={{ gridTemplateColumns: '40px 110px 110px 1fr 120px 110px' }}
                >
                  <div style={{ gridColumn: '1 / span 4' }} className="text-left">
                    الإجمالي ({expenses.length} مصروف):
                  </div>
                  <div className="text-center num font-bold text-red-700">{currency(total)}</div>
                  <div></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل مصروف' : 'إضافة مصروف ثانوي'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ *</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>نوع المصروف *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (دج) *</Label>
              <Input type="number" min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الوصف / ملاحظات</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="مثال: فاتورة الكهرباء لشهر فيفري" />
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
