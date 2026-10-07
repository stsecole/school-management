'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, RefreshCw, PieChart as PieIcon, BarChart3, TrendingUp,
  Calendar, Wallet, UserCheck, Cake, Building2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface ChartData {
  gender: { name: string; value: number; color: string }[];
  status: { name: string; value: number; color: string; rawStatus: string }[];
  age: { name: string; value: number }[];
  deptGender: { name: string; ذكور: number; إناث: number; المجموع: number }[];
  monthlyAttendance: { name: string; المجموع: number; ذكور: number; إناث: number; جلسات: number }[];
  monthlyFinance: { name: string; المداخيل: number; المصاريف: number; الصافي: number }[];
  revenueByType: { name: string; value: number }[];
  months: number;
  isDirector: boolean;
  lastUpdate: string;
}

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#a855f7', '#14b8a6'];

const currency = (n: number) => new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 0 }).format(n) + ' دج';

export function AnalyticsCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState('12');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/charts?months=${months}`);
      const d = await res.json();
      setData(d);
    } catch (e: any) {
      toast({ title: 'خطأ', description: 'فشل تحميل الرسوم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [months, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-72" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-12 text-muted-foreground">تعذر تحميل البيانات</div>;

  const totalStudents = data.gender.reduce((s, g) => s + g.value, 0);

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <PieIcon className="w-4 h-4 text-purple-600" />
            <span className="font-medium">رسوم تحليلية متقدمة</span>
            <Badge variant="outline" className="text-xs">آخر {data.months} أشهر</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-36">
                <Calendar className="w-4 h-4 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">آخر 6 أشهر</SelectItem>
                <SelectItem value="12">آخر 12 شهر</SelectItem>
                <SelectItem value="18">آخر 18 شهر</SelectItem>
                <SelectItem value="24">آخر 24 شهر</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Row 1: Gender + Status + Age ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gender distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> توزيع الطلاب حسب الجنس
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gender}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    {data.gender.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              {data.gender.map(g => (
                <div key={g.name} className="flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: g.color }} />
                  <span className="font-medium">{g.name}:</span>
                  <span className="num">{g.value}</span>
                  <span className="text-muted-foreground">
                    ({totalStudents > 0 ? Math.round((g.value / totalStudents) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" /> توزيع الطلاب حسب الحالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.status}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    {data.status.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              {data.status.map(s => (
                <div key={s.rawStatus} className="flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  <span className="font-medium">{s.name}:</span>
                  <span className="num">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Age distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="w-4 h-4 text-amber-600" /> توزيع الطلاب حسب الفئة العمرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.age} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="عدد الطلاب" radius={[8, 8, 0, 0]}>
                    {data.age.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Row 2: Department × Gender (stacked bar) ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" /> توزيع الطلاب حسب القسم والجنس
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div dir="ltr" className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.deptGender} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ذكور" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="إناث" stackId="a" fill="#ec4899" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===== Row 3: Monthly attendance trend ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> منحنى الحضور الشهري
            <Badge variant="outline" className="text-xs">آخر {data.months} أشهر</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div dir="ltr" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyAttendance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorMale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorFemale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="المجموع" stroke="#3b82f6" fill="url(#colorTotal)" strokeWidth={2} />
                <Area type="monotone" dataKey="ذكور" stroke="#06b6d4" fill="url(#colorMale)" strokeWidth={2} />
                <Area type="monotone" dataKey="إناث" stroke="#ec4899" fill="url(#colorFemale)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ===== Row 4: Monthly finance (revenue vs expenses) — director only ===== */}
      {data.isDirector && data.monthlyFinance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" /> مقارنة الإيرادات والمصاريف الشهرية
              <Badge variant="outline" className="text-xs">آخر {data.months} أشهر</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div dir="ltr" className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthlyFinance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                  <Bar dataKey="المداخيل" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="المصاريف" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="الصافي" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                <p className="text-xs text-muted-foreground">إجمالي المداخيل</p>
                <p className="text-base font-bold num text-emerald-700">
                  {currency(data.monthlyFinance.reduce((s, m) => s + m.المداخيل, 0))}
                </p>
              </div>
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <p className="text-xs text-muted-foreground">إجمالي المصاريف</p>
                <p className="text-base font-bold num text-red-700">
                  {currency(data.monthlyFinance.reduce((s, m) => s + m.المصاريف, 0))}
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded border border-purple-200">
                <p className="text-xs text-muted-foreground">صافي الربح</p>
                <p className={`text-base font-bold num ${data.monthlyFinance.reduce((s, m) => s + m.الصافي, 0) >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                  {currency(data.monthlyFinance.reduce((s, m) => s + m.الصافي, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Row 5: Revenue by payment type — director only ===== */}
      {data.isDirector && data.revenueByType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-600" /> توزيع الإيرادات حسب نوع الدفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div dir="ltr" className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.revenueByType}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={(e: any) => `${e.name}`}
                    >
                      {data.revenueByType.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => currency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.revenueByType.map((r, idx) => {
                  const total = data.revenueByType.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
                  return (
                    <div key={r.name} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="font-medium text-sm">{r.name}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-bold num text-sm">{currency(r.value)}</p>
                        <p className="text-xs text-muted-foreground num">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
