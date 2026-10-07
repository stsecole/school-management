'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, GraduationCap, BookOpen, Briefcase, Wallet, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface Stats {
  counts: {
    students: number;
    teachers: number;
    departments: number;
    courses: number;
    registrations: number;
    attendances: number;
    tasks: number;
    pendingTasks: number;
    overdueTasks: number;
  };
  finance: {
    totalIncome: number;
    totalExpense: number;
    totalTeacherExpense: number;
    totalSecondaryExpense: number;
    balance: number;
  } | null;
  departments: any[];
  levels: any[];
  recentStudents: any[];
  recentTasks: any[];
  attendanceByMonth: { month: string; total: number; male: number; female: number }[];
  paymentsByMonth: { month: string; income: number; expense: number }[];
  isDirector?: boolean;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return <div>تعذر تحميل الإحصائيات</div>;

  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

  const statsCards = [
    { label: 'إجمالي الطلاب', value: stats.counts.students, icon: Users, color: 'bg-blue-500', textColor: 'text-blue-600' },
    { label: 'الأساتذة', value: stats.counts.teachers, icon: GraduationCap, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    { label: 'الأقسام', value: stats.counts.departments, icon: BookOpen, color: 'bg-amber-500', textColor: 'text-amber-600' },
    { label: 'الدورات', value: stats.counts.courses, icon: Briefcase, color: 'bg-purple-500', textColor: 'text-purple-600' },
    { label: 'التسجيلات', value: stats.counts.registrations, icon: CheckCircle2, color: 'bg-cyan-500', textColor: 'text-cyan-600' },
    { label: 'سجلات الحضور', value: stats.counts.attendances, icon: Clock, color: 'bg-pink-500', textColor: 'text-pink-600' },
    { label: 'المهام المعلقة', value: stats.counts.pendingTasks, icon: AlertCircle, color: 'bg-orange-500', textColor: 'text-orange-600', alert: stats.counts.overdueTasks > 0 },
    { label: 'مهام متأخرة', value: stats.counts.overdueTasks, icon: AlertCircle, color: 'bg-red-500', textColor: 'text-red-600' },
  ];

  const maxAttendance = Math.max(...stats.attendanceByMonth.map(m => m.total), 1);
  const maxPayment = Math.max(...stats.paymentsByMonth.map(m => Math.max(m.income, m.expense)), 1);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="stat-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{s.label}</p>
                    <p className={`text-3xl font-bold num ${s.textColor}`}>{s.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${s.color} bg-opacity-10`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                {s.alert && (
                  <Badge variant="destructive" className="mt-2 text-xs">يتطلب انتباه</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Finance overview - only shown to directors */}
      {stats.finance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">إجمالي المداخيل</span>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 num">{currency(stats.finance.totalIncome)}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">رواتب الأساتذة</span>
                <GraduationCap className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700 num">{currency(stats.finance.totalTeacherExpense)}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">مصاريف ثانوية</span>
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-700 num">{currency(stats.finance.totalSecondaryExpense)}</p>
            </CardContent>
          </Card>
          <Card className={stats.finance.balance >= 0 ? 'border-primary bg-primary/5' : 'border-red-200 bg-red-50/50'}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">الرصيد الحالي</span>
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <p className={`text-2xl font-bold num ${stats.finance.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
                {currency(stats.finance.balance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الحضور خلال الأشهر الماضية</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.attendanceByMonth.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
            ) : (
              <div className="space-y-3">
                {stats.attendanceByMonth.map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{m.month}</span>
                      <span className="font-medium num">{m.total}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(m.total / maxAttendance) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">المداخيل والمصاريف الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats.finance || stats.paymentsByMonth.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {!stats.finance ? 'البيانات المالية متاحة للمدير فقط' : 'لا توجد بيانات'}
              </p>
            ) : (
              <div className="space-y-3">
                {stats.paymentsByMonth.map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{m.month}</span>
                      <span className="font-medium num">
                        <span className="text-emerald-600">+{currency(m.income)}</span>
                        {' / '}
                        <span className="text-red-600">-{currency(m.expense)}</span>
                      </span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(m.income / maxPayment) * 100}%` }}
                        />
                      </div>
                      <div className="flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${(m.expense / maxPayment) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Departments overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الطلاب حسب القسم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.departments.map((d: any) => {
                const total = stats.counts.students || 1;
                const pct = (d._count.students / total) * 100;
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground num">{d._count.students} طالب</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
              {stats.departments.length === 0 && <p className="text-muted-foreground text-center">لا توجد أقسام</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">آخر الطلاب المسجلين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {stats.recentStudents.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.department?.name} - {s.level?.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs num">
                    {s.studentNumber}
                  </Badge>
                </div>
              ))}
              {stats.recentStudents.length === 0 && <p className="text-muted-foreground text-center">لا يوجد</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">آخر المهام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.recentTasks.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                <div className="flex items-center gap-3">
                  {t.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <p className={`font-medium text-sm ${t.completed ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.responsible && `المسؤول: ${t.responsible}`}
                      {t.deadline && ` • الأجال: ${new Date(t.deadline).toLocaleDateString('ar')}`}
                    </p>
                  </div>
                </div>
                <Badge variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                  {t.priorityLabel}
                </Badge>
              </div>
            ))}
            {stats.recentTasks.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد مهام</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
