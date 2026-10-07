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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Trash2, Download, Printer, Wallet, TrendingUp, TrendingDown,
  Users, GraduationCap, BarChart3, FileText, Receipt, ReceiptIndianRupee, Edit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

interface StudentPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentType: string;
  paymentLabel: string | null;
  paymentDate: string;
  paymentMethod: string | null;
  notes: string | null;
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
        { value: 'expenses', label: 'مصاريف ثانوية', icon: ReceiptIndianRupee },
        { value: 'reports', label: 'التقارير', icon: FileText },
        { value: 'receipts', label: 'الوصولات', icon: Receipt },
      ]
    : [
        // Employees only see student payments + student receipts
        { value: 'student-payments', label: 'أقساط الطلاب', icon: Users },
        { value: 'receipts', label: 'وصولات الطلاب', icon: Receipt },
      ];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`grid w-full grid-cols-2 ${isDirector ? 'md:grid-cols-6' : ''}`}>
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

  useEffect(() => {
    fetch('/api/finance/reports').then(r => r.json()).then(d => setReport(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;
  if (!report) return <div className="text-center py-8 text-muted-foreground">تعذر التحميل</div>;

  return (
    <div className="space-y-4">
      {/* All-time totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">إجمالي المداخيل</span>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 num">{currency(report.allTime.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">رواتب الأساتذة</span>
              <GraduationCap className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700 num">{currency(report.allTime.totalTeacherExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">مصاريف ثانوية</span>
              <ReceiptIndianRupee className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-700 num">{currency(report.allTime.totalSecondaryExpense)}</p>
          </CardContent>
        </Card>
        <Card className={report.allTime.balance >= 0 ? 'border-primary bg-primary/5' : 'border-red-200 bg-red-50/50'}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">الرصيد الإجمالي</span>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <p className={`text-2xl font-bold num ${report.allTime.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
              {currency(report.allTime.balance)}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>الرسوم</TableHead>
                  <TableHead>المتبقي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outstanding.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-emerald-600">لا يوجد طلاب عليهم مبالغ</TableCell></TableRow>
                ) : report.outstanding.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.department || '-'}</TableCell>
                    <TableCell className="num text-emerald-600">{currency(s.paid)}</TableCell>
                    <TableCell className="num">{currency(s.fees)}</TableCell>
                    <TableCell className="num font-bold text-red-600">{currency(s.remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Teacher payment totals */}
      <Card>
        <CardHeader><CardTitle className="text-lg">رواتب الأساتذة - ملخص</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الأستاذ</TableHead>
                <TableHead>الراتب الشهري</TableHead>
                <TableHead>المدفوع الكلي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.teacherTotals.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="num">{currency(t.salary)}</TableCell>
                  <TableCell className="num text-emerald-600">{currency(t.paid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    window.open(`/api/finance/receipt/${id}?type=student`, '_blank');
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>رقم الوصل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد دفعات</TableCell></TableRow>
                ) : payments.map((p, i) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                    <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{p.student.name}</TableCell>
                    <TableCell className="text-sm">{p.student.department?.name || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{p.paymentLabel}</Badge></TableCell>
                    <TableCell className="num font-bold text-emerald-700">{currency(p.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handlePrint(p.id)} title="طباعة الوصل">
                          <Printer className="w-4 h-4 text-blue-600" />
                        </Button>
                        {isDirector && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} title="حذف">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
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
    const res = await fetch('/api/finance/teacher-payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم تسجيل الدفعة' });
      setDialogOpen(false);
      setFormData({ ...formData, teacherId: '', amount: '', month: '', notes: '' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذه الدفعة؟')) return;
    const res = await fetch(`/api/finance/teacher-payments/${id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  const handlePrint = (id: string) => {
    window.open(`/api/finance/receipt/${id}?type=teacher`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">إجمالي: <span className="num font-bold text-red-700">{currency(total)}</span></p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/teacher-payments', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 ml-2" /> دفعة جديدة</Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>رقم الوصل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الأستاذ</TableHead>
                  <TableHead>الشهر</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : payments.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد دفعات</TableCell></TableRow>
                ) : payments.map((p, i) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                    <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{p.teacher.name}</TableCell>
                    <TableCell className="num">{p.month}</TableCell>
                    <TableCell><Badge variant="outline">{p.paymentLabel}</Badge></TableCell>
                    <TableCell className="num font-bold text-red-700">{currency(p.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handlePrint(p.id)}>
                          <Printer className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>تسجيل دفعة لأستاذ</DialogTitle></DialogHeader>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>تسجيل الدفعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === 'department' ? 'القسم' : groupBy === 'specialization' ? 'التخصص' : 'الطالب'}</TableHead>
                  {groupBy === 'specialization' && <TableHead>القسم</TableHead>}
                  <TableHead className="text-center">عدد الطلاب</TableHead>
                  {groupBy === 'student' && <TableHead className="text-center">عدد الدفعات</TableHead>}
                  <TableHead className="text-left">إجمالي المداخيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.grouped.map((g: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    {groupBy === 'specialization' && <TableCell className="text-sm">{g.department}</TableCell>}
                    <TableCell className="text-center num">{g.studentsCount}</TableCell>
                    {groupBy === 'student' && <TableCell className="text-center num">{g.payments}</TableCell>}
                    <TableCell className="text-left num font-bold text-emerald-700">{currency(g.income)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الوصل</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الطالب</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.studentPayments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد مداخيل</TableCell></TableRow>
                    ) : report.studentPayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                        <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                        <TableCell className="font-medium">{p.student.name}</TableCell>
                        <TableCell><Badge variant="outline">{p.paymentLabel}</Badge></TableCell>
                        <TableCell className="num text-emerald-700">{currency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">تفاصيل مصاريف الأساتذة ({report.teacherPayments.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الوصل</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الأستاذ</TableHead>
                      <TableHead>الشهر</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.teacherPayments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد مصاريف</TableCell></TableRow>
                    ) : report.teacherPayments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                        <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                        <TableCell className="font-medium">{p.teacher.name}</TableCell>
                        <TableCell className="num">{p.month}</TableCell>
                        <TableCell className="num text-red-700">{currency(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">تفاصيل المصاريف الثانوية ({report.expenses?.length || 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!report.expenses || report.expenses.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">لا توجد مصاريف ثانوية</TableCell></TableRow>
                    ) : report.expenses.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="num text-sm">{new Date(e.date).toLocaleDateString('ar')}</TableCell>
                        <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                        <TableCell className="text-sm">{e.description || '-'}</TableCell>
                        <TableCell className="num text-orange-700">{currency(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الوصل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="text-center">طباعة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">لا توجد وصولات</TableCell></TableRow>
                ) : filteredPayments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                    <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{p.student?.name || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{p.paymentLabel}</Badge></TableCell>
                    <TableCell className="num font-bold text-emerald-700">{currency(p.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => window.open(`/api/finance/receipt/${p.id}?type=student`, '_blank')}>
                        <Printer className="w-4 h-4 ml-1" /> طباعة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {filteredPayments.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-left">الإجمالي ({filteredPayments.length} وصل):</td>
                    <td className="px-4 py-3 num font-bold text-emerald-700">{currency(filteredPayments.reduce((s, p) => s + p.amount, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {isDirector && (
      <Card>
        <CardHeader><CardTitle className="text-lg">وصولات الأساتذة - للطباعة</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الوصل</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الأستاذ</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="text-center">طباعة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : recentTeacherPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد وصولات</TableCell></TableRow>
                ) : recentTeacherPayments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                    <TableCell className="num text-sm">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{p.teacher.name}</TableCell>
                    <TableCell className="num font-bold text-red-700">{currency(p.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => window.open(`/api/finance/receipt/${p.id}?type=teacher`, '_blank')}>
                        <Printer className="w-4 h-4 ml-1" /> طباعة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مصاريف</TableCell></TableRow>
                ) : expenses.map((e, i) => (
                  <TableRow key={e.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="num text-sm">{new Date(e.date).toLocaleDateString('ar')}</TableCell>
                    <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                    <TableCell className="text-sm">{e.description || '-'}</TableCell>
                    <TableCell className="num font-bold text-red-700">{currency(e.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(e)}>
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(e)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {expenses.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 font-medium">
                    <td colSpan={4} className="px-4 py-3 text-left">الإجمالي ({expenses.length} مصروف):</td>
                    <td className="px-4 py-3 num font-bold text-red-700">{currency(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </Table>
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
