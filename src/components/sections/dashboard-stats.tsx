'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Users, GraduationCap, BookOpen, Briefcase, Wallet, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle2, Clock, Calendar, FileText, UserPlus, Receipt,
  BarChart3, Activity, Bell, ChevronLeft, Sparkles, Target, Zap, Award,
  CalendarCheck, MessageCircle, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

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

const CHART_COLORS = ['#0f766e', '#0891b2', '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#ea580c', '#ca8a04'];

interface DashboardStatsProps {
  user?: { name: string; role: string };
  onNavigate?: (section: string) => void;
}

export function DashboardStats({ user, onNavigate }: DashboardStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-64" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return <div className="text-center py-12 text-muted-foreground">تعذر تحميل الإحصائيات</div>;

  const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';
  const greeting = (() => {
    const h = currentTime.getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    return 'مساء الخير';
  })();

  const today = currentTime.toLocaleDateString('ar-DZ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // حسابات إضافية
  const totalStudents = stats.counts.students || 1;
  const attendanceRate = stats.counts.attendances > 0
    ? Math.round((stats.counts.attendances / (totalStudents * 30)) * 100)
    : 0;
  const taskCompletionRate = stats.counts.tasks > 0
    ? Math.round(((stats.counts.tasks - stats.counts.pendingTasks) / stats.counts.tasks) * 100)
    : 0;

  // تنبيهات
  const alerts: { type: 'warning' | 'danger' | 'info'; text: string; icon: any }[] = [];
  if (stats.counts.overdueTasks > 0) {
    alerts.push({
      type: 'danger',
      text: `${stats.counts.overdueTasks} مهمة متأخرة تحتاج انتباهك`,
      icon: AlertCircle,
    });
  }
  if (stats.counts.pendingTasks > 5) {
    alerts.push({
      type: 'warning',
      text: `${stats.counts.pendingTasks} مهام معلقة`,
      icon: Clock,
    });
  }
  if (stats.finance && stats.finance.balance < 0) {
    alerts.push({
      type: 'danger',
      text: `الرصيد سالك: ${currency(stats.finance.balance)}`,
      icon: TrendingDown,
    });
  }

  // اختصارات سريعة
  const quickActions = [
    { label: 'طالب جديد', icon: UserPlus, color: 'bg-blue-500', section: 'students' },
    { label: 'تسجيل', icon: FileText, color: 'bg-cyan-500', section: 'registrations' },
    { label: 'دفعة', icon: Receipt, color: 'bg-emerald-500', section: 'finance' },
    { label: 'حضور', icon: CalendarCheck, color: 'bg-purple-500', section: 'attendance' },
    { label: 'رسالة', icon: MessageCircle, color: 'bg-green-500', section: 'whatsapp' },
    { label: 'استيراد', icon: FileSpreadsheet, color: 'bg-amber-500', section: 'import' },
  ];

  // بيانات الرسوم البيانية
  const attendanceData = stats.attendanceByMonth.map(m => ({
    name: m.month,
    المجموع: m.total,
    ذكور: m.male,
    إناث: m.female,
  }));

  const financeData = stats.paymentsByMonth.map(m => ({
    name: m.month,
    المداخيل: m.income,
    المصاريف: m.expense,
  }));

  const departmentData = stats.departments.map((d: any) => ({
    name: d.name,
    الطلاب: d._count.students,
  })).filter((d: any) => d.الطلاب > 0);

  return (
    <div className="space-y-6">
      {/* رأس ترحيبي */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary via-primary to-primary/80 text-primary-foreground p-6">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full translate-x-24 translate-y-24" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm opacity-90">{greeting}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">{user?.name || 'المدير'} 👋</h1>
            <p className="text-sm opacity-80">{today}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
              <p className="text-xs opacity-80">الطلاب</p>
              <p className="text-xl font-bold">{stats.counts.students}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
              <p className="text-xs opacity-80">الأساتذة</p>
              <p className="text-xl font-bold">{stats.counts.teachers}</p>
            </div>
            {stats.finance && (
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 text-center">
                <p className="text-xs opacity-80">الرصيد</p>
                <p className="text-xl font-bold">{currency(stats.finance.balance).replace(' دج', '')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* التنبيهات */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            const colors = {
              danger: 'bg-red-50 border-red-200 text-red-800',
              warning: 'bg-amber-50 border-amber-200 text-amber-800',
              info: 'bg-blue-50 border-blue-200 text-blue-800',
            };
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${colors[a.type]}`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium flex-1">{a.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* اختصارات سريعة */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> اختصارات سريعة
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((a, i) => {
            const Icon = a.icon;
            return (
              <button
                key={i}
                onClick={() => onNavigate?.(a.section)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/30 transition-all hover:scale-105"
              >
                <div className={`p-2.5 rounded-xl ${a.color} text-white`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الطلاب"
          value={stats.counts.students}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          trend={stats.recentStudents.length > 0 ? `+${stats.recentStudents.length} جديد` : undefined}
          onClick={() => onNavigate?.('students')}
        />
        <StatCard
          label="الأساتذة"
          value={stats.counts.teachers}
          icon={GraduationCap}
          gradient="from-emerald-500 to-emerald-600"
          onClick={() => onNavigate?.('teachers')}
        />
        <StatCard
          label="التسجيلات"
          value={stats.counts.registrations}
          icon={FileText}
          gradient="from-cyan-500 to-cyan-600"
          onClick={() => onNavigate?.('registrations')}
        />
        <StatCard
          label="سجلات الحضور"
          value={stats.counts.attendances}
          icon={CalendarCheck}
          gradient="from-purple-500 to-purple-600"
          onClick={() => onNavigate?.('attendance')}
        />
      </div>

      {/* البطاقات الثانوية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat
          label="الأقسام"
          value={stats.counts.departments}
          icon={BookOpen}
          color="text-amber-600"
          onClick={() => onNavigate?.('departments')}
        />
        <MiniStat
          label="الدورات"
          value={stats.counts.courses}
          icon={Briefcase}
          color="text-pink-600"
        />
        <MiniStat
          label="مهام معلقة"
          value={stats.counts.pendingTasks}
          icon={Clock}
          color="text-orange-600"
          alert={stats.counts.pendingTasks > 0}
          onClick={() => onNavigate?.('tasks')}
        />
        <MiniStat
          label="مهام متأخرة"
          value={stats.counts.overdueTasks}
          icon={AlertCircle}
          color="text-red-600"
          alert={stats.counts.overdueTasks > 0}
          onClick={() => onNavigate?.('tasks')}
        />
      </div>

      {/* الملخص المالي - للمدير فقط */}
      {stats.finance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FinanceCard
            label="إجمالي المداخيل"
            value={currency(stats.finance.totalIncome)}
            icon={TrendingUp}
            color="emerald"
            trend="up"
          />
          <FinanceCard
            label="رواتب الأساتذة"
            value={currency(stats.finance.totalTeacherExpense)}
            icon={GraduationCap}
            color="red"
            trend="down"
          />
          <FinanceCard
            label="مصاريف ثانوية"
            value={currency(stats.finance.totalSecondaryExpense)}
            icon={AlertCircle}
            color="orange"
            trend="down"
          />
          <FinanceCard
            label="الرصيد الحالي"
            value={currency(stats.finance.balance)}
            icon={Wallet}
            color={stats.finance.balance >= 0 ? 'primary' : 'red'}
            trend={stats.finance.balance >= 0 ? 'up' : 'down'}
            highlighted
            onClick={() => onNavigate?.('finance')}
          />
        </div>
      )}

      {/* مؤشرات الأداء */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">معدل الحضور</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">{Math.min(attendanceRate, 100)}%</span>
            </div>
            <Progress value={Math.min(attendanceRate, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.counts.attendances} سجل حضور إجمالي
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">إنجاز المهام</span>
              </div>
              <span className="text-2xl font-bold text-emerald-600">{taskCompletionRate}%</span>
            </div>
            <Progress value={taskCompletionRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.counts.tasks - stats.counts.pendingTasks} من {stats.counts.tasks} مكتملة
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">نشاط النظام</span>
              </div>
              <span className="text-2xl font-bold text-purple-600">
                {stats.counts.students + stats.counts.teachers + stats.counts.attendances}
              </span>
            </div>
            <div className="flex gap-1 h-2">
              <div className="flex-1 bg-blue-500 rounded-full" style={{ width: `${(stats.counts.students / (stats.counts.students + stats.counts.teachers + stats.counts.attendances || 1)) * 100}%` }} />
              <div className="flex-1 bg-emerald-500 rounded-full" style={{ width: `${(stats.counts.teachers / (stats.counts.students + stats.counts.teachers + stats.counts.attendances || 1)) * 100}%` }} />
              <div className="flex-1 bg-purple-500 rounded-full" style={{ width: `${(stats.counts.attendances / (stats.counts.students + stats.counts.teachers + stats.counts.attendances || 1)) * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              طلاب + أساتذة + حضور
            </p>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* رسم الحضور */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                الحضور الشهري
              </CardTitle>
              <Badge variant="secondary">{stats.attendanceByMonth.length} أشهر</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <EmptyChart text="لا توجد بيانات حضور" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={attendanceData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorMale" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFemale" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c026d3" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#c026d3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="المجموع" stroke="#0f766e" fill="url(#colorTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ذكور" stroke="#0891b2" fill="url(#colorMale)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="إناث" stroke="#c026d3" fill="url(#colorFemale)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* رسم المالية */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                المداخيل والمصاريف
              </CardTitle>
              {stats.finance && <Badge variant="secondary">{financeData.length} أشهر</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {!stats.finance ? (
              <EmptyChart text="البيانات المالية متاحة للمدير فقط" />
            ) : financeData.length === 0 ? (
              <EmptyChart text="لا توجد بيانات مالية" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={financeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="المداخيل" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* توزيع الطلاب + آخر المسجلين */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* توزيع الطلاب حسب القسم */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              توزيع الطلاب حسب القسم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <EmptyChart text="لا توجد أقسام" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={departmentData}
                    dataKey="الطلاب"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(e: any) => `${e.name}: ${e.الطلاب}`}
                    labelLine={false}
                  >
                    {departmentData.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* آخر المسجلين */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                آخر الطلاب المسجلين
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.('students')}>
                عرض الكل <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.recentStudents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">لا يوجد طلاب مسجلون</p>
              ) : (
                stats.recentStudents.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.department?.name || 'بدون قسم'}
                        {s.level?.name && ` • ${s.level.name}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {s.studentNumber || '—'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* آخر المهام */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              آخر المهام
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate?.('tasks')}>
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentTasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد مهام</p>
          ) : (
            <div className="space-y-2">
              {stats.recentTasks.slice(0, 5).map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-lg ${t.completed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {t.completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${t.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.responsible && `المسؤول: ${t.responsible}`}
                        {t.deadline && ` • الأجال: ${new Date(t.deadline).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={t.priority === 'high' ? 'destructive' : t.priority === 'medium' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {t.priorityLabel || t.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* فوتر */}
      <div className="text-center text-xs text-muted-foreground py-4">
        <p>نظام إدارة مركز التكوين المهني — مدرسة السلامة</p>
        <p className="mt-1">آخر تحديث: {currentTime.toLocaleTimeString('fr-FR')}</p>
      </div>
    </div>
  );
}

// ===== مكونات مساعدة =====

function StatCard({ label, value, icon: Icon, gradient, trend, onClick }: {
  label: string;
  value: number;
  icon: any;
  gradient: string;
  trend?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`relative overflow-hidden cursor-pointer hover:shadow-lg transition-all ${onClick ? 'hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <Badge variant="secondary" className="text-xs gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
              {trend}
            </Badge>
          )}
        </div>
        <p className="text-3xl font-bold mb-1">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, color, alert, onClick }: {
  label: string;
  value: number;
  icon: any;
  color: string;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${alert ? 'border-red-200 bg-red-50/30' : ''} ${onClick ? 'hover:scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FinanceCard({ label, value, icon: Icon, color, trend, highlighted, onClick }: {
  label: string;
  value: string;
  icon: any;
  color: 'emerald' | 'red' | 'orange' | 'primary';
  trend: 'up' | 'down';
  highlighted?: boolean;
  onClick?: () => void;
}) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
    red: 'border-red-200 bg-red-50/50 text-red-700',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-700',
    primary: 'border-primary bg-primary/5 text-primary',
  };
  return (
    <Card
      className={`${colorMap[color]} ${highlighted ? 'ring-2 ring-primary/30' : ''} ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-all`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="flex items-center gap-1">
            {trend === 'up' ? (
              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-red-600" />
            )}
            <Icon className="w-4 h-4 opacity-60" />
          </div>
        </div>
        <p className={`text-lg font-bold ${colorMap[color].split(' ').find(c => c.startsWith('text-'))}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart3 className="w-12 h-12 mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
