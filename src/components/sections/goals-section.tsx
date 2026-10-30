'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Search, Edit, Trash2, Target, Flag, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, BarChart3, Calendar, User, Loader2, ChevronLeft,
  ChevronDown, ChevronRight, Eye, FileText, Activity, ClipboardList,
  Award, XCircle, FileEdit, Settings, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  calculateProgress, progressStatusLabels, progressStatusColors,
} from '@/lib/goals/progress-engine';

// ===== Types =====
interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  weight: number;
  completed: boolean;
  completedAt?: string | null;
  dueDate?: string | null;
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  level: string;
  planId?: string | null;
  parentGoalId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
  assignedTo?: string | null;
  category?: string | null;
  priority: string;
  weight: number;
  baseline: number;
  target: number;
  actual: number;
  unit: string;
  direction: string;
  progressMethod: string;
  dataSource: string;
  autoMetric?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  assignedToUser?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  milestones: Milestone[];
  subGoals?: Goal[];
  _count?: { updates: number; reviews: number; correctiveActions: number };
}

interface GoalPlan {
  id: string;
  name: string;
  description?: string | null;
  periodType: string;
  startDate: string;
  endDate: string;
  status: string;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  _count?: { goals: number };
}

interface GoalUpdate {
  id: string;
  goalId: string;
  userId: string;
  actualValue: number;
  previousValue: number;
  notes?: string | null;
  evidenceUrl?: string | null;
  status: string;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedById?: string | null;
  reviewNotes?: string | null;
  user?: { id: string; name: string };
  reviewedBy?: { id: string; name: string } | null;
  goalTitle?: string;
}

interface GoalReview {
  id: string;
  goalId: string;
  reviewerId: string;
  reviewType: string;
  period?: string | null;
  rating: number;
  achievements?: string | null;
  challenges?: string | null;
  nextSteps?: string | null;
  createdAt: string;
  reviewer?: { id: string; name: string };
}

interface CorrectiveAction {
  id: string;
  goalId: string;
  description: string;
  rootCause?: string | null;
  action?: string | null;
  assignedTo?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status: string;
  result?: string | null;
  createdAt: string;
  assignee?: { id: string; name: string } | null;
}

interface DashboardData {
  kpis: {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    overdueGoals: number;
    pendingApprovalGoals: number;
    draftGoals: number;
    avgProgress: number;
    weightedScore: number;
    totalWeight: number;
    averageProgress: number;
    plansCount: number;
  };
  weightsValidation: { valid: boolean; total: number; errors: string[]; warnings: string[] };
  distributions: {
    byStatus: Record<string, number>;
    byLevel: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
  };
  plans: GoalPlan[];
  struggling: { id: string; title: string; progress: number; status: string; dueIn: number | null; assignedTo: string | null; priority: string }[];
  topPerformers: { id: string; title: string; progress: number; assignedTo: string | null }[];
  byEmployee: { id: string; name: string; total: number; avgProgress: number }[];
  recentUpdates: GoalUpdate[];
}

interface StaffMember { id: string; name: string; role: string; label: string }
interface Department { id: string; name: string }
interface Branch { id: string; name: string }

// ===== Arabic labels =====
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'pending-approval': { label: 'بانتظار الاعتماد', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  active: { label: 'نشط', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'on-hold': { label: 'متوقف', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed: { label: 'مكتمل', color: 'bg-emerald-600 text-white border-emerald-700' },
  cancelled: { label: 'ملغى', color: 'bg-red-100 text-red-700 border-red-200' },
  overdue: { label: 'متأخر', color: 'bg-red-600 text-white border-red-700' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  medium: { label: 'متوسطة', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  high: { label: 'عالية', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  critical: { label: 'حرجة', color: 'bg-red-100 text-red-700 border-red-200' },
};

const LEVEL_LABELS: Record<string, string> = {
  institution: 'المؤسسة',
  branch: 'الفرع',
  department: 'القسم',
  employee: 'موظف',
};

const PERIOD_TYPE_LABELS: Record<string, string> = {
  annual: 'سنوية',
  'semi-annual': 'نصف سنوية',
  quarterly: 'ربعية',
  monthly: 'شهرية',
  custom: 'مخصّصة',
};

const UNIT_LABELS: Record<string, string> = {
  count: 'عدد',
  percentage: 'نسبة %',
  currency: 'مبلغ',
  hours: 'ساعات',
  courses: 'دورات',
  boolean: 'نعم/لا',
};

const DIRECTION_LABELS: Record<string, string> = {
  'higher-is-better': 'الأعلى أفضل',
  'lower-is-better': 'الأقل أفضل',
};

const PROGRESS_METHOD_LABELS: Record<string, string> = {
  formula: 'معادلة',
  milestones: 'معالم',
  manual: 'يدوي',
};

const REVIEW_TYPE_LABELS: Record<string, string> = {
  self: 'تقييم ذاتي',
  manager: 'تقييم المدير',
  final: 'تقييم نهائي',
};

const UPDATE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'مُقدَّم', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'معتمد', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
};

const ACTION_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'مفتوح', color: 'bg-amber-100 text-amber-700' },
  'in-progress': { label: 'قيد التنفيذ', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'منجز', color: 'bg-emerald-100 text-emerald-700' },
};

// ===== Empty form templates =====
const emptyGoalForm = {
  title: '', description: '', level: 'employee', planId: '', parentGoalId: '',
  branchId: '', departmentId: '', assignedTo: '', category: '', priority: 'medium',
  weight: '', baseline: '0', target: '100', actual: '0', unit: 'percentage',
  direction: 'higher-is-better', progressMethod: 'formula', dataSource: 'manual',
  autoMetric: '', startDate: '', dueDate: '', status: 'draft', notes: '',
};

const emptyPlanForm = {
  name: '', description: '', periodType: 'annual',
  startDate: '', endDate: '', status: 'draft', branchId: '',
};

// ===== Main Component =====
export function GoalsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [activeTab, setActiveTab] = useState<string>(isDirector ? 'dashboard' : 'my-goals');
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser({ id: d.user.id, name: d.user.name, role: d.user.role });
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-600" />
            الأهداف وإدارة الأداء
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة الخطط والأهداف، تتبّع التقدّم، المراجعات الدورية، والإجراءات التصحيحية
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto">
          {isDirector && (
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4" /> لوحة القيادة
            </TabsTrigger>
          )}
          <TabsTrigger value="plans">
            <Flag className="w-4 h-4" /> الخطط
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target className="w-4 h-4" /> الأهداف
          </TabsTrigger>
          <TabsTrigger value="my-goals">
            <ClipboardList className="w-4 h-4" /> تقاريري
          </TabsTrigger>
        </TabsList>

        {isDirector && (
          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>
        )}
        <TabsContent value="plans">
          <PlansTab isDirector={isDirector} />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsTab isDirector={isDirector} currentUser={user} />
        </TabsContent>
        <TabsContent value="my-goals">
          <MyGoalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Dashboard Tab (Director) =====
function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals/dashboard');
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (!data) return <div className="text-center py-12 text-muted-foreground">لا توجد بيانات</div>;

  const k = data.kpis;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="إجمالي الأهداف" value={k.totalGoals} icon={<Target className="w-5 h-5" />}
          color="emerald"
        />
        <KpiCard
          title="نشطة" value={k.activeGoals} icon={<Activity className="w-5 h-5" />}
          color="blue"
        />
        <KpiCard
          title="مكتملة" value={k.completedGoals} icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />
        <KpiCard
          title="متأخرة" value={k.overdueGoals} icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="متوسط التقدّم"
          value={`${k.avgProgress}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="teal"
        />
        <KpiCard
          title="النتيجة المرجّحة"
          value={`${k.weightedScore}%`}
          icon={<Award className="w-5 h-5" />}
          color="amber"
        />
      </div>

      {/* Weights validation alert */}
      {!data.weightsValidation.valid && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 inline ml-2" />
          {data.weightsValidation.errors.join('، ')}
        </div>
      )}
      {data.weightsValidation.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 inline ml-2" />
          {data.weightsValidation.warnings.join('، ')} (المجموع: {data.weightsValidation.total.toFixed(2)})
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Struggling goals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              الأهداف المتعثرة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.struggling.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد أهداف متعثرة</p>
            ) : (
              <div className="space-y-2">
                {data.struggling.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.assignedTo ? `المسؤول: ${s.assignedTo} — ` : ''}
                        {s.dueIn !== null
                          ? s.dueIn < 0
                            ? `متأخر بـ ${Math.abs(s.dueIn)} يوم`
                            : `يستحق خلال ${s.dueIn} يوم`
                          : ''}
                      </p>
                    </div>
                    <Badge className={PRIORITY_LABELS[s.priority]?.color}>
                      {PRIORITY_LABELS[s.priority]?.label || s.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top performers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              الأفضل أداءً
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد أهداف متقدمة بعد</p>
            ) : (
              <div className="space-y-2">
                {data.topPerformers.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.assignedTo || 'غير مُسنَد'}</p>
                    </div>
                    <Badge className="bg-emerald-600 text-white">{t.progress}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distributions */}
        <Card>
          <CardHeader><CardTitle className="text-base">التوزيع حسب الحالة</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.distributions.byStatus).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span>{STATUS_LABELS[k]?.label || k}</span>
                  <Badge variant="secondary">{v}</Badge>
                </div>
              ))}
              {Object.keys(data.distributions.byStatus).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">التوزيع حسب المستوى</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.distributions.byLevel).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span>{LEVEL_LABELS[k] || k}</span>
                  <Badge variant="secondary">{v}</Badge>
                </div>
              ))}
              {Object.keys(data.distributions.byLevel).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">التوزيع حسب الأولوية</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.distributions.byPriority).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span>{PRIORITY_LABELS[k]?.label || k}</span>
                  <Badge className={PRIORITY_LABELS[k]?.color}>{v}</Badge>
                </div>
              ))}
              {Object.keys(data.distributions.byPriority).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent updates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            آخر تحديثات التقدّم
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentUpdates.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد تحديثات</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الهدف</TableHead>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>القيمة الجديدة</TableHead>
                  <TableHead>السابقة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentUpdates.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.goalTitle}</TableCell>
                    <TableCell>{u.user || '—'}</TableCell>
                    <TableCell>{u.actualValue}</TableCell>
                    <TableCell className="text-muted-foreground">{u.previousValue}</TableCell>
                    <TableCell>
                      <Badge className={UPDATE_STATUS_LABELS[u.status]?.color}>
                        {UPDATE_STATUS_LABELS[u.status]?.label || u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.submittedAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Employees performance */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-emerald-600" /> أداء الموظفين</CardTitle></CardHeader>
        <CardContent>
          {data.byEmployee.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>عدد الأهداف</TableHead>
                  <TableHead>متوسط التقدّم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byEmployee.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.total}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={e.avgProgress} className="w-24 h-2" />
                        <span className="text-sm font-medium">{e.avgProgress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Plans Tab =====
function PlansTab({ isDirector }: { isDirector: boolean }) {
  const [plans, setPlans] = useState<GoalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalPlan | null>(null);
  const [formData, setFormData] = useState<any>(emptyPlanForm);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals/plans');
      const d = await res.json();
      setPlans(d.plans || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleOpenAdd = () => { setEditing(null); setFormData(emptyPlanForm); setDialogOpen(true); };
  const handleOpenEdit = (p: GoalPlan) => {
    setEditing(p);
    setFormData({
      name: p.name,
      description: p.description || '',
      periodType: p.periodType,
      startDate: p.startDate.split('T')[0],
      endDate: p.endDate.split('T')[0],
      status: p.status,
      branchId: p.branchId || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.startDate || !formData.endDate) {
      toast({ title: 'تنبيه', description: 'الاسم وتاريخا البداية والنهاية مطلوبة', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/goals/plans?id=${editing.id}` : '/api/goals/plans';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
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

  const handleDelete = async (p: GoalPlan) => {
    if (!confirm(`حذف الخطة "${p.name}"؟`)) return;
    const res = await fetch(`/api/goals/plans?id=${p.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
    else { toast({ title: 'خطأ', description: 'تعذر الحذف', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">خطط الأهداف</h3>
        {isDirector && (
          <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> خطة جديدة
          </Button>
        )}
      </div>

      {loading ? <LoadingState /> : plans.length === 0 ? (
        <EmptyState title="لا توجد خطط" message="ابدأ بإنشاء خطة أهداف سنوية أو ربعية." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {PERIOD_TYPE_LABELS[p.periodType] || p.periodType}
                    </CardDescription>
                  </div>
                  <Badge className={STATUS_LABELS[p.status]?.color || 'bg-gray-100'}>
                    {STATUS_LABELS[p.status]?.label || p.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(p.startDate).toLocaleDateString('fr-FR')} — {new Date(p.endDate).toLocaleDateString('fr-FR')}</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3" />{p._count?.goals || 0} هدف</span>
                </div>
                {p.branch && <p className="text-xs">الفرع: {p.branch.name}</p>}
                {isDirector && (
                  <div className="flex gap-1 pt-2">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(p)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plan form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل خطة' : 'خطة أهداف جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم الخطة *</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: خطة 2027" />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>نوع الفترة</Label>
                <Select value={formData.periodType} onValueChange={v => setFormData({ ...formData, periodType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="active">نشطة</SelectItem>
                    <SelectItem value="archived">مؤرشفة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البداية *</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ النهاية *</Label>
                <Input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Goals Tab =====
function GoalsTab({ isDirector, currentUser }: { isDirector: boolean; currentUser: { id: string; name: string; role: string } | null }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plans, setPlans] = useState<GoalPlan[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignedTo, setFilterAssignedTo] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [formData, setFormData] = useState<any>(emptyGoalForm);
  const [detailsGoalId, setDetailsGoalId] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterPlan !== 'all') params.set('planId', filterPlan);
      if (filterLevel !== 'all') params.set('level', filterLevel);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      if (filterAssignedTo !== 'all') params.set('assignedTo', filterAssignedTo);
      params.set('includeSubGoals', 'false');

      const [goalsRes, plansRes, staffRes, deptsRes] = await Promise.all([
        fetch(`/api/goals?${params.toString()}`),
        fetch('/api/goals/plans'),
        fetch('/api/users/staff-names'),
        fetch('/api/departments'),
      ]);
      const goalsData = await goalsRes.json();
      const plansData = await plansRes.json();
      const staffData = await staffRes.json();
      const deptsData = await deptsRes.json();
      setGoals(goalsData.goals || []);
      setPlans(plansData.plans || []);
      setStaff(staffData.staff || []);
      setDepartments(deptsData.departments || []);
      if (isDirector) {
        try {
          const branchesRes = await fetch('/api/branches');
          const branchesData = await branchesRes.json();
          setBranches(branchesData.branches || []);
        } catch {}
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterPlan, filterLevel, filterStatus, filterPriority, filterAssignedTo]);

  const handleOpenAdd = () => { setEditing(null); setFormData(emptyGoalForm); setDialogOpen(true); };

  const handleOpenEdit = (g: Goal) => {
    setEditing(g);
    setFormData({
      title: g.title,
      description: g.description || '',
      level: g.level,
      planId: g.planId || '',
      parentGoalId: g.parentGoalId || '',
      branchId: g.branchId || '',
      departmentId: g.departmentId || '',
      assignedTo: g.assignedTo || '',
      category: g.category || '',
      priority: g.priority,
      weight: String(g.weight),
      baseline: String(g.baseline),
      target: String(g.target),
      actual: String(g.actual),
      unit: g.unit,
      direction: g.direction,
      progressMethod: g.progressMethod,
      dataSource: g.dataSource,
      autoMetric: g.autoMetric || '',
      startDate: g.startDate ? g.startDate.split('T')[0] : '',
      dueDate: g.dueDate ? g.dueDate.split('T')[0] : '',
      status: g.status,
      notes: g.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'تنبيه', description: 'عنوان الهدف مطلوب', variant: 'destructive' });
      return;
    }
    const url = editing ? `/api/goals?id=${editing.id}` : '/api/goals';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
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

  const handleDelete = async (g: Goal) => {
    if (!confirm(`حذف الهدف "${g.title}"؟`)) return;
    const res = await fetch(`/api/goals?id=${g.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
    else { toast({ title: 'خطأ', description: 'تعذر الحذف', variant: 'destructive' }); }
  };

  const toggleExpand = (id: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">بحث</Label>
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالعنوان أو الوصف..." className="pr-8" />
              </div>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs">الخطة</Label>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الخطط</SelectItem>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs">المستوى</Label>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs">الحالة</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs">الأولوية</Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDirector && (
              <div className="min-w-[140px]">
                <Label className="text-xs">المسؤول</Label>
                <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> هدف جديد
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goals list */}
      {loading ? <LoadingState /> : goals.length === 0 ? (
        <EmptyState title="لا توجد أهداف" message="ابدأ بإنشاء هدف جديد." />
      ) : (
        <div className="space-y-2">
          {goals.map(g => {
            const prog = calculateProgress(g);
            const expanded = expandedGoals.has(g.id);
            return (
              <Card key={g.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Expand toggle */}
                    {g.subGoals && g.subGoals.length > 0 ? (
                      <button onClick={() => toggleExpand(g.id)} className="mt-1 p-1 rounded hover:bg-muted">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                    ) : (
                      <div className="w-6" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{g.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge className={STATUS_LABELS[g.status]?.color}>{STATUS_LABELS[g.status]?.label}</Badge>
                            <Badge className={PRIORITY_LABELS[g.priority]?.color}>{PRIORITY_LABELS[g.priority]?.label}</Badge>
                            <Badge variant="outline">{LEVEL_LABELS[g.level] || g.level}</Badge>
                            {g.category && <Badge variant="outline">{g.category}</Badge>}
                            {g.weight > 0 && <Badge variant="outline">الوزن: {g.weight}</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDetailsGoalId(g.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(g)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(g)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            التقدّم: {prog.progress.toFixed(0)}% — {prog.label}
                          </span>
                          <span className="text-muted-foreground">
                            {g.actual} / {g.target} {UNIT_LABELS[g.unit] || ''}
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute top-0 right-0 h-full bg-emerald-600 transition-all"
                            style={{ width: `${prog.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        {g.assignedToUser && <span className="flex items-center gap-1"><User className="w-3 h-3" />{g.assignedToUser.name}</span>}
                        {g.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />يستحق: {new Date(g.dueDate).toLocaleDateString('fr-FR')}</span>}
                        {g.plan && <span className="flex items-center gap-1"><Flag className="w-3 h-3" />{g.plan.name}</span>}
                        {g.milestones.length > 0 && (
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{g.milestones.filter(m => m.completed).length}/{g.milestones.length} معالم</span>
                        )}
                      </div>

                      {/* Sub-goals */}
                      {expanded && g.subGoals && g.subGoals.length > 0 && (
                        <div className="mt-3 pr-4 border-r-2 border-muted space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">الأهداف الفرعية:</p>
                          {g.subGoals.map(sg => {
                            const sgProg = calculateProgress(sg);
                            return (
                              <div key={sg.id} className="text-sm">
                                <div className="flex items-center justify-between">
                                  <span>{sg.title}</span>
                                  <span className="text-xs text-muted-foreground">{sgProg.progress.toFixed(0)}%</span>
                                </div>
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1">
                                  <div className="absolute top-0 right-0 h-full bg-emerald-500" style={{ width: `${sgProg.progress}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Goal form dialog */}
      <GoalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        plans={plans}
        staff={staff}
        departments={departments}
        branches={branches}
        goals={goals}
        isDirector={isDirector}
      />

      {/* Details dialog */}
      {detailsGoalId && (
        <GoalDetailsDialog
          goalId={detailsGoalId}
          open={!!detailsGoalId}
          onOpenChange={(o) => !o && setDetailsGoalId(null)}
          isDirector={isDirector}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// ===== Goal Form Dialog =====
function GoalFormDialog({
  open, onOpenChange, editing, formData, setFormData, onSave,
  plans, staff, departments, branches, goals, isDirector,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Goal | null;
  formData: any;
  setFormData: (d: any) => void;
  onSave: () => void;
  plans: GoalPlan[];
  staff: StaffMember[];
  departments: Department[];
  branches: Branch[];
  goals: Goal[];
  isDirector: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'تعديل هدف' : 'هدف جديد'}</DialogTitle>
          <DialogDescription>أدخل تفاصيل الهدف الكاملة</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <Label>عنوان الهدف *</Label>
              <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>المستوى</Label>
              <Select value={formData.level} onValueChange={v => setFormData({ ...formData, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفئة</Label>
              <Input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="أكاديمي/مالي..." />
            </div>
          </div>

          {/* Associations */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>الخطة</Label>
              <Select value={formData.planId || '__none__'} onValueChange={v => setFormData({ ...formData, planId: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="بدون خطة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون خطة</SelectItem>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الهدف الأب</Label>
              <Select value={formData.parentGoalId || '__none__'} onValueChange={v => setFormData({ ...formData, parentGoalId: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون</SelectItem>
                  {goals.filter(g => g.id !== editing?.id).map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المسؤول</Label>
              <Select value={formData.assignedTo || '__none__'} onValueChange={v => setFormData({ ...formData, assignedTo: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>القسم</Label>
              <Select value={formData.departmentId || '__none__'} onValueChange={v => setFormData({ ...formData, departmentId: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDirector && (
              <div>
                <Label>الفرع</Label>
                <Select value={formData.branchId || '__none__'} onValueChange={v => setFormData({ ...formData, branchId: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">المقر الرئيسي</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>الوزن (%)</Label>
              <Input type="number" step="0.1" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} />
            </div>
          </div>

          {/* Metrics */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4" /> القياس والقيم</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>القيمة الأساسية</Label>
                <Input type="number" step="0.01" value={formData.baseline} onChange={e => setFormData({ ...formData, baseline: e.target.value })} />
              </div>
              <div>
                <Label>القيمة المستهدفة</Label>
                <Input type="number" step="0.01" value={formData.target} onChange={e => setFormData({ ...formData, target: e.target.value })} />
              </div>
              <div>
                <Label>القيمة الفعلية</Label>
                <Input type="number" step="0.01" value={formData.actual} onChange={e => setFormData({ ...formData, actual: e.target.value })} />
              </div>
              <div>
                <Label>الوحدة</Label>
                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>الاتجاه</Label>
                <Select value={formData.direction} onValueChange={v => setFormData({ ...formData, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIRECTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>طريقة الحساب</Label>
                <Select value={formData.progressMethod} onValueChange={v => setFormData({ ...formData, progressMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROGRESS_METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>مصدر البيانات</Label>
                <Select value={formData.dataSource} onValueChange={v => setFormData({ ...formData, dataSource: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">يدوي</SelectItem>
                    <SelectItem value="auto">تلقائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.dataSource === 'auto' && (
              <div>
                <Label>المقياس التلقائي</Label>
                <Input value={formData.autoMetric} onChange={e => setFormData({ ...formData, autoMetric: e.target.value })} placeholder="مثال: total_students" />
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="border-t pt-3 grid grid-cols-2 gap-3">
            <div>
              <Label>تاريخ البداية</Label>
              <Input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            </div>
            <div>
              <Label>الموعد النهائي</Label>
              <Input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700">حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Goal Details Dialog =====
function GoalDetailsDialog({
  goalId, open, onOpenChange, isDirector, onRefresh,
}: {
  goalId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isDirector: boolean;
  onRefresh: () => void;
}) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [updates, setUpdates] = useState<GoalUpdate[]>([]);
  const [reviews, setReviews] = useState<GoalReview[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('overview');
  const { toast } = useToast();

  // Forms
  const [updateForm, setUpdateForm] = useState({ actualValue: '', notes: '', evidenceUrl: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', weight: '', dueDate: '', description: '' });
  const [reviewForm, setReviewForm] = useState({ reviewType: 'self', period: '', rating: '', achievements: '', challenges: '', nextSteps: '' });
  const [actionForm, setActionForm] = useState({ description: '', rootCause: '', action: '', assignedTo: '', startDate: '', dueDate: '', status: 'open' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/goals/${goalId}`);
      const d = await res.json();
      if (d.goal) {
        setGoal(d.goal);
        setUpdates(d.goal.updates || []);
        setReviews(d.goal.reviews || []);
        setActions(d.goal.correctiveActions || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (open) { load(); setSubTab('overview'); } }, [open, goalId]);

  const submitUpdate = async () => {
    if (!updateForm.actualValue) {
      toast({ title: 'تنبيه', description: 'القيمة الفعلية مطلوبة', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/goals/${goalId}/updates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateForm),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم تقديم التحديث' });
      setUpdateForm({ actualValue: '', notes: '', evidenceUrl: '' });
      load(); onRefresh();
    }
  };

  const reviewUpdate = async (updateId: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/goals/${goalId}/updates?updateId=${updateId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast({ title: 'تم', description: status === 'approved' ? 'تم الاعتماد' : 'تم الرفض' });
      load(); onRefresh();
    }
  };

  const addMilestone = async () => {
    if (!milestoneForm.title) {
      toast({ title: 'تنبيه', description: 'عنوان المعلم مطلوب', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/goals/${goalId}/milestones`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(milestoneForm),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تمت إضافة المعلم' });
      setMilestoneForm({ title: '', weight: '', dueDate: '', description: '' });
      load();
    }
  };

  const toggleMilestone = async (m: Milestone) => {
    const res = await fetch(`/api/goals/${goalId}/milestones?milestoneId=${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !m.completed, weight: m.weight, title: m.title }),
    });
    if (res.ok) { load(); }
  };

  const deleteMilestone = async (m: Milestone) => {
    if (!confirm(`حذف المعلم "${m.title}"؟`)) return;
    const res = await fetch(`/api/goals/${goalId}/milestones?milestoneId=${m.id}`, { method: 'DELETE' });
    if (res.ok) { load(); }
  };

  const addReview = async () => {
    if (!reviewForm.rating) {
      toast({ title: 'تنبيه', description: 'التقييم مطلوب', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/goals/${goalId}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewForm),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تمت إضافة المراجعة' });
      setReviewForm({ reviewType: 'self', period: '', rating: '', achievements: '', challenges: '', nextSteps: '' });
      load();
    }
  };

  const addAction = async () => {
    if (!actionForm.description) {
      toast({ title: 'تنبيه', description: 'وصف الإجراء مطلوب', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/goals/${goalId}/corrective-actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionForm),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تمت إضافة الإجراء' });
      setActionForm({ description: '', rootCause: '', action: '', assignedTo: '', startDate: '', dueDate: '', status: 'open' });
      load();
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl"><LoadingState /></DialogContent>
      </Dialog>
    );
  }
  if (!goal) return null;

  const prog = calculateProgress(goal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{goal.title}</DialogTitle>
          <DialogDescription>
            {goal.description || 'لا يوجد وصف'}
          </DialogDescription>
        </DialogHeader>

        {/* Header badges + progress */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className={STATUS_LABELS[goal.status]?.color}>{STATUS_LABELS[goal.status]?.label}</Badge>
            <Badge className={PRIORITY_LABELS[goal.priority]?.color}>{PRIORITY_LABELS[goal.priority]?.label}</Badge>
            <Badge variant="outline">{LEVEL_LABELS[goal.level]}</Badge>
            {goal.category && <Badge variant="outline">{goal.category}</Badge>}
            <Badge variant="outline">الوزن: {goal.weight}</Badge>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">التقدّم: {prog.progress.toFixed(0)}% — {prog.label}</span>
              <span className="text-muted-foreground">
                {goal.actual} / {goal.target} {UNIT_LABELS[goal.unit] || ''}
                {goal.direction === 'lower-is-better' && ' (الأقل أفضل)'}
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="absolute top-0 right-0 h-full bg-emerald-600 transition-all" style={{ width: `${prog.progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><User className="w-3 h-3" /> {goal.assignedToUser?.name || 'غير مُسنَد'}</div>
            <div className="flex items-center gap-1"><Flag className="w-3 h-3" /> {goal.plan?.name || 'بدون خطة'}</div>
            <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {goal.dueDate ? new Date(goal.dueDate).toLocaleDateString('fr-FR') : '—'}</div>
            <div className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {PROGRESS_METHOD_LABELS[goal.progressMethod]}</div>
          </div>
        </div>

        {/* Sub tabs */}
        <Tabs value={subTab} onValueChange={setSubTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="milestones">المعالم</TabsTrigger>
            <TabsTrigger value="updates">التحديثات</TabsTrigger>
            <TabsTrigger value="reviews">المراجعات</TabsTrigger>
            <TabsTrigger value="actions">إجراءات تصحيحية</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Card><CardContent className="pt-3">
                <p className="text-xs text-muted-foreground">القيمة الأساسية</p>
                <p className="text-lg font-bold">{goal.baseline}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3">
                <p className="text-xs text-muted-foreground">القيمة المستهدفة</p>
                <p className="text-lg font-bold">{goal.target}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3">
                <p className="text-xs text-muted-foreground">القيمة الفعلية</p>
                <p className="text-lg font-bold text-emerald-600">{goal.actual}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3">
                <p className="text-xs text-muted-foreground">القسم / الفرع</p>
                <p className="text-sm font-medium">{goal.department?.name || '—'} / {goal.branch?.name || 'المقر'}</p>
              </CardContent></Card>
            </div>
            {goal.notes && (
              <Card><CardHeader><CardTitle className="text-sm">ملاحظات</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{goal.notes}</p></CardContent></Card>
            )}
            {goal.approvedBy && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                اعتُمد من {goal.approvedBy.name} في {goal.approvedAt ? new Date(goal.approvedAt).toLocaleDateString('fr-FR') : ''}
              </div>
            )}
          </TabsContent>

          {/* Milestones */}
          <TabsContent value="milestones" className="space-y-3">
            {goal.progressMethod !== 'milestones' && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                ملاحظة: طريقة الحساب الحالية هي "{PROGRESS_METHOD_LABELS[goal.progressMethod]}". المعالم تُستخدم فقط عند ضبط الطريقة على "معالم".
              </p>
            )}
            <div className="space-y-2">
              {goal.milestones.length === 0 && <p className="text-sm text-muted-foreground">لا توجد معالم بعد</p>}
              {goal.milestones.map(m => (
                <div key={m.id} className="flex items-start gap-2 p-2 rounded border">
                  <Checkbox checked={m.completed} onCheckedChange={() => toggleMilestone(m)} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${m.completed ? 'line-through text-muted-foreground' : ''}`}>{m.title}</p>
                    {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      الوزن: {m.weight}{m.dueDate ? ` • يستحق: ${new Date(m.dueDate).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteMilestone(m)}>
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add milestone */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">إضافة معلم جديد</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Input placeholder="العنوان *" value={milestoneForm.title} onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })} />
                <Input placeholder="الوزن" type="number" value={milestoneForm.weight} onChange={e => setMilestoneForm({ ...milestoneForm, weight: e.target.value })} />
                <Input type="date" value={milestoneForm.dueDate} onChange={e => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} />
              </div>
              <Input placeholder="الوصف" value={milestoneForm.description} onChange={e => setMilestoneForm({ ...milestoneForm, description: e.target.value })} />
              <Button size="sm" onClick={addMilestone} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> إضافة</Button>
            </div>
          </TabsContent>

          {/* Updates */}
          <TabsContent value="updates" className="space-y-3">
            <div className="space-y-2">
              {updates.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تحديثات</p>}
              {updates.map(u => (
                <div key={u.id} className="p-2 rounded border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={UPDATE_STATUS_LABELS[u.status]?.color}>{UPDATE_STATUS_LABELS[u.status]?.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {u.user?.name} — {new Date(u.submittedAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        القيمة: <span className="font-medium">{u.actualValue}</span>
                        <span className="text-muted-foreground"> (السابقة: {u.previousValue})</span>
                      </p>
                      {u.notes && <p className="text-xs text-muted-foreground mt-1">{u.notes}</p>}
                      {u.reviewNotes && <p className="text-xs text-amber-700 mt-1">ملاحظة المراجعة: {u.reviewNotes}</p>}
                    </div>
                    {isDirector && u.status === 'submitted' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => reviewUpdate(u.id, 'approved')}>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => reviewUpdate(u.id, 'rejected')}>
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">تقديم تحديث جديد</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">القيمة الفعلية *</Label>
                  <Input type="number" step="0.01" value={updateForm.actualValue} onChange={e => setUpdateForm({ ...updateForm, actualValue: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">رابط الإثبات</Label>
                  <Input value={updateForm.evidenceUrl} onChange={e => setUpdateForm({ ...updateForm, evidenceUrl: e.target.value })} />
                </div>
              </div>
              <Textarea placeholder="ملاحظات" value={updateForm.notes} onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })} rows={2} />
              <Button size="sm" onClick={submitUpdate} className="bg-emerald-600 hover:bg-emerald-700">
                <RefreshCw className="w-4 h-4" /> تقديم التحديث
              </Button>
            </div>
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="space-y-3">
            <div className="space-y-2">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مراجعات</p>}
              {reviews.map(r => (
                <div key={r.id} className="p-2 rounded border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{REVIEW_TYPE_LABELS[r.reviewType] || r.reviewType}</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700">التقييم: {r.rating}</Badge>
                    {r.period && <span className="text-xs text-muted-foreground">{r.period}</span>}
                    <span className="text-xs text-muted-foreground">{r.reviewer?.name} — {new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {r.achievements && <p className="text-sm mt-1"><span className="text-muted-foreground">الإنجازات:</span> {r.achievements}</p>}
                  {r.challenges && <p className="text-sm mt-1"><span className="text-muted-foreground">التحديات:</span> {r.challenges}</p>}
                  {r.nextSteps && <p className="text-sm mt-1"><span className="text-muted-foreground">الخطوات القادمة:</span> {r.nextSteps}</p>}
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">إضافة مراجعة</p>
              <div className="grid grid-cols-3 gap-2">
                <Select value={reviewForm.reviewType} onValueChange={v => setReviewForm({ ...reviewForm, reviewType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REVIEW_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="الفترة (2027-Q1)" value={reviewForm.period} onChange={e => setReviewForm({ ...reviewForm, period: e.target.value })} />
                <Input type="number" step="0.1" placeholder="التقييم (0-5)" value={reviewForm.rating} onChange={e => setReviewForm({ ...reviewForm, rating: e.target.value })} />
              </div>
              <Input placeholder="الإنجازات" value={reviewForm.achievements} onChange={e => setReviewForm({ ...reviewForm, achievements: e.target.value })} />
              <Input placeholder="التحديات" value={reviewForm.challenges} onChange={e => setReviewForm({ ...reviewForm, challenges: e.target.value })} />
              <Textarea placeholder="الخطوات القادمة" value={reviewForm.nextSteps} onChange={e => setReviewForm({ ...reviewForm, nextSteps: e.target.value })} rows={2} />
              <Button size="sm" onClick={addReview} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> إضافة</Button>
            </div>
          </TabsContent>

          {/* Corrective Actions */}
          <TabsContent value="actions" className="space-y-3">
            <div className="space-y-2">
              {actions.length === 0 && <p className="text-sm text-muted-foreground">لا توجد إجراءات تصحيحية</p>}
              {actions.map(a => (
                <div key={a.id} className="p-2 rounded border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{a.description}</p>
                    <Badge className={ACTION_STATUS_LABELS[a.status]?.color}>{ACTION_STATUS_LABELS[a.status]?.label}</Badge>
                  </div>
                  {a.rootCause && <p className="text-xs text-muted-foreground mt-1">السبب الجذري: {a.rootCause}</p>}
                  {a.action && <p className="text-xs text-muted-foreground">الإجراء: {a.action}</p>}
                  {a.result && <p className="text-xs text-emerald-700 mt-1">النتيجة: {a.result}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.assignee?.name ? `المسؤول: ${a.assignee.name} • ` : ''}
                    {a.dueDate ? `يستحق: ${new Date(a.dueDate).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">إضافة إجراء تصحيحي</p>
              <Input placeholder="وصف الإجراء *" value={actionForm.description} onChange={e => setActionForm({ ...actionForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="السبب الجذري" value={actionForm.rootCause} onChange={e => setActionForm({ ...actionForm, rootCause: e.target.value })} />
                <Input placeholder="الإجراء المطلوب" value={actionForm.action} onChange={e => setActionForm({ ...actionForm, action: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="date" value={actionForm.startDate} onChange={e => setActionForm({ ...actionForm, startDate: e.target.value })} />
                <Input type="date" value={actionForm.dueDate} onChange={e => setActionForm({ ...actionForm, dueDate: e.target.value })} />
                <Select value={actionForm.status} onValueChange={v => setActionForm({ ...actionForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={addAction} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /> إضافة</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ===== My Goals Tab (employee + director self) =====
function MyGoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailsGoalId, setDetailsGoalId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals/my-goals');
      const d = await res.json();
      setGoals(d.goals || []);
      setStats(d.stats || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiCard title="أهدافي" value={stats.totalGoals} icon={<Target className="w-5 h-5" />} color="emerald" />
          <KpiCard title="نشطة" value={stats.activeGoals} icon={<Activity className="w-5 h-5" />} color="blue" />
          <KpiCard title="مكتملة" value={stats.completedGoals} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
          <KpiCard title="متأخرة" value={stats.overdueGoals} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
          <KpiCard title="متوسط التقدّم" value={`${stats.avgProgress}%`} icon={<TrendingUp className="w-5 h-5" />} color="teal" />
          <KpiCard title="بانتظار المراجعة" value={stats.pendingReview} icon={<Clock className="w-5 h-5" />} color="amber" />
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <EmptyState title="لا توجد أهداف مُسنَدة إليك" message="سيظهر هنا كل هدف تم إسناده إليك مع تتبّع التقدّم." />
      ) : (
        <div className="space-y-2">
          {goals.map(g => {
            const prog = calculateProgress(g);
            return (
              <Card key={g.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{g.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge className={STATUS_LABELS[g.status]?.color}>{STATUS_LABELS[g.status]?.label}</Badge>
                        <Badge className={PRIORITY_LABELS[g.priority]?.color}>{PRIORITY_LABELS[g.priority]?.label}</Badge>
                        {g.plan && <Badge variant="outline">{g.plan.name}</Badge>}
                      </div>
                      {/* Progress */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{prog.label}</span>
                          <span className="font-medium">{prog.progress.toFixed(0)}%</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="absolute top-0 right-0 h-full bg-emerald-600" style={{ width: `${prog.progress}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {g.actual} / {g.target} {UNIT_LABELS[g.unit] || ''}
                          {g.dueDate && ` • يستحق: ${new Date(g.dueDate).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      {/* Recent updates */}
                      {g.updates.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          آخر تحديث: {g.updates[0].actualValue} ({UPDATE_STATUS_LABELS[g.updates[0].status]?.label})
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setDetailsGoalId(g.id)}>
                      <Eye className="w-4 h-4" /> تفاصيل
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {detailsGoalId && (
        <GoalDetailsDialog
          goalId={detailsGoalId}
          open={!!detailsGoalId}
          onOpenChange={(o) => !o && setDetailsGoalId(null)}
          isDirector={false}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// ===== Helpers =====
function KpiCard({
  title, value, icon, color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'red' | 'amber' | 'teal';
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <Card className={`border ${colorMap[color]}`}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs opacity-80 truncate">{title}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
          </div>
          <div className="opacity-70">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      <span className="mr-2 text-sm text-muted-foreground">جاري التحميل...</span>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center py-12">
      <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{message}</p>
    </div>
  );
}
