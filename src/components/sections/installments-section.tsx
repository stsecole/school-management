'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Wallet, CheckCircle2, Clock, AlertCircle, Loader2, Search,
  Users, BookOpen, ChevronLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstallmentPlanModal } from '@/components/common/installment-plan-modal';

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n || 0) + ' دج';

interface StudentWithInstallments {
  id: string;
  name: string;
  studentNumber: string | null;
  phone: string | null;
  department: { name: string; hasInstallments: boolean; installmentMonths: number | null } | null;
  _count?: { installmentPlans: number };
}

interface Stats {
  totalStudents: number;
  totalExpected: number;
  totalPaid: number;
  totalRemaining: number;
  overdueCount: number;
}

/**
 * نظام الأقساط المالية (V1 - متكامل مع نظام الطلاب)
 *
 * تعتمد هذه الواجهة على النظام الأصلي (InstallmentPlan):
 * - يتم توليد الأقساط تلقائياً عند تسجيل طالب في قسم بأقساط شهرية (مثل التقني سامي)
 * - عرض قائمة الطلاب الذين لديهم أقساط + إحصائيات شاملة
 * - النقر على أي طالب يفتح نافذة خطة الأقساط الكاملة (تسديد، تعديل، طباعة)
 */
export function InstallmentsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [students, setStudents] = useState<StudentWithInstallments[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // جلب جميع الطلاب الذين في أقسام لها أقساط شهرية
      const res = await fetch('/api/students?hasInstallments=true');
      const data = await res.json();
      const allStudents: StudentWithInstallments[] = data.students || [];

      // فلترة بالبحث النصي
      const filtered = search
        ? allStudents.filter(s =>
            s.name.includes(search) ||
            s.studentNumber?.includes(search) ||
            s.phone?.includes(search)
          )
        : allStudents;

      setStudents(filtered);

      // حساب الإحصائيات: استدعاء تفاصيل كل طالب (للتبسيط، نستخدم أعداد أقساطه)
      let totalExpected = 0;
      let totalPaid = 0;
      let totalRemaining = 0;
      let overdueCount = 0;

      // لكل طالب، نحضر ملخصه المالي (للأداء: نكتفي بأول 50 طالباً)
      const sampleForStats = filtered.slice(0, 50);
      await Promise.all(
        sampleForStats.map(async (s) => {
          try {
            const r = await fetch(`/api/students/${s.id}/installments`);
            const d = await r.json();
            if (d.financialSummary) {
              totalExpected += d.financialSummary.totalExpected || 0;
              totalPaid += d.financialSummary.totalPaid || 0;
              totalRemaining += d.financialSummary.remaining || 0;
              overdueCount += d.financialSummary.lateCount || 0;
            }
          } catch {}
        })
      );

      setStats({
        totalStudents: allStudents.length,
        totalExpected,
        totalPaid,
        totalRemaining,
        overdueCount,
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'خطأ', description: 'تعذر تحميل البيانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> نظام الأقساط المالية
          </h2>
          <p className="text-muted-foreground text-sm">
            إدارة أقساط الطلاب في الأقسام ذات الأقساط الشهرية (مثل التقني سامي)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Wallet className="w-4 h-4 ml-2" />}
          تحديث
        </Button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1"><Users className="w-3.5 h-3.5 text-blue-600" /><span className="text-xs text-muted-foreground">طلاب بأقساط</span></div>
              <p className="text-lg font-bold text-blue-700 num">{stats.totalStudents}</p>
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
              <div className="flex items-center gap-1 mb-1"><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span className="text-xs text-muted-foreground">أقساط متأخرة</span></div>
              <p className="text-lg font-bold text-red-700 num">{stats.overdueCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الرقم..."
              className="pr-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> قائمة الطلاب بأقساط شهرية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الرقم</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>الأقساط</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" /> جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      لا يوجد طلاب بأقساط شهرية. سجّل طالباً في قسم مثل "التقني سامي" ليتم توليد الأقساط تلقائياً.
                    </TableCell>
                  </TableRow>
                ) : students.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="num text-xs text-muted-foreground">{s.studentNumber || '-'}</TableCell>
                    <TableCell className="text-xs">{s.department?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs num">
                        {s._count?.installmentPlans || 0} قسط
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModalStudentId(s.id)}
                      >
                        عرض خطة الأقساط <ChevronLeft className="w-3 h-3 mr-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Installment Plan Modal */}
      <InstallmentPlanModal
        open={!!modalStudentId}
        studentId={modalStudentId}
        onClose={() => setModalStudentId(null)}
      />
    </div>
  );
}
