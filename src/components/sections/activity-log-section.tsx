'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  History, Search, Trash2, Download, RefreshCw, Filter,
  Plus, Edit, Trash, LogIn, LogOut, FileDown, FileUp, Printer, Eye, ShieldCheck, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  module: string;
  description: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  create: { icon: Plus, color: 'bg-emerald-100 text-emerald-700', label: 'إضافة' },
  update: { icon: Edit, color: 'bg-blue-100 text-blue-700', label: 'تعديل' },
  delete: { icon: Trash, color: 'bg-red-100 text-red-700', label: 'حذف' },
  login: { icon: LogIn, color: 'bg-purple-100 text-purple-700', label: 'دخول' },
  logout: { icon: LogOut, color: 'bg-gray-100 text-gray-700', label: 'خروج' },
  export: { icon: FileDown, color: 'bg-cyan-100 text-cyan-700', label: 'تصدير' },
  import: { icon: FileUp, color: 'bg-amber-100 text-amber-700', label: 'استيراد' },
  print: { icon: Printer, color: 'bg-indigo-100 text-indigo-700', label: 'طباعة' },
  view: { icon: Eye, color: 'bg-gray-100 text-gray-600', label: 'عرض' },
  verify: { icon: ShieldCheck, color: 'bg-teal-100 text-teal-700', label: 'تحقق' },
};

const moduleLabels: Record<string, string> = {
  students: 'الطلاب', teachers: 'الأساتذة', departments: 'الأقسام',
  registrations: 'التسجيلات', attendance: 'الحضور', tasks: 'المهام',
  finance: 'المالية', users: 'المستخدمون', timetable: 'الجدول',
  timesheet: 'حضور الموظفين', reports: 'التقارير', backup: 'النسخ الاحتياطي',
  exams: 'التقييمات', crm: 'العملاء', whatsapp: 'الرسائل',
  notifications: 'الإشعارات', calendar: 'التقويم', archive: 'الأرشيف',
  permissions: 'الصلاحيات', system: 'النظام', auth: 'المصادقة',
};

export function ActivityLogSection({ isDirector }: { isDirector: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (search) params.set('search', search);
      if (filterAction !== 'all') params.set('action', filterAction);
      if (filterModule !== 'all') params.set('module', filterModule);

      const res = await fetch(`/api/activity-log?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [search, filterAction, filterModule, page]);

  const handleClearOld = async () => {
    if (!confirm('Delete logs older than 90 days?')) return;
    const res = await fetch('/api/activity-log?olderThan=90', { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      toast({ title: 'Done', description: `Deleted ${data.deleted} old logs` });
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this log entry?')) return;
    await fetch(`/api/activity-log?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleExport = () => {
    const csv = [
      ['Date', 'User', 'Action', 'Module', 'Description'].join(','),
      ...logs.map(l => [
        new Date(l.createdAt).toLocaleString('fr-FR'),
        `"${l.userName || '-'}"`,
        actionConfig[l.action]?.label || l.action,
        moduleLabels[l.module] || l.module,
        `"${l.description.replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">سجل التغييرات</h2>
            <p className="text-sm text-muted-foreground">{total} نشاط مسجّل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="w-4 h-4 ml-2" /> تصدير CSV
          </Button>
          {isDirector && (
            <Button variant="outline" size="sm" onClick={handleClearOld}>
              <Trash2 className="w-4 h-4 ml-2" /> حذف القديم (90 يوم)
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في السجل..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pr-10"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل العمليات</option>
          {Object.entries(actionConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={filterModule}
          onChange={(e) => { setFilterModule(e.target.value); setPage(0); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل الأقسام</option>
          {Object.entries(moduleLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(actionConfig).slice(0, 6).map(([action, cfg]) => {
          const count = logs.filter(l => l.action === action).length;
          const Icon = cfg.icon;
          return (
            <div key={action} className={`p-2 rounded-lg border text-center ${cfg.color}`}>
              <Icon className="w-4 h-4 mx-auto mb-1" />
              <p className="text-xs font-medium">{cfg.label}</p>
              <p className="text-lg font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Log entries */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد سجلات</p>
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {logs.map(log => {
                const cfg = actionConfig[log.action] || { icon: Eye, color: 'bg-gray-100 text-gray-600', label: log.action };
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {moduleLabels[log.module] || log.module}
                        </Badge>
                        {log.userName && (
                          <span className="text-xs text-muted-foreground">👤 {log.userName}</span>
                        )}
                      </div>
                      <p className="text-sm">{log.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        {log.targetType && <span>الهدف: {log.targetType}</span>}
                      </div>
                    </div>
                    {isDirector && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(log.id)}>
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page + 1} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
