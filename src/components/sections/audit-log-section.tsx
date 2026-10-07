'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History, Search, Trash2, Loader2, RefreshCw, Download, User, Calendar,
  Plus, Edit, FileX, LogIn, LogOut, Wallet, Upload, Save, Settings, Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  entityId: string | null;
  entityType: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditStats {
  total: number;
  today: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
}

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch { return iso; }
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'create': return <Plus className="w-4 h-4 text-emerald-600" />;
    case 'update': return <Edit className="w-4 h-4 text-blue-600" />;
    case 'delete': return <FileX className="w-4 h-4 text-red-600" />;
    case 'login': return <LogIn className="w-4 h-4 text-purple-600" />;
    case 'logout': return <LogOut className="w-4 h-4 text-gray-600" />;
    case 'finance': return <Wallet className="w-4 h-4 text-amber-600" />;
    case 'export': return <Download className="w-4 h-4 text-cyan-600" />;
    case 'import': return <Upload className="w-4 h-4 text-indigo-600" />;
    case 'backup': return <Save className="w-4 h-4 text-orange-600" />;
    case 'system': return <Settings className="w-4 h-4 text-slate-600" />;
    default: return <History className="w-4 h-4" />;
  }
};

const getActionBadge = (action: string) => {
  const styles: Record<string, string> = {
    create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    update: 'bg-blue-100 text-blue-700 border-blue-300',
    delete: 'bg-red-100 text-red-700 border-red-300',
    login: 'bg-purple-100 text-purple-700 border-purple-300',
    logout: 'bg-gray-100 text-gray-700 border-gray-300',
    finance: 'bg-amber-100 text-amber-700 border-amber-300',
    export: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    import: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    backup: 'bg-orange-100 text-orange-700 border-orange-300',
    system: 'bg-slate-100 text-slate-700 border-slate-300',
  };
  const labels: Record<string, string> = {
    create: 'إضافة', update: 'تعديل', delete: 'حذف', login: 'دخول',
    logout: 'خروج', finance: 'مالي', export: 'تصدير', import: 'استيراد',
    backup: 'نسخة', system: 'نظام',
  };
  return { className: styles[action] || 'bg-gray-100 text-gray-700', label: labels[action] || action };
};

const getModuleLabel = (module: string) => {
  const labels: Record<string, string> = {
    students: 'الطلاب', teachers: 'الأساتذة', finance: 'المالي',
    users: 'الحسابات', attendance: 'الحضور', tasks: 'المهام',
    departments: 'الأقسام', registrations: 'التسجيلات',
    timetable: 'الجدول', timesheet: 'دوام الموظفين',
    messages: 'الرسائل', backup: 'النسخ الاحتياطي',
    system: 'النظام', reports: 'التقارير',
  };
  return labels[module] || module;
};

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({ total: 0, today: 0, createCount: 0, updateCount: 0, deleteCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterModule !== 'all') params.set('module', filterModule);
      if (filterAction !== 'all') params.set('action', filterAction);
      params.set('limit', '200');
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setStats(data.stats || { total: 0, today: 0, createCount: 0, updateCount: 0, deleteCount: 0 });
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterModule, filterAction]);

  const handleCleanup = async () => {
    if (!confirm('حذف جميع السجلات الأقدم من 90 يوماً؟')) return;
    try {
      const res = await fetch('/api/audit-logs?olderThanDays=90', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: data.message });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    }
  };

  // فلترة بالبحث النصي
  const filteredLogs = logs.filter(log =>
    !search ||
    log.description.toLowerCase().includes(search.toLowerCase()) ||
    log.userName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-100">
            <History className="w-7 h-7 text-slate-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">سجل النشاط</h2>
            <p className="text-muted-foreground text-sm">
              تتبع كل العمليات الحساسة في النظام
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={handleCleanup}>
            <Trash2 className="w-4 h-4 ml-1" /> حذف القديم
          </Button>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
            <p className="text-xl font-bold num text-slate-700">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">اليوم</p>
            <p className="text-xl font-bold num text-blue-600">{stats.today}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">إضافات</p>
            <p className="text-xl font-bold num text-emerald-600">{stats.createCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">تعديلات</p>
            <p className="text-xl font-bold num text-blue-600">{stats.updateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">حذف</p>
            <p className="text-xl font-bold num text-red-600">{stats.deleteCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الوصف أو الاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger><SelectValue placeholder="كل الوحدات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الوحدات</SelectItem>
                <SelectItem value="students">الطلاب</SelectItem>
                <SelectItem value="finance">المالي</SelectItem>
                <SelectItem value="users">الحسابات</SelectItem>
                <SelectItem value="attendance">الحضور</SelectItem>
                <SelectItem value="tasks">المهام</SelectItem>
                <SelectItem value="backup">النسخ الاحتياطي</SelectItem>
                <SelectItem value="system">النظام</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger><SelectValue placeholder="كل العمليات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العمليات</SelectItem>
                <SelectItem value="create">إضافة</SelectItem>
                <SelectItem value="update">تعديل</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
                <SelectItem value="login">دخول</SelectItem>
                <SelectItem value="logout">خروج</SelectItem>
                <SelectItem value="finance">مالي</SelectItem>
                <SelectItem value="backup">نسخ احتياطي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* السجلات */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">جاري التحميل...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد سجلات</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                            {badge.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {getModuleLabel(log.module)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 num">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-tight">{log.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.userName}
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {log.userRole === 'director' ? 'مدير' : 'موظف'}
                          </Badge>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
