'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, GraduationCap, Wallet, TrendingUp, TrendingDown, AlertCircle,
  Clock, CheckCircle2, BarChart3, PieChart as PieIcon, Activity, Download,
  RefreshCw, Calendar, UserPlus, FileText, Receipt, CalendarCheck,
  Award, Target, Zap, Bell, ChevronLeft, ArrowUpRight, ArrowDownRight,
  Building2, BookOpen, AlertTriangle, Sparkles, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  RadialBarChart, RadialBar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { AnalyticsCharts } from '@/components/sections/analytics-charts';

interface DashboardData {
  period: string;
  departmentId: string;
  kpis: {
    students: { current: number; change: number; new: number; label: string };
    teachers: { current: number; change: number; new: number; label: string };
    attendance: { current: number; change: number; new: number; label: string };
    income: {
      current: number; change: number; new: number; label: string;
      expenses: number; profit: number;
    } | null;
  };
  alerts: { type: 'danger' | 'warning' | 'info'; text: string; count: number }[];
  charts: {
    attendance: { name: string; المجموع: number; ذكور: number; إناث: number }[];
    departments: { name: string; الطلاب: number; الأساتذة: number; الدورات: number }[];
    teachers: { name: string; ساعات: number; جلسات: number; طلاب: number }[];
    income: { name: string; المداخيل: number }[];
    lowAttendance: { name: string; avg: number; sessions: number }[];
  };
  recentPayments: any[];
  lateInstallments: any[];
  departments: { id: string; name: string; students: number; teachers: number; courses: number }[];
  isDirector: boolean;
  lastUpdate: string;
}

const CHART_COLORS = ['#0f766e', '#0891b2', '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];

interface InteractiveDashboardProps {
  user?: { name: string; role: string };
  onNavigate?: (section: string) => void;
}

export function InteractiveDashboard({ user, onNavigate }: InteractiveDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [departmentId, setDepartmentId] = useState('all');
  const [activeTab, setActiveTab] = useState('executive');
  const [chartTypes, setChartTypes] = useState<Record<string, 'bar' | 'line' | 'area' | 'pie'>>({
    attendance: 'area',
    income: 'bar',
    departments: 'pie',
    teachers: 'bar',
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (departmentId !== 'all') params.set('departmentId', departmentId);
      const res = await fetch(`/api/dashboard?${params}`);
      const d = await res.json();
      setData(d);
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [period, departmentId, toast]);

  useEffect(() => { load(); }, [load]);

  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

  const exportPDF = () => {
    window.print();
    toast({ title: 'تم', description: 'استخدم خيار "حفظ كـ PDF" في نافذة الطباعة' });
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32" /></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-64" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12">تعذر تحميل البيانات</div>;

  return (
    <div className="space-y-6">
      {/* رأس التحكم */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-l from-primary to-primary/80 text-primary-foreground">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            لوحة التحكم التفاعلية
          </h2>
          <p className="text-sm opacity-80 mt-1">
            مرحباً {user?.name} — آخر تحديث: {new Date(data.lastUpdate).toLocaleTimeString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* فلتر الفترة */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
              <Calendar className="w-4 h-4 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">الأسبوع</SelectItem>
              <SelectItem value="month">الشهر</SelectItem>
              <SelectItem value="year">السنة</SelectItem>
            </SelectContent>
          </Select>

          {/* فلتر القسم */}
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
              <Building2 className="w-4 h-4 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {data.departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={load} className="bg-white/10 text-white hover:bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportPDF} className="bg-white/10 text-white hover:bg-white/20">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* التنبيهات */}
      {data.alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.alerts.map((a, i) => {
            const colors = {
              danger: 'bg-red-50 border-red-200 text-red-700',
              warning: 'bg-amber-50 border-amber-200 text-amber-700',
              info: 'bg-blue-50 border-blue-200 text-blue-700',
            };
            const icons = { danger: AlertCircle, warning: Clock, info: Bell };
            const Icon = icons[a.type];
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${colors[a.type]}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium flex-1">{a.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* التبويبات */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="executive" className="gap-1">
            <BarChart3 className="w-4 h-4" /> تنفيذية
          </TabsTrigger>
          <TabsTrigger value="realtime" className="gap-1">
            <Activity className="w-4 h-4" /> لحظية
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1">
            <Building2 className="w-4 h-4" /> الأقسام
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1">
            <Layers className="w-4 h-4" /> تحليلات
          </TabsTrigger>
        </TabsList>

        {/* ===== لوحة تنفيذية ===== */}
        <TabsContent value="executive" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="الطلاب"
              value={data.kpis.students.current}
              change={data.kpis.students.change}
              subtext={`+${data.kpis.students.new} جديد`}
              icon={Users}
              gradient="from-blue-500 to-blue-600"
              onClick={() => onNavigate?.('students')}
            />
            <KPICard
              label="الأساتذة"
              value={data.kpis.teachers.current}
              change={0}
              icon={GraduationCap}
              gradient="from-emerald-500 to-emerald-600"
              onClick={() => onNavigate?.('teachers')}
            />
            <KPICard
              label="سجلات الحضور"
              value={data.kpis.attendance.current}
              change={data.kpis.attendance.change}
              icon={CalendarCheck}
              gradient="from-purple-500 to-purple-600"
              onClick={() => onNavigate?.('attendance')}
            />
            {data.kpis.income && (
              <KPICard
                label="المداخيل"
                value={data.kpis.income.current}
                change={data.kpis.income.change}
                subtext={`${data.kpis.income.new} عملية`}
                icon={Wallet}
                gradient="from-emerald-500 to-green-600"
                isCurrency
                onClick={() => onNavigate?.('finance')}
              />
            )}
          </div>

          {/* صف الرسوم الأولى */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* رسم الحضور */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    الحضور عبر الزمن
                  </CardTitle>
                  <ChartTypeSwitcher
                    value={chartTypes.attendance}
                    onChange={(t) => setChartTypes({ ...chartTypes, attendance: t })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ChartRenderer
                  type={chartTypes.attendance}
                  data={data.charts.attendance}
                  dataKeys={['المجموع', 'ذكور', 'إناث']}
                  colors={['#0f766e', '#0891b2', '#c026d3']}
                  height={280}
                />
              </CardContent>
            </Card>

            {/* توزيع الطلاب */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-purple-600" />
                    توزيع الطلاب
                  </CardTitle>
                  <ChartTypeSwitcher
                    value={chartTypes.departments}
                    onChange={(t) => setChartTypes({ ...chartTypes, departments: t })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ChartRenderer
                  type={chartTypes.departments}
                  data={data.charts.departments}
                  dataKeys={['الطلاب']}
                  nameKey="name"
                  colors={CHART_COLORS}
                  height={280}
                />
              </CardContent>
            </Card>
          </div>

          {/* صف الرسوم الثانية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* المداخيل */}
            {data.kpis.income && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      المداخيل اليومية
                    </CardTitle>
                    <ChartTypeSwitcher
                      value={chartTypes.income}
                      onChange={(t) => setChartTypes({ ...chartTypes, income: t })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartRenderer
                    type={chartTypes.income}
                    data={data.charts.income}
                    dataKeys={['المداخيل']}
                    colors={['#10b981']}
                    height={240}
                    currency
                  />
                </CardContent>
              </Card>
            )}

            {/* أداء الأساتذة */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600" />
                    أداء الأساتذة
                  </CardTitle>
                  <ChartTypeSwitcher
                    value={chartTypes.teachers}
                    onChange={(t) => setChartTypes({ ...chartTypes, teachers: t })}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ChartRenderer
                  type={chartTypes.teachers}
                  data={data.charts.teachers}
                  dataKeys={['ساعات']}
                  colors={['#f59e0b']}
                  height={240}
                />
              </CardContent>
            </Card>
          </div>

          {/* الملخص المالي */}
          {data.kpis.income && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FinanceMiniCard label="المداخيل" value={data.kpis.income.current} color="emerald" icon={TrendingUp} />
              <FinanceMiniCard label="المصاريف" value={data.kpis.income.expenses} color="red" icon={TrendingDown} />
              <FinanceMiniCard
                label="صافي الربح"
                value={data.kpis.income.profit}
                color={data.kpis.income.profit >= 0 ? 'emerald' : 'red'}
                icon={data.kpis.income.profit >= 0 ? TrendingUp : TrendingDown}
              />
              <FinanceMiniCard
                label="هامش الربح"
                value={data.kpis.income.current > 0
                  ? Math.round((data.kpis.income.profit / data.kpis.income.current) * 100) + '%'
                  : '0%'}
                color="primary"
                icon={Target}
                isText
              />
            </div>
          )}
        </TabsContent>

        {/* ===== لوحة لحظية ===== */}
        <TabsContent value="realtime" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-blue-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">حضور اليوم</span>
                  <CalendarCheck className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-600">{data.kpis.attendance.new}</p>
                <p className="text-xs text-muted-foreground mt-1">جلسة في {period === 'today' ? 'اليوم' : 'الفترة'}</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-emerald-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">مداخيل اليوم</span>
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-3xl font-bold text-emerald-600">
                  {data.kpis.income ? currency(data.kpis.income.current).replace(' دج', '') : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{data.kpis.income?.new || 0} عملية دفع</p>
              </CardContent>
            </Card>
            <Card className="border-2 border-purple-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">تسجيلات جديدة</span>
                  <UserPlus className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-purple-600">{data.kpis.students.new}</p>
                <p className="text-xs text-muted-foreground mt-1">طالب جديد</p>
              </CardContent>
            </Card>
          </div>

          {/* آخر الدفعات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                آخر الدفعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentPayments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">لا توجد دفعات في هذه الفترة</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {data.recentPayments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.paymentLabel || p.paymentType} • {p.receiptNumber}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-emerald-600">{currency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* الأقساط المتأخرة */}
          {data.lateInstallments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  الأقساط المتأخرة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.lateInstallments.map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/30">
                      <div>
                        <p className="font-medium text-sm">{i.student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          استحقاق: {new Date(i.expectedDate).toLocaleDateString('fr-FR')}
                          {i.student.phone && ` • ${i.student.phone}`}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {(i.expectedAmount - i.paidAmount).toLocaleString('ar-DZ')} دج
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* الحضور المنخفض */}
          {data.charts.lowAttendance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  مواد بحضور منخفض
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.charts.lowAttendance.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm font-medium">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{m.sessions} جلسة</Badge>
                        <Badge variant="destructive">متوسط {m.avg}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== لوحة الأقسام ===== */}
        <TabsContent value="departments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.departments.map((dept, i) => (
              <Card key={dept.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => setDepartmentId(dept.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="p-2.5 rounded-xl text-white"
                      style={{ background: `linear-gradient(135deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})` }}
                    >
                      <BookOpen className="w-5 h-5" />
                    </div>
                    {departmentId === dept.id && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{dept.name}</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{dept.students}</p>
                      <p className="text-xs text-muted-foreground">طلاب</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{dept.teachers}</p>
                      <p className="text-xs text-muted-foreground">أساتذة</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{dept.courses}</p>
                      <p className="text-xs text-muted-foreground">دورات</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* رسم مقارنة الأقسام */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                مقارنة شاملة بين الأقسام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={data.charts.departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="الطلاب" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الأساتذة" fill="#0891b2" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الدورات" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* جدول تفصيلي */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">التفاصيل الكاملة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right p-2">القسم</th>
                      <th className="text-center p-2">الطلاب</th>
                      <th className="text-center p-2">الأساتذة</th>
                      <th className="text-center p-2">الدورات</th>
                      <th className="text-center p-2">المعدل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charts.departments.map((d, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{d.name}</td>
                        <td className="p-2 text-center">{d.الطلاب}</td>
                        <td className="p-2 text-center">{d.الأساتذة}</td>
                        <td className="p-2 text-center">{d.الدورات}</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min((d.الطلاب / Math.max(...data.charts.departments.map(x => x.الطلاب), 1)) * 100, 100)}%`,
                                  background: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== لوحة تحليلات متقدمة ===== */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsCharts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== مكونات مساعدة =====

function KPICard({ label, value, change, subtext, icon: Icon, gradient, isCurrency, onClick }: {
  label: string;
  value: number;
  change: number;
  subtext?: string;
  icon: any;
  gradient: string;
  isCurrency?: boolean;
  onClick?: () => void;
}) {
  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n);
  return (
    <Card className={`cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] ${onClick ? '' : ''}`} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
            <Icon className="w-5 h-5" />
          </div>
          {change !== 0 && (
            <Badge variant={change > 0 ? 'secondary' : 'destructive'} className="gap-1">
              {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(change)}%
            </Badge>
          )}
        </div>
        <p className="text-3xl font-bold mb-1">
          {isCurrency ? currency(value) : value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subtext && <p className="text-xs text-emerald-600 mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function FinanceMiniCard({ label, value, color, icon: Icon, isText }: {
  label: string;
  value: number | string;
  color: 'emerald' | 'red' | 'primary';
  icon: any;
  isText?: boolean;
}) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    red: 'border-red-200 bg-red-50/50 text-red-700',
    primary: 'border-primary bg-primary/5 text-primary',
  };
  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';
  return (
    <Card className={colorMap[color]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className="w-4 h-4 opacity-60" />
        </div>
        <p className={`text-lg font-bold ${colorMap[color].split(' ').find(c => c.startsWith('text-'))}`}>
          {isText ? value : currency(value as number)}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartTypeSwitcher({ value, onChange }: {
  value: 'bar' | 'line' | 'area' | 'pie';
  onChange: (v: 'bar' | 'line' | 'area' | 'pie') => void;
}) {
  const types: { id: 'bar' | 'line' | 'area' | 'pie'; icon: any }[] = [
    { id: 'bar', icon: BarChart3 },
    { id: 'line', icon: Activity },
    { id: 'area', icon: TrendingUp },
    { id: 'pie', icon: PieIcon },
  ];
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-muted">
      {types.map(t => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`p-1.5 rounded ${value === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background'}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function ChartRenderer({ type, data, dataKeys, colors, nameKey, height, currency: isCurrency }: {
  type: 'bar' | 'line' | 'area' | 'pie';
  data: any[];
  dataKeys: string[];
  colors: string[];
  nameKey?: string;
  height: number;
  currency?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height }}>
        <BarChart3 className="w-12 h-12 mb-2 opacity-30" />
        <p className="text-sm">لا توجد بيانات</p>
      </div>
    );
  }

  const tooltipFormatter = (v: number) =>
    isCurrency ? new Intl.NumberFormat('ar-DZ').format(v) + ' دج' : v;

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey={dataKeys[0]} nameKey={nameKey || 'name'} cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={tooltipFormatter} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={tooltipFormatter} />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
          {dataKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            {dataKeys.map((k, i) => (
              <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[i]} stopOpacity={0.8} />
                <stop offset="95%" stopColor={colors[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={tooltipFormatter} />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
          {dataKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={colors[i]} fill={`url(#grad-${k})`} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={tooltipFormatter} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px' }} />}
        {dataKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={colors[i]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
