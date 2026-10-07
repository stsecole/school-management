'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, CheckCircle2, Clock, AlertCircle, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Installment {
  id: string;
  monthNumber: number;
  expectedAmount: number;
  paidAmount: number;
  expectedDate: string;
  paidDate: string | null;
  status: string;
  notes: string | null;
}

interface InstallmentData {
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    department: { name: string; installmentMonths: number | null } | null;
    courseStartDate: string | null;
    totalAmount: number | null;
    initialPayment: number | null;
  };
  installments: Installment[];
  totalExpected: number;
  totalPaid: number;
  remaining: number;
  paidCount: number;
  pendingCount: number;
  partialCount: number;
}

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

export function InstallmentPlanModal({ open, studentId, onClose }: { open: boolean; studentId: string | null; onClose: () => void }) {
  const [data, setData] = useState<InstallmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, { paidAmount: string; paidDate: string; notes: string; status: string }>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (open && studentId) {
      setLoading(true);
      setEditData({});
      fetch(`/api/students/${studentId}/installments`)
        .then(r => r.json())
        .then(d => {
          setData(d);
          // Initialize edit data
          const edit: Record<string, any> = {};
          for (const inst of d.installments || []) {
            edit[inst.id] = {
              paidAmount: String(inst.paidAmount),
              paidDate: inst.paidDate ? inst.paidDate.split('T')[0] : '',
              notes: inst.notes || '',
              status: inst.status,
            };
          }
          setEditData(edit);
        })
        .catch(e => console.error(e))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [open, studentId]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const installments = Object.entries(editData).map(([id, val]) => ({
        id,
        paidAmount: val.paidAmount,
        paidDate: val.paidDate,
        notes: val.notes,
        status: val.status,
      }));
      const res = await fetch(`/api/students/${studentId}/installments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installments }),
      });
      if (res.ok) {
        toast({ title: 'تم', description: 'تم حفظ جدول الأقساط' });
        // Reload
        const refreshed = await fetch(`/api/students/${studentId}/installments`).then(r => r.json());
        setData(refreshed);
        const edit: Record<string, any> = {};
        for (const inst of refreshed.installments || []) {
          edit[inst.id] = {
            paidAmount: String(inst.paidAmount),
            paidDate: inst.paidDate ? inst.paidDate.split('T')[0] : '',
            notes: inst.notes || '',
            status: inst.status,
          };
        }
        setEditData(edit);
      } else {
        toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = (inst: Installment) => {
    setEditData(prev => ({
      ...prev,
      [inst.id]: {
        ...prev[inst.id],
        paidAmount: String(inst.expectedAmount),
        paidDate: new Date().toISOString().split('T')[0],
        status: 'paid',
      },
    }));
  };

  const handleMarkUnpaid = (inst: Installment) => {
    setEditData(prev => ({
      ...prev,
      [inst.id]: {
        ...prev[inst.id],
        paidAmount: '0',
        paidDate: '',
        status: 'pending',
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-orange-600" />
            جدول الأقساط الشهرية
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>
        ) : !data ? (
          <div className="py-8 text-center text-muted-foreground">لا توجد بيانات</div>
        ) : data.installments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            لا يوجد جدول أقساط لهذا الطالب. يتم توليده تلقائياً لطلاب قسم التقني سامي.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Student info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{data.student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {data.student.studentNumber && <span className="num font-mono">{data.student.studentNumber} • </span>}
                      {data.student.department?.name}
                      {data.student.courseStartDate && (
                        <span> • بداية الدورة: {new Date(data.student.courseStartDate).toLocaleDateString('ar')}</span>
                      )}
                    </p>
                    {(data.student.totalAmount || data.student.initialPayment) && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        {data.student.totalAmount != null && (
                          <div className="p-2 bg-blue-50 rounded text-center">
                            <p className="text-xs text-blue-600">المبلغ الإجمالي</p>
                            <p className="font-bold text-blue-700 num">{currency(data.student.totalAmount)}</p>
                          </div>
                        )}
                        {data.student.initialPayment != null && data.student.initialPayment > 0 && (
                          <div className="p-2 bg-emerald-50 rounded text-center">
                            <p className="text-xs text-emerald-600">الدفعة الأولية</p>
                            <p className="font-bold text-emerald-700 num">{currency(data.student.initialPayment)}</p>
                          </div>
                        )}
                        {data.student.totalAmount != null && data.student.initialPayment != null && (
                          <div className="p-2 bg-orange-50 rounded text-center">
                            <p className="text-xs text-orange-600">المبلغ المتبقي</p>
                            <p className="font-bold text-orange-700 num">{currency(data.student.totalAmount - data.student.initialPayment)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <CalendarClock className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs text-muted-foreground">الأشهر</span>
                  </div>
                  <p className="text-lg font-bold text-blue-700 num">{data.installments.length}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">مدفوعة</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 num">{data.paidCount}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs text-muted-foreground">معلقة</span>
                  </div>
                  <p className="text-lg font-bold text-amber-700 num">{data.pendingCount}</p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-xs text-muted-foreground">جزئية</span>
                  </div>
                  <p className="text-lg font-bold text-orange-700 num">{data.partialCount}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-muted-foreground">المتبقي</span>
                  </div>
                  <p className="text-sm font-bold text-red-700 num">{currency(data.remaining)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Progress */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>المدفوع: <span className="num font-bold text-emerald-600">{currency(data.totalPaid)}</span></span>
                  <span>الإجمالي المطلوب: <span className="num font-bold">{currency(data.totalExpected)}</span></span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${data.totalExpected > 0 ? (data.totalPaid / data.totalExpected) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  نسبة الإنجاز: {data.totalExpected > 0 ? Math.round((data.totalPaid / data.totalExpected) * 100) : 0}%
                </p>
              </CardContent>
            </Card>

            {/* Installments table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>جدول الأقساط (شهر بشهر)</span>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</> : <><Save className="w-4 h-4 ml-2" /> حفظ التغييرات</>}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-16 text-center">الشهر</TableHead>
                        <TableHead>تاريخ الاستحقاق</TableHead>
                        <TableHead>المبلغ المطلوب</TableHead>
                        <TableHead>المبلغ المدفوع</TableHead>
                        <TableHead>تاريخ الدفع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>ملاحظات</TableHead>
                        <TableHead className="text-center">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.installments.map((inst) => {
                        const edit = editData[inst.id] || {};
                        const isPaid = inst.status === 'paid';
                        return (
                          <TableRow key={inst.id} className={isPaid ? 'bg-emerald-50/30' : ''}>
                            <TableCell className="text-center num font-bold">{inst.monthNumber}</TableCell>
                            <TableCell className="num text-xs">{new Date(inst.expectedDate).toLocaleDateString('ar')}</TableCell>
                            <TableCell className="num text-xs">{currency(inst.expectedAmount)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={edit.paidAmount || '0'}
                                onChange={(e) => setEditData(prev => ({ ...prev, [inst.id]: { ...prev[inst.id], paidAmount: e.target.value } }))}
                                className="h-8 w-24 num"
                                dir="ltr"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={edit.paidDate || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, [inst.id]: { ...prev[inst.id], paidDate: e.target.value } }))}
                                className="h-8 w-36"
                                dir="ltr"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                inst.status === 'paid' ? 'default' :
                                inst.status === 'partial' ? 'secondary' :
                                inst.status === 'late' ? 'destructive' :
                                'outline'
                              } className={inst.status === 'paid' ? 'bg-emerald-600' : ''}>
                                {inst.status === 'paid' ? 'مدفوع' :
                                 inst.status === 'partial' ? 'جزئي' :
                                 inst.status === 'late' ? 'متأخر' : 'معلق'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={edit.notes || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, [inst.id]: { ...prev[inst.id], notes: e.target.value } }))}
                                className="h-8 min-w-32 text-xs"
                                rows={1}
                                placeholder="ملاحظة..."
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {inst.status !== 'paid' ? (
                                <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inst)} className="h-7 text-xs">
                                  دفع
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => handleMarkUnpaid(inst)} className="h-7 text-xs">
                                  تراجع
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
