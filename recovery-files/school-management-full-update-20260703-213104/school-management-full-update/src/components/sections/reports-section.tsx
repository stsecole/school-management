'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Users, GraduationCap, BookOpen, CalendarCheck, ListTodo,
  Wallet, TrendingUp, TrendingDown, Sparkles, Loader2, Award, AlertCircle,
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
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          {isDirector && <TabsTrigger value="financial">المالية</TabsTrigger>}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>الأستاذ</TableHead>
                    <TableHead className="text-center">عدد الجلسات</TableHead>
                    <TableHead className="text-center">إجمالي الحضور</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topTeachers.map((t, i) => (
                    <TableRow key={t.teacherId}>
                      <TableCell className="text-center num">
                        <Badge variant={i === 0 ? 'default' : 'secondary'}>{i + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.teacherName}</TableCell>
                      <TableCell className="text-center num">{t.sessions}</TableCell>
                      <TableCell className="text-center num">{t.totalAttendees}</TableCell>
                    </TableRow>
                  ))}
                  {data.topTeachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        لا توجد بيانات
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    <TableHead className="text-center">مكتملة</TableHead>
                    <TableHead className="text-center">معلقة</TableHead>
                    <TableHead className="text-center">متأخرة</TableHead>
                    <TableHead className="text-center">نسبة الإكمال</TableHead>
                    <TableHead className="text-center">متوسط الأيام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tasks.employeeRanking.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center num">
                        <Badge variant={i === 0 ? 'default' : 'secondary'}>{i + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-center num">{e.total}</TableCell>
                      <TableCell className="text-center num text-emerald-600">{e.completed}</TableCell>
                      <TableCell className="text-center num text-orange-600">{e.pending}</TableCell>
                      <TableCell className="text-center num text-red-600">{e.overdue}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${e.completionRate >= 70 ? 'bg-emerald-500' : e.completionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${e.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium num">{e.completionRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center num">{e.avgDays}</TableCell>
                    </TableRow>
                  ))}
                  {data.tasks.employeeRanking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        لا توجد بيانات
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
