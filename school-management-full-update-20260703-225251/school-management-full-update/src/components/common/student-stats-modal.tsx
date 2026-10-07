'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { User, Wallet, Clock, BookOpen, TrendingUp, X, Image as ImageIcon } from 'lucide-react';

interface StudentStats {
  student: any;
  payments: any[];
  totalPaid: number;
  courseFees: number;
  remaining: number;
  paymentCount: number;
  initialPayment?: number | null;
  installmentsTotal?: {
    expected: number;
    paid: number;
    remaining: number;
    totalAmount: number;
    initialPayment: number;
    overallPaid: number;
    overallRemaining: number;
  } | null;
  attendance: {
    totalSessions: number;
    presentSessions: number;
    attendanceRate: number;
    records: any[];
  };
  registrations: any[];
  courseCount: number;
}

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

export function StudentStatsModal({ open, studentId, onClose }: { open: boolean; studentId: string | null; onClose: () => void }) {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && studentId) {
      setLoading(true);
      fetch(`/api/students/${studentId}/stats`)
        .then(r => r.json())
        .then(data => setStats(data.stats))
        .catch(e => console.error(e))
        .finally(() => setLoading(false));
    } else {
      setStats(null);
    }
  }, [open, studentId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            إحصائيات الطالب
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>
        ) : !stats ? (
          <div className="py-8 text-center text-muted-foreground">لا توجد بيانات</div>
        ) : (
          <div className="space-y-4">
            {/* Student info */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold">{stats.student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stats.student.studentNumber && <span className="num font-mono">{stats.student.studentNumber} • </span>}
                      {stats.student.department?.name} - {stats.student.level?.name}
                    </p>
                  </div>
                  <Badge variant={stats.student.status === 'active' ? 'default' : 'outline'}>
                    {stats.student.status === 'active' ? 'نشط' : stats.student.status === 'graduated' ? 'متخرج' : 'غير نشط'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {stats.student.phone && <div><span className="text-muted-foreground">الهاتف:</span> <span className="num">{stats.student.phone}</span></div>}
                  {stats.student.email && <div><span className="text-muted-foreground">البريد:</span> <span className="num">{stats.student.email}</span></div>}
                  {stats.student.section && <div><span className="text-muted-foreground">الشعبة:</span> {stats.student.section}</div>}
                  {stats.student.specialty && <div><span className="text-muted-foreground">التخصص:</span> {stats.student.specialty}</div>}
                </div>
              </CardContent>
            </Card>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-muted-foreground">المدفوع</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 num">{currency(stats.totalPaid)}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-muted-foreground">المتبقي</span>
                  </div>
                  <p className="text-lg font-bold text-red-700 num">{currency(stats.remaining)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">التسجيلات</span>
                  </div>
                  <p className="text-lg font-bold text-blue-700 num">{stats.courseCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-xs text-muted-foreground">نسبة الحضور</span>
                  </div>
                  <p className="text-lg font-bold text-purple-700 num">{stats.attendance.attendanceRate}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Payment progress */}
            <Card>
              <CardHeader><CardTitle className="text-base">تقدم الدفع</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Main progress: totalPaid / courseFees (totalAmount) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>المبلغ الإجمالي: <span className="num font-bold">{currency(stats.courseFees)}</span></span>
                      <span>المدفوع: <span className="num font-bold text-emerald-600">{currency(stats.totalPaid)}</span></span>
                    </div>
                    <Progress value={stats.courseFees > 0 ? (stats.totalPaid / stats.courseFees) * 100 : 0} className="h-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      المتبقي: <span className="num font-bold text-red-600">{currency(stats.remaining)}</span>
                      {' '} ({stats.courseFees > 0 ? Math.round((stats.totalPaid / stats.courseFees) * 100) : 0}% مدفوع)
                    </p>
                  </div>

                  {/* For التقني سامي: show installment breakdown */}
                  {stats.installmentsTotal && (
                    <div className="pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">تفاصيل الأقساط (التقني سامي - 30 شهر):</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between p-2 bg-blue-50 rounded">
                          <span>المبلغ الإجمالي:</span>
                          <span className="num font-bold text-blue-700">{currency(stats.installmentsTotal.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-emerald-50 rounded">
                          <span>الدفعة الأولية:</span>
                          <span className="num font-bold text-emerald-700">{currency(stats.installmentsTotal.initialPayment)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-orange-50 rounded">
                          <span>مجموع الأقساط (30 شهر):</span>
                          <span className="num font-bold text-orange-700">{currency(stats.installmentsTotal.expected)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-amber-50 rounded">
                          <span>أقساط مدفوعة:</span>
                          <span className="num font-bold text-amber-700">{currency(stats.installmentsTotal.paid)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-red-50 rounded col-span-2">
                          <span>المبلغ المتبقي للدفع:</span>
                          <span className="num font-bold text-red-700">{currency(stats.installmentsTotal.overallRemaining)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payments table */}
            <Card>
              <CardHeader><CardTitle className="text-base">سجل الدفعات ({stats.payments.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الوصل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.payments.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">لا توجد دفعات</TableCell></TableRow>
                      ) : stats.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs num">{p.receiptNumber}</TableCell>
                          <TableCell className="text-sm num">{new Date(p.paymentDate).toLocaleDateString('ar')}</TableCell>
                          <TableCell><Badge variant="outline">{p.paymentLabel}</Badge></TableCell>
                          <TableCell className="font-bold text-emerald-700 num">{currency(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Registrations */}
            <Card>
              <CardHeader><CardTitle className="text-base">الدورات المسجلة ({stats.registrations.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.registrations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد تسجيلات</p>
                  ) : stats.registrations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        {r.photoUrl ? (
                           
                          <img
                            src={r.photoUrl}
                            alt={r.courseName}
                            className="w-10 h-10 rounded-full object-cover border border-primary/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{r.courseName}</p>
                          <p className="text-xs text-muted-foreground num">{new Date(r.date).toLocaleDateString('ar')}</p>
                        </div>
                      </div>
                      {r.level && <Badge variant="secondary" className="text-xs">{r.level}</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
