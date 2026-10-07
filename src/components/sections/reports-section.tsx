'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Users, GraduationCap, BookOpen, CalendarCheck, ListTodo,
  Wallet, TrendingUp, TrendingDown, Sparkles, Loader2, Award, AlertCircle,
  Building2, Trophy, AlertTriangle, Filter, Printer, Download, Search, User, X,
  CalendarClock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface ReportsData {
  year: number;
  general: {
    students: number;
    teachers: number;
    departments: number;
    attendances: number;
    tasks: number;
    pendingTasks: number;
    completedTasks: number;
    overdueTasks: number;
  };
  departments: Array<{ id: string; name: string; _count: { students: number; teachers: number; courses: number } }>;
  attendanceByMonth: Array<{ month: string; total: number; male: number; female: number; sessions: number }>;
  topTeachers: Array<{ teacherId: string; teacherName: string; sessions: number; totalAttendees: number }>;
  tasks: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    employeeRanking: Array<{
      name: string;
      total: number;
      completed: number;
      pending: number;
      overdue: number;
      completionRate: number;
      avgDays: number;
    }>;
  };
  financial: {
    totalIncome: number;
    totalExpenses: number;
    totalTeacherPayments: number;
    totalSecondaryExpenses: number;
    balance: number;
    monthlyIncome: Array<{ month: string; income: number }>;
    monthlyExpenses: Array<{ month: string; expenses: number }>;
    expensesByType: Record<string, number>;
  } | null;
  isDirector: boolean;
}

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

export function ReportsSection({ isDirector = false }: { isDirector?: boolean }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear.toString());
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsedFallback, setAiUsedFallback] = useState(false);
  const [analysisType, setAnalysisType] = useState('general');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/comprehensive?year=${year}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحميل التقرير', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [year]);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const res = await fetch('/api/reports/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year), analysisType }),
      });
      const json = await res.json();
      if (res.ok) {
        setAiAnalysis(json.analysis || '');
        setAiUsedFallback(json.usedFallback || false);
        toast({
          title: json.usedFallback ? 'تم (تحليل محلي)' : 'تم',
          description: json.usedFallback ? 'لم يتوفر LLM، تم استخدام التحليل المحلي' : 'تم إنشاء التحليل بالذكاء الاصطناعي',
        });
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل التحليل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جاري تحميل التقرير الشامل...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-16 text-muted-foreground">تعذر تحميل البيانات</div>;
  }

  const maxAttendance = Math.max(...data.attendanceByMonth.map(m => m.total), 1);
  const maxIncome = data.financial ? Math.max(...data.financial.monthlyIncome.map(m => m.income), 1) : 1;
  const maxExpense = data.financial ? Math.max(...data.financial.monthlyExpenses.map(m => m.expenses), 1) : 1;

  const kpiCards = [
    { label: 'الطلاب', value: data.general.students, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'الأساتذة', value: data.general.teachers, icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'الأقسام', value: data.general.departments, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'الحضور', value: data.general.attendances, icon: CalendarCheck, color: 'text-pink-600', bg: 'bg-pink-100' },
    { label: 'المهام', value: data.general.tasks, icon: ListTodo, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'مكتملة', value: data.general.completedTasks, icon: Award, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    { label: 'معلقة', value: data.general.pendingTasks, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'متأخرة', value: data.general.overdueTasks, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> التقارير الشاملة
          </h2>
          <p className="text-muted-foreground text-sm">تقرير سنوي شامل لكل نواحي المؤسسة</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">السنة:</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()} title="طباعة التقرير">
            <Printer className="w-4 h-4 ml-1" /> طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/reports/export-excel?year=${year}`, '_blank')} title="تصدير إلى Excel">
            <Download className="w-4 h-4 ml-1" /> Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          {isDirector && <TabsTrigger value="financial">المالية</TabsTrigger>}
          {isDirector && <TabsTrigger value="branches">مقارنة الفروع</TabsTrigger>}
          <TabsTrigger value="student-filters">فلاتر الطلاب</TabsTrigger>
          <TabsTrigger value="student-attendance">حضور طالب</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
          <TabsTrigger value="tasks">المهام</TabsTrigger>
          <TabsTrigger value="ai">التحليل الذكي</TabsTrigger>
        </TabsList>

        {/* ===== نظرة عامة ===== */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map((k, i) => {
              const Icon = k.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                        <p className={`text-2xl font-bold num ${k.color}`}>{k.value}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${k.bg}`}>
                        <Icon className={`w-5 h-5 ${k.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الطلاب والأساتذة حسب القسم</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {data.departments.map(d => {
                    const maxStudents = Math.max(...data.departments.map(x => x._count.students), 1);
                    const pct = (d._count.students / maxStudents) * 100;
                    return (
                      <div key={d.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground num">
                            {d._count.students} طالب • {d._count.teachers} أستاذ
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {data.departments.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد أقسام</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">الحضور الشهري</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {data.attendanceByMonth.map((m, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground num">{m.month}</span>
                        <span className="font-medium num">{m.total} حضور ({m.sessions} جلسة)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(m.total / maxAttendance) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  {data.attendanceByMonth.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات حضور</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== المالية (للمدير فقط) ===== */}
        {isDirector && data.financial && (
          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">إجمالي المداخيل</span>
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xl font-bold text-emerald-700 num">{currency(data.financial.totalIncome)}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">إجمالي المصاريف</span>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-xl font-bold text-red-700 num">{currency(data.financial.totalExpenses)}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">رواتب الأساتذة</span>
                    <Wallet className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-xl font-bold text-amber-700 num">{currency(data.financial.totalTeacherPayments)}</p>
                </CardContent>
              </Card>
              <Card className={data.financial.balance >= 0 ? 'border-primary bg-primary/5' : 'border-red-200 bg-red-50/50'}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">الرصيد</span>
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <p className={`text-xl font-bold num ${data.financial.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
                    {currency(data.financial.balance)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">المداخيل الشهرية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.financial.monthlyIncome.map((m, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground num">{m.month}</span>
                          <span className="font-medium num text-emerald-700">{currency(m.income)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(m.income / maxIncome) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    {data.financial.monthlyIncome.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">لا توجد مداخيل</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">المصاريف الشهرية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.financial.monthlyExpenses.map((m, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground num">{m.month}</span>
                          <span className="font-medium num text-red-700">{currency(m.expenses)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${(m.expenses / maxExpense) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    {data.financial.monthlyExpenses.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">لا توجد مصاريف</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">المصاريف حسب النوع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.financial.expensesByType).map(([type, amount]) => (
                    <div key={type} className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">{type}</p>
                      <p className="font-bold text-sm num mt-1">{currency(amount)}</p>
                    </div>
                  ))}
                  {Object.keys(data.financial.expensesByType).length === 0 && (
                    <p className="text-center text-muted-foreground col-span-full py-4">لا توجد مصاريف</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== مقارنة الفروع (للمدير فقط) ===== */}
        {isDirector && (
          <TabsContent value="branches" className="space-y-4">
            <BranchComparisonTab year={year} />
          </TabsContent>
        )}

        {/* ===== فلاتر الطلاب ===== */}
        <TabsContent value="student-filters" className="space-y-4">
          <StudentFiltersTab />
        </TabsContent>

        {/* ===== حضور طالب واحد ===== */}
        <TabsContent value="student-attendance" className="space-y-4">
          <StudentAttendanceTab />
        </TabsContent>

        {/* ===== الحضور ===== */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الحضور حسب الشهر - {data.year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.attendanceByMonth.map((m, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground num">{m.month}</span>
                      <span className="font-medium num">
                        إجمالي: {m.total} • ذكور: {m.male} • إناث: {m.female} • جلسات: {m.sessions}
                      </span>
                    </div>
                    <div className="flex gap-1 h-3">
                      <div className="flex-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(m.male / maxAttendance) * 100}%` }} />
                      </div>
                      <div className="flex-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500" style={{ width: `${(m.female / maxAttendance) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {data.attendanceByMonth.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات حضور للسنة المحددة</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" /> أفضل 10 أساتذة حسب النشاط
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div style={{ minWidth: '400px' }}>
                  {/* Header */}
                  <div
                    className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                    style={{ gridTemplateColumns: '40px 1fr 120px 120px' }}
                  >
                    <div className="text-center">#</div>
                    <div className="text-right">الأستاذ</div>
                    <div className="text-center">عدد الجلسات</div>
                    <div className="text-center">إجمالي الحضور</div>
                  </div>

                  {/* Body */}
                  {data.topTeachers.map((t, i) => (
                    <div
                      key={t.teacherId}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '40px 1fr 120px 120px' }}
                    >
                      <div className="text-center">
                        <Badge variant={i === 0 ? 'default' : 'secondary'}>{i + 1}</Badge>
                      </div>
                      <div className="text-right font-medium">{t.teacherName}</div>
                      <div className="text-center num">{t.sessions}</div>
                      <div className="text-center num">{t.totalAttendees}</div>
                    </div>
                  ))}
                  {data.topTeachers.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">لا توجد بيانات</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== المهام ===== */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">إجمالي المهام</p>
                <p className="text-2xl font-bold num text-purple-600">{data.tasks.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">مكتملة</p>
                <p className="text-2xl font-bold num text-emerald-600">{data.tasks.completed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">معلقة</p>
                <p className="text-2xl font-bold num text-orange-600">{data.tasks.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">متأخرة</p>
                <p className="text-2xl font-bold num text-red-600">{data.tasks.overdue}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ترتيب الموظفين حسب إكمال المهام</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div style={{ minWidth: '760px' }}>
                  {/* Header */}
                  <div
                    className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                    style={{ gridTemplateColumns: '40px 1fr 70px 70px 70px 70px 160px 80px' }}
                  >
                    <div className="text-center">#</div>
                    <div className="text-right">الموظف</div>
                    <div className="text-center">الإجمالي</div>
                    <div className="text-center">مكتملة</div>
                    <div className="text-center">معلقة</div>
                    <div className="text-center">متأخرة</div>
                    <div className="text-center">نسبة الإكمال</div>
                    <div className="text-center">متوسط الأيام</div>
                  </div>

                  {/* Body */}
                  {data.tasks.employeeRanking.map((e, i) => (
                    <div
                      key={i}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                      style={{ gridTemplateColumns: '40px 1fr 70px 70px 70px 70px 160px 80px' }}
                    >
                      <div className="text-center">
                        <Badge variant={i === 0 ? 'default' : 'secondary'}>{i + 1}</Badge>
                      </div>
                      <div className="text-right font-medium">{e.name}</div>
                      <div className="text-center num">{e.total}</div>
                      <div className="text-center num text-emerald-600">{e.completed}</div>
                      <div className="text-center num text-orange-600">{e.pending}</div>
                      <div className="text-center num text-red-600">{e.overdue}</div>
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${e.completionRate >= 70 ? 'bg-emerald-500' : e.completionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${e.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium num">{e.completionRate}%</span>
                      </div>
                      <div className="text-center num">{e.avgDays}</div>
                    </div>
                  ))}
                  {data.tasks.employeeRanking.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">لا توجد بيانات</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== التحليل الذكي ===== */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> التحليل الذكي بالذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={analysisType} onValueChange={setAnalysisType}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="نوع التحليل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">تحليل عام</SelectItem>
                    <SelectItem value="performance">تحليل الأداء</SelectItem>
                    <SelectItem value="financial">تحليل مالي</SelectItem>
                    <SelectItem value="recommendations">توصيات تحسين</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleGenerateAI} disabled={aiLoading}>
                  {aiLoading ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحليل...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 ml-2" /> توليد التحليل</>
                  )}
                </Button>
              </div>

              {aiAnalysis && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  {aiUsedFallback && (
                    <div className="mb-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      تنبيه: تم استخدام التحليل المحلي الاحتياطي (لم يتوفر LLM)
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 text-primary">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold mb-1 mt-3">{children}</h3>,
                        p: ({ children }) => <p className="text-sm leading-relaxed mb-2">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pr-5 mb-2 text-sm space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pr-5 mb-2 text-sm space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                        code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-r-4 border-primary pr-3 text-muted-foreground italic text-xs my-2">{children}</blockquote>,
                      }}
                    >
                      {aiAnalysis}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {!aiAnalysis && !aiLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>اضغط على &quot;توليد التحليل&quot; لإنشاء تقرير ذكي شامل بناءً على بيانات السنة {year}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Branch Comparison Tab (للمدير فقط) ============
function BranchComparisonTab({ year }: { year: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsedFallback, setAiUsedFallback] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/branch-comparison?year=${year}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحميل المقارنة', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const res = await fetch('/api/reports/branch-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: parseInt(year) }),
      });
      const json = await res.json();
      if (res.ok) {
        setAiAnalysis(json.analysis || '');
        setAiUsedFallback(json.usedFallback || false);
        toast({
          title: json.usedFallback ? 'تم (تحليل محلي)' : 'تم',
          description: json.usedFallback ? 'لم يتوفر LLM، تم استخدام التحليل المحلي' : 'تم إنشاء التحليل بالذكاء الاصطناعي',
        });
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل التحليل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جاري تحميل مقارنة الفروع...</span>
      </div>
    );
  }

  if (!data || !data.branches || data.branches.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">لا توجد فروع نشطة لعرض المقارنة</p>
          <p className="text-xs text-muted-foreground mt-1">أضف فروعاً من قسم "الفروع" أولاً</p>
        </CardContent>
      </Card>
    );
  }

  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';
  const branches: any[] = data.branches;
  const totals: any = data.totals;
  const ranking: any = data.ranking;

  return (
    <div className="space-y-4">
      {/* Header with AI button */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> مقارنة الفروع - {year}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {data.branchCount} فرع نشط • إجمالي {totals.students} طالب • {currency(totals.totalIncome)} مداخيل
            </p>
          </div>
          <Button onClick={handleGenerateAI} disabled={aiLoading}>
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحليل...</>
            ) : (
              <><Sparkles className="w-4 h-4 ml-2" /> تحليل ذكي للمقارنة</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Totals summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي المداخيل</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-bold num text-emerald-700">{currency(totals.studentIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي المصاريف</span>
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-lg font-bold num text-red-700">{currency(totals.totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">صافي الرصيد</span>
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <p className={`text-lg font-bold num ${totals.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
              {currency(totals.balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي الطلاب</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg font-bold num text-blue-700">{totals.students}</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-5 h-5" /> المقارنة المالية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '900px' }}>
              {/* Header */}
              <div
                className="grid gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}
              >
                <div>الفرع</div>
                <div className="text-center">المداخيل</div>
                <div className="text-center">رواتب الأساتذة</div>
                <div className="text-center">مصاريف ثانوية</div>
                <div className="text-center">إجمالي المصاريف</div>
                <div className="text-center">الرصيد</div>
                <div className="text-center">الهامش</div>
              </div>
              {/* Rows */}
              {branches.map(b => (
                <div
                  key={b.id}
                  className="grid gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}
                >
                  <div className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {b.name}
                  </div>
                  <div className="text-center num text-emerald-700">{currency(b.finance.studentIncome)}</div>
                  <div className="text-center num text-amber-700">{currency(b.finance.teacherExpense)}</div>
                  <div className="text-center num text-orange-700">{currency(b.finance.secondaryExpense)}</div>
                  <div className="text-center num text-red-700">{currency(b.finance.totalExpenses)}</div>
                  <div className={`text-center num font-bold ${b.finance.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
                    {currency(b.finance.balance)}
                  </div>
                  <div className="text-center">
                    <Badge variant={b.finance.margin >= 0 ? 'default' : 'destructive'} className="num">
                      {b.finance.margin}%
                    </Badge>
                  </div>
                </div>
              ))}
              {/* Totals row */}
              <div
                className="grid gap-2 px-3 py-3 border-t-2 bg-muted/30 font-bold text-sm"
                style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 80px' }}
              >
                <div>الإجمالي</div>
                <div className="text-center num text-emerald-700">{currency(totals.studentIncome)}</div>
                <div className="text-center num text-amber-700">{currency(totals.teacherExpense)}</div>
                <div className="text-center num text-orange-700">{currency(totals.secondaryExpense)}</div>
                <div className="text-center num text-red-700">{currency(totals.totalExpenses)}</div>
                <div className={`text-center num ${totals.balance >= 0 ? 'text-primary' : 'text-red-700'}`}>
                  {currency(totals.balance)}
                </div>
                <div className="text-center num">
                  {totals.studentIncome > 0 ? Math.round((totals.balance / totals.studentIncome) * 100) : 0}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-5 h-5" /> المقارنة الأكاديمية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '700px' }}>
              <div
                className="grid gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '1.5fr 80px 80px 100px 100px 80px' }}
              >
                <div>الفرع</div>
                <div className="text-center">الطلاب</div>
                <div className="text-center">الأساتذة</div>
                <div className="text-center">تسجيلات جديدة</div>
                <div className="text-center">سجلات الحضور</div>
                <div className="text-center">المهام</div>
              </div>
              {branches.map(b => (
                <div
                  key={b.id}
                  className="grid gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                  style={{ gridTemplateColumns: '1.5fr 80px 80px 100px 100px 80px' }}
                >
                  <div className="font-medium">{b.name}</div>
                  <div className="text-center num">{b.counts.students}</div>
                  <div className="text-center num">{b.counts.teachers}</div>
                  <div className="text-center num text-emerald-700">{b.counts.newStudentsThisYear}</div>
                  <div className="text-center num">{b.counts.attendances}</div>
                  <div className="text-center num">{b.counts.tasks}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task performance comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="w-5 h-5" /> أداء المهام
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '600px' }}>
              <div
                className="grid gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '1.5fr 80px 80px 80px 1fr 80px' }}
              >
                <div>الفرع</div>
                <div className="text-center">الإجمالي</div>
                <div className="text-center">مكتملة</div>
                <div className="text-center">متأخرة</div>
                <div className="text-center">نسبة الإكمال</div>
                <div className="text-center">الحالة</div>
              </div>
              {branches.map(b => (
                <div
                  key={b.id}
                  className="grid gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm items-center"
                  style={{ gridTemplateColumns: '1.5fr 80px 80px 80px 1fr 80px' }}
                >
                  <div className="font-medium">{b.name}</div>
                  <div className="text-center num">{b.counts.tasks}</div>
                  <div className="text-center num text-emerald-700">{b.counts.completedTasks}</div>
                  <div className="text-center num text-red-700">{b.counts.overdueTasks}</div>
                  <div className="px-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.counts.taskCompletionRate >= 70 ? 'bg-emerald-500' :
                            b.counts.taskCompletionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${b.counts.taskCompletionRate}%` }}
                        />
                      </div>
                      <span className="text-xs num font-medium">{b.counts.taskCompletionRate}%</span>
                    </div>
                  </div>
                  <div className="text-center">
                    {b.counts.taskCompletionRate >= 70 ? (
                      <Badge variant="default" className="bg-emerald-600 text-xs">جيد</Badge>
                    ) : b.counts.taskCompletionRate >= 40 ? (
                      <Badge variant="secondary" className="text-xs">متوسط</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">ضعيف</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-600" /> ترتيب حسب المداخيل</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.byIncome.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={i === 0 ? 'default' : 'outline'} className="num w-6 justify-center">{i + 1}</Badge>
                    {r.name}
                  </span>
                  <span className="num text-emerald-700 font-medium">{currency(r.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> ترتيب حسب الرصيد</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.byBalance.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={i === 0 ? 'default' : 'outline'} className="num w-6 justify-center">{i + 1}</Badge>
                    {r.name}
                  </span>
                  <span className={`num font-medium ${r.value >= 0 ? 'text-primary' : 'text-red-700'}`}>{currency(r.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-blue-600" /> ترتيب حسب الطلاب</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.byStudents.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={i === 0 ? 'default' : 'outline'} className="num w-6 justify-center">{i + 1}</Badge>
                    {r.name}
                  </span>
                  <span className="num text-blue-700 font-medium">{r.value} طالب</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> التحليل الذكي للمقارنة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiUsedFallback && (
              <div className="mb-3 p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                تنبيه: تم استخدام التحليل المحلي الاحتياطي (لم يتوفر LLM)
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 text-primary">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mb-1 mt-3">{children}</h3>,
                  p: ({ children }) => <p className="text-sm leading-relaxed mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pr-5 mb-2 text-sm space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pr-5 mb-2 text-sm space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm">{children}</li>,
                  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                  table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
                  th: ({ children }) => <th className="border p-2 bg-muted/50 font-medium text-right">{children}</th>,
                  td: ({ children }) => <td className="border p-2 num">{children}</td>,
                  blockquote: ({ children }) => <blockquote className="border-r-4 border-primary pr-3 text-muted-foreground italic text-xs my-2">{children}</blockquote>,
                }}
              >
                {aiAnalysis}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {!aiAnalysis && !aiLoading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
            <p className="text-sm text-muted-foreground mb-2">
              اضغط على &quot;تحليل ذكي للمقارنة&quot; لإنشاء تقرير مقارنة شامل بالذكاء الاصطناعي
            </p>
            <p className="text-xs text-muted-foreground">
              سيحلل البيانات المالية والأكاديمية لكل الفروع ويقدم توصيات استراتيجية
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Student Filters Tab ============
function StudentFiltersTab() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);

  // Filter states
  const [departmentId, setDepartmentId] = useState('all');
  const [status, setStatus] = useState('all');
  const [gender, setGender] = useState('all');
  const [docFilter, setDocFilter] = useState('all');
  const [practicalFilter, setPracticalFilter] = useState('all');
  const [educationLevel, setEducationLevel] = useState('all');
  const [schoolStream, setSchoolStream] = useState('all');
  const [schoolYear, setSchoolYear] = useState('all');
  const [schoolName, setSchoolName] = useState('');
  const [absenceFilter, setAbsenceFilter] = useState('all');
  const [absenceDays, setAbsenceDays] = useState('3');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [batchMonth, setBatchMonth] = useState('all');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (departmentId !== 'all') params.set('departmentId', departmentId);
    if (status !== 'all') params.set('status', status);
    if (gender !== 'all') params.set('gender', gender);
    if (docFilter !== 'all') params.set('docFilter', docFilter);
    if (practicalFilter !== 'all') params.set('practicalFilter', practicalFilter);
    if (educationLevel !== 'all') params.set('educationLevel', educationLevel);
    if (schoolStream !== 'all') params.set('schoolStream', schoolStream);
    if (schoolYear !== 'all') params.set('schoolYear', schoolYear);
    if (schoolName) params.set('schoolName', schoolName);
    if (absenceFilter !== 'all') params.set('absenceFilter', absenceFilter);
    if (absenceDays) params.set('absenceDays', absenceDays);
    if (batchMonth !== 'all') params.set('batchMonth', batchMonth);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    try {
      const res = await fetch(`/api/reports/student-filters?${params.toString()}`);
      const data = await res.json();
      setStudents(data.students || []);
      setStats(data.stats || null);
      setDepartments(data.departments || []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [departmentId, status, gender, docFilter, practicalFilter, educationLevel, schoolStream, schoolYear, schoolName, absenceFilter, absenceDays, batchMonth, startDate, endDate]);

  // ===== طباعة النتائج المُفلترة =====
  const handlePrintFiltered = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = students.map((s, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.department || '-'}</td>
        <td dir="ltr">${s.phone || '-'}</td>
        <td style="text-align:center">${s.docPhotos ? '✓' : '✗'}</td>
        <td style="text-align:center">${s.docBirthCert ? '✓' : '✗'}</td>
        <td style="text-align:center">${s.docIdCard ? '✓' : '✗'}</td>
        <td style="text-align:center">${s.docPracticalTraining ? '✓' : '✗'}</td>
        <td style="text-align:center">${s.docCertificateReceived ? '✓' : '✗'}</td>
        <td style="text-align:center">${s.status === 'registered' ? 'مسجل' : s.status === 'continuing' ? 'مستمر' : s.status}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الطلاب المُفلتر</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 20px; margin-bottom: 10px; }
          .info { font-size: 14px; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1e3a5f; color: white; padding: 8px; border: 1px solid #ddd; }
          td { padding: 6px 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background: #f9f9f9; }
          .stats { margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 6px; font-size: 13px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>تقرير الطلاب المُفلتر</h1>
        <div class="info">
          التاريخ: ${new Date().toLocaleDateString('ar-DZ')} |
          العدد الإجمالي: ${students.length} طالب
        </div>
        ${stats ? `<div class="stats">
          ${stats.practicalMissing > 0 ? `⚠️ تربص ناقص: ${stats.practicalMissing} | ` : ''}
          ${stats.certNotReceived > 0 ? `⚠️ شهادة لم تُستلم: ${stats.certNotReceived} | ` : ''}
          ${stats.missingDocs > 0 ? `⚠️ مستندات ناقصة: ${stats.missingDocs} | ` : ''}
          ${stats.withAllDocs > 0 ? `✓ مستندات مكتملة: ${stats.withAllDocs}` : ''}
        </div>` : ''}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>القسم</th>
              <th>الهاتف</th>
              <th>صور</th>
              <th>ميلاد</th>
              <th>تعريف</th>
              <th>تربص</th>
              <th>شهادة</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // ===== تصدير النتائج المُفلترة إلى Excel (CSV) =====
  const handleExportCSV = () => {
    const headers = ['#', 'الاسم', 'رقم الطالب', 'القسم', 'الهاتف', 'الجنس', 'الحالة', 'صور', 'شهادة ميلاد', 'بطاقة تعريف', 'شهادة مدرسية', 'شهادة طبية', 'تربص تطبيقي', 'استلم شهادة', 'المؤسسة', 'الطور', 'الشعبة', 'السنة'];
    const rows = students.map((s, i) => [
      i + 1,
      `"${s.name}"`,
      `"${s.studentNumber || ''}"`,
      `"${s.department || ''}"`,
      `"${s.phone || ''}"`,
      `"${s.gender || ''}"`,
      `"${s.status}"`,
      s.docPhotos ? 'نعم' : 'لا',
      s.docBirthCert ? 'نعم' : 'لا',
      s.docIdCard ? 'نعم' : 'لا',
      s.docSchoolCert ? 'نعم' : 'لا',
      s.docMedicalCert ? 'نعم' : 'لا',
      s.docPracticalTraining ? 'نعم' : 'لا',
      s.docCertificateReceived ? 'نعم' : 'لا',
      `"${s.schoolName || ''}"`,
      `"${s.educationLevel || ''}"`,
      `"${s.schoolStream || ''}"`,
      `"${s.schoolYear || ''}"`,
    ].join(','));

    // BOM for Arabic support in Excel
    const csv = '\ufeff' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-filtered-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ar-DZ') : '-';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="w-5 h-5" /> فلاتر مفصلة للطلاب</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">القسم</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الحالة</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="registered">مسجل</SelectItem>
                  <SelectItem value="continuing">مستمر</SelectItem>
                  <SelectItem value="abandoned">متخلي</SelectItem>
                  <SelectItem value="graduated">متخرج</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الجنس</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المستندات</Label>
              <Select value={docFilter} onValueChange={setDocFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستندات</SelectItem>
                  <SelectItem value="photos_missing">صور ناقصة</SelectItem>
                  <SelectItem value="photos_done">صور مكتملة</SelectItem>
                  <SelectItem value="birth_missing">شهادة ميلاد ناقصة</SelectItem>
                  <SelectItem value="birth_done">شهادة ميلاد مكتملة</SelectItem>
                  <SelectItem value="idcard_missing">بطاقة تعريف ناقصة</SelectItem>
                  <SelectItem value="idcard_done">بطاقة تعريف مكتملة</SelectItem>
                  <SelectItem value="school_missing">شهادة مدرسية ناقصة</SelectItem>
                  <SelectItem value="school_done">شهادة مدرسية مكتملة</SelectItem>
                  <SelectItem value="medical_missing">شهادة طبية ناقصة</SelectItem>
                  <SelectItem value="medical_done">شهادة طبية مكتملة</SelectItem>
                  <SelectItem value="ts_file_complete">ملف التقني سامي مكتمل</SelectItem>
                  <SelectItem value="ts_file_incomplete">ملف التقني سامي ناقص</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Medical + Support Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs text-red-700">الدورات الطبية</Label>
              <Select value={practicalFilter} onValueChange={setPracticalFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="practical_done">أكمل التربص التطبيقي</SelectItem>
                  <SelectItem value="practical_missing">لم يكمل التربص التطبيقي</SelectItem>
                  <SelectItem value="cert_received">استلم الشهادة</SelectItem>
                  <SelectItem value="cert_not_received">لم يستلم الشهادة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-700">الطور (الدعم المدرسي)</Label>
              <Select value={educationLevel} onValueChange={setEducationLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="ابتدائي">ابتدائي</SelectItem>
                  <SelectItem value="متوسط">متوسط</SelectItem>
                  <SelectItem value="ثانوي">ثانوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-700">الشعبة</Label>
              <Select value={schoolStream} onValueChange={setSchoolStream}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="علوم تجريبية">علوم تجريبية</SelectItem>
                  <SelectItem value="رياضيات">رياضيات</SelectItem>
                  <SelectItem value="تقني رياضي">تقني رياضي</SelectItem>
                  <SelectItem value="تسيير واقتصاد">تسيير واقتصاد</SelectItem>
                  <SelectItem value="لغات">لغات</SelectItem>
                  <SelectItem value="آداب وفلسفة">آداب وفلسفة</SelectItem>
                  <SelectItem value="طرائق">طرائق</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-700">السنة</Label>
              <Select value={schoolYear} onValueChange={setSchoolYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="الأولى">الأولى</SelectItem>
                  <SelectItem value="الثانية">الثانية</SelectItem>
                  <SelectItem value="الثالثة">الثالثة</SelectItem>
                  <SelectItem value="الرابعة">الرابعة</SelectItem>
                  <SelectItem value="الخامسة">الخامسة</SelectItem>
                  <SelectItem value="السادسة">السادسة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-purple-700">اسم المؤسسة</Label>
            <Input placeholder="ابحث باسم المؤسسة..." value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Batch Filter (التقني سامي) */}
      <Card className="border-2 border-blue-200 bg-blue-50/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-blue-700">
            <CalendarClock className="w-5 h-5" /> فلترة الدفعة (التقني سامي)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-blue-700">الدفعة (شهر/سنة)</Label>
              <Input
                type="month"
                value={batchMonth === 'all' ? '' : batchMonth}
                onChange={(e) => setBatchMonth(e.target.value || 'all')}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-blue-700">&nbsp;</Label>
              <Button variant="outline" size="sm" onClick={() => setBatchMonth('all')}>
                إظهار كل الدفعات
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Absence Filters */}
      <Card className="border-2 border-red-200 bg-red-50/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" /> فلترة الغيابات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">نوع الغياب</Label>
              <Select value={absenceFilter} onValueChange={setAbsenceFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="never_attended">لم يحضر إطلاقاً (0 سجل)</SelectItem>
                  <SelectItem value="frequent_absent">غياب كثير (أقل من الحد الأدنى)</SelectItem>
                  <SelectItem value="good_attendance">حضور منتظم (أكثر من الحد)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الحد الأدنى لسجلات الحضور</Label>
              <Input type="number" value={absenceDays} onChange={(e) => setAbsenceDays(e.target.value)} dir="ltr" placeholder="3" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الفترة (اختياري)</Label>
              <div className="flex gap-1">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">الإجمالي</p><p className="text-xl font-bold num text-blue-700">{stats.total}</p></CardContent></Card>
          {stats.practicalMissing > 0 && (
            <Card className="border-red-200"><CardContent className="p-3"><p className="text-xs text-muted-foreground">تربص ناقص</p><p className="text-xl font-bold num text-red-700">{stats.practicalMissing}</p></CardContent></Card>
          )}
          {stats.certNotReceived > 0 && (
            <Card className="border-amber-200"><CardContent className="p-3"><p className="text-xs text-muted-foreground">شهادة لم تُستلم</p><p className="text-xl font-bold num text-amber-700">{stats.certNotReceived}</p></CardContent></Card>
          )}
          {stats.missingDocs > 0 && (
            <Card className="border-orange-200"><CardContent className="p-3"><p className="text-xs text-muted-foreground">مستندات ناقصة</p><p className="text-xl font-bold num text-orange-700">{stats.missingDocs}</p></CardContent></Card>
          )}
          {stats.neverAttended > 0 && (
            <Card className="border-red-300"><CardContent className="p-3"><p className="text-xs text-muted-foreground">لم يحضر إطلاقاً</p><p className="text-xl font-bold num text-red-700">{stats.neverAttended}</p></CardContent></Card>
          )}
          {stats.frequentAbsent > 0 && (
            <Card className="border-orange-300"><CardContent className="p-3"><p className="text-xs text-muted-foreground">غياب كثير</p><p className="text-xl font-bold num text-orange-700">{stats.frequentAbsent}</p></CardContent></Card>
          )}
          {stats.goodAttendance > 0 && (
            <Card className="border-emerald-200"><CardContent className="p-3"><p className="text-xs text-muted-foreground">حضور منتظم</p><p className="text-xl font-bold num text-emerald-700">{stats.goodAttendance}</p></CardContent></Card>
          )}
        </div>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">النتائج ({students.length} طالب)</CardTitle>
            {!loading && students.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintFiltered}>
                  <Printer className="w-4 h-4 ml-1" /> طباعة
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 ml-1" /> Excel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : students.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">لا توجد نتائج مطابقة</p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: '900px' }}>
                {/* Header */}
                <div className="grid gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-xs" style={{ gridTemplateColumns: '30px 1fr 100px 120px 60px 60px 60px 60px 60px 60px 60px' }}>
                  <div>#</div>
                  <div>الاسم</div>
                  <div>القسم</div>
                  <div>الهاتف</div>
                  <div className="text-center">صور</div>
                  <div className="text-center">ميلاد</div>
                  <div className="text-center">تعريف</div>
                  <div className="text-center">تربص</div>
                  <div className="text-center">شهادة</div>
                  <div className="text-center">حضور</div>
                  <div className="text-center">الحالة</div>
                </div>
                {/* Rows */}
                {students.map((s, i) => (
                  <div key={s.id} className="grid gap-2 px-3 py-2 border-b hover:bg-muted/50 text-xs items-center" style={{ gridTemplateColumns: '30px 1fr 100px 120px 60px 60px 60px 60px 60px 60px 60px' }}>
                    <div className="num text-muted-foreground">{i + 1}</div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-muted-foreground">{s.department || '-'}</div>
                    <div className="num text-muted-foreground" dir="ltr">{s.phone || '-'}</div>
                    <div className="text-center">{s.docPhotos ? '✅' : '❌'}</div>
                    <div className="text-center">{s.docBirthCert ? '✅' : '❌'}</div>
                    <div className="text-center">{s.docIdCard ? '✅' : '❌'}</div>
                    <div className="text-center">{s.docPracticalTraining ? '✅' : '❌'}</div>
                    <div className="text-center">{s.docCertificateReceived ? '✅' : '❌'}</div>
                    <div className="text-center num font-bold" style={{ color: (s.attendanceCount || 0) === 0 ? '#dc2626' : (s.attendanceCount || 0) < 3 ? '#f97316' : '#16a34a' }}>{s.attendanceCount || 0}</div>
                    <div className="text-center">
                      <Badge variant={s.status === 'registered' ? 'default' : s.status === 'continuing' ? 'secondary' : 'outline'} className="text-xs">
                        {s.status === 'registered' ? 'مسجل' : s.status === 'continuing' ? 'مستمر' : s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Student Attendance Detail Tab ============
function StudentAttendanceTab() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Search students
  useEffect(() => {
    if (!search.trim() || selectedStudent) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&limit=20`);
        const data = await res.json();
        setSearchResults(data.students || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedStudent]);

  // Load attendance when student selected
  const loadAttendance = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/student-attendance?studentId=${studentId}`);
      const data = await res.json();
      setAttendanceData(data);
    } catch {
      setAttendanceData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = (s: any) => {
    setSelectedStudent(s);
    setSearch('');
    setSearchResults([]);
    loadAttendance(s.id);
  };

  const handleClear = () => {
    setSelectedStudent(null);
    setAttendanceData(null);
    setSearch('');
  };

  return (
    <div className="space-y-4">
      {/* Student selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5" /> تفصيل حضور طالب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedStudent ? (
            <>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن طالب بالاسم أو الرقم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      className="w-full p-3 text-right hover:bg-muted/50 flex items-center justify-between"
                      onClick={() => handleSelectStudent(s)}
                    >
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground num">{s.studentNumber || '—'} • {s.department?.name || '—'} • {s.phone || '—'}</p>
                      </div>
                      <User className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-bold">{selectedStudent.name}</p>
                <p className="text-xs text-muted-foreground num">
                  {selectedStudent.studentNumber || '—'} • {selectedStudent.department?.name || '—'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <X className="w-4 h-4 ml-1" /> تغيير الطالب
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">جاري تحميل بيانات الحضور...</p>
        </div>
      )}

      {/* Stats */}
      {attendanceData && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Card className="border-blue-200">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">إجمالي الحصص</p>
                <p className="text-xl font-bold num text-blue-700">{attendanceData.stats.totalSessions}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">إجمالي الساعات</p>
                <p className="text-xl font-bold num text-emerald-700">{attendanceData.stats.totalHours}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-200">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">نسبة الحضور</p>
                <p className="text-xl font-bold num text-purple-700">{attendanceData.stats.attendanceRate}%</p>
              </CardContent>
            </Card>
            {attendanceData.stats.expectedSessions > 0 && (
              <Card className="border-amber-200">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">الحصص المتوقعة</p>
                  <p className="text-xl font-bold num text-amber-700">{attendanceData.stats.expectedSessions}</p>
                </CardContent>
              </Card>
            )}
            {attendanceData.stats.absenceCount > 0 && (
              <Card className="border-red-200">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">الغيابات</p>
                  <p className="text-xl font-bold num text-red-700">{attendanceData.stats.absenceCount}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">إجمالي الدقائق</p>
                <p className="text-xl font-bold num text-muted-foreground">{attendanceData.stats.totalMinutes}</p>
              </CardContent>
            </Card>
          </div>

          {/* By Month */}
          {attendanceData.byMonth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الحضور حسب الشهر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attendanceData.byMonth.map((m: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border">
                      <Badge variant="outline" className="num">{m.month}</Badge>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium num">{m.sessions} حصة</span>
                          <span className="text-muted-foreground num">{m.hours} ساعة</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, m.sessions * 10)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed records */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">سجلات الحضور ({attendanceData.attendances.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 ml-1" /> طباعة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {attendanceData.attendances.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">لا توجد سجلات حضور لهذا الطالب</p>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: '700px' }}>
                    {/* Header */}
                    <div className="grid gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-xs" style={{ gridTemplateColumns: '100px 1fr 80px 80px 1fr 80px' }}>
                      <div>التاريخ</div>
                      <div>المادة</div>
                      <div className="text-center">البداية</div>
                      <div className="text-center">النهاية</div>
                      <div>الأستاذ</div>
                      <div className="text-center">المدة</div>
                    </div>
                    {/* Rows */}
                    {attendanceData.attendances.map((a: any, i: number) => (
                      <div key={a.id} className="grid gap-2 px-3 py-2 border-b hover:bg-muted/50 text-xs items-center" style={{ gridTemplateColumns: '100px 1fr 80px 80px 1fr 80px' }}>
                        <div className="num">{a.date}</div>
                        <div className="font-medium">{a.courseName || '—'}</div>
                        <div className="text-center num">{a.startTime || '—'}</div>
                        <div className="text-center num">{a.endTime || '—'}</div>
                        <div className="text-muted-foreground">{a.teacherName || '—'}</div>
                        <div className="text-center num font-bold">{a.durationMinutes ? `${a.durationMinutes}د` : '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!selectedStudent && !loading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <User className="w-12 h-12 mx-auto mb-3 text-primary opacity-50" />
            <p className="text-sm text-muted-foreground mb-1">ابحث عن طالب لعرض تفصيل حضوره</p>
            <p className="text-xs text-muted-foreground">ستظهر: عدد الحصص، الساعات، نسبة الحضور، الغيابات، وسجل كامل بكل حصة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
