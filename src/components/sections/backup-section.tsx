'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Database, HardDriveDownload, Clock, FileArchive, Loader2, RefreshCw, Plus, HardDrive,
  Download, RotateCcw, AlertTriangle, Cloud, Send, CheckCircle2, Settings as SettingsIcon, Upload, Building2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Backup {
  filename: string;
  size: number;
  createdAt: string;
  type?: 'local' | 'cloud' | 'uploaded' | 'other';
  branchPrefix?: string | null;
  branchName?: string | null;
}

interface BackupListResponse {
  backups: Backup[];
  count: number;
  totalSize: number;
  lastBackup: string | null;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function BackupSection() {
  const [data, setData] = useState<BackupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<Backup | null>(null);
  // ===== استرجاع فرع محدد =====
  const [branchRestoreBackup, setBranchRestoreBackup] = useState<Backup | null>(null);
  const [branchesInBackup, setBranchesInBackup] = useState<any[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [restoreBranchConfirm, setRestoreBranchConfirm] = useState(false);
  const [restoringBranch, setRestoringBranch] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/list');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast({ title: 'خطأ', description: 'تعذر تحميل النسخ الاحتياطية', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/backup/run', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast({
          title: 'تم',
          description: `تم إنشاء النسخة الاحتياطية: ${json.filename} (${formatSize(json.size)})`,
        });
        await load();
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل الإنشاء', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (backup: Backup) => {
    // Direct browser download
    const link = document.createElement('a');
    link.href = `/api/backup/download?filename=${encodeURIComponent(backup.filename)}`;
    link.download = backup.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'جاري التنزيل', description: backup.filename });
  };

  const handleRestoreConfirm = (backup: Backup) => {
    setRestoreConfirm(backup);
  };

  // ===== استرجاع فرع محدد =====
  const handleBranchRestoreClick = async (backup: Backup) => {
    setBranchRestoreBackup(backup);
    setSelectedBranchId(null);
    setBranchesInBackup([]);
    setRestoreBranchConfirm(false);
    setLoadingBranches(true);
    try {
      const res = await fetch(`/api/backup/branches?filename=${encodeURIComponent(backup.filename)}`);
      const data = await res.json();
      if (res.ok) {
        setBranchesInBackup(data.branches || []);
      } else {
        toast({ title: 'خطأ', description: data.error || 'تعذر قراءة الفروع', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleBranchRestoreExecute = async () => {
    if (!branchRestoreBackup || !selectedBranchId) return;
    setRestoringBranch(true);
    try {
      const res = await fetch('/api/backup/restore-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: branchRestoreBackup.filename,
          branchId: selectedBranchId,
          confirmDelete: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'تم الاسترجاع',
          description: `${data.message}\nالطلاب: ${data.stats.restored.students} | الأساتذة: ${data.stats.restored.teachers} | المدفوعات: ${data.stats.restored.payments}`,
        });
        setBranchRestoreBackup(null);
        setSelectedBranchId(null);
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الاسترجاع', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setRestoringBranch(false);
    }
  };

  const handleRestoreExecute = async () => {
    if (!restoreConfirm) return;
    const filename = restoreConfirm.filename;
    setRestoring(filename);
    setRestoreConfirm(null);
    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast({
          title: 'تمت الاستعادة',
          description: `${json.message}. يجب إعادة تشغيل التطبيق.`,
        });
        await load();
      } else {
        toast({
          title: 'خطأ',
          description: json.error || json.details || 'فشل الاستعادة',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> النسخ الاحتياطي
          </h2>
          <p className="text-muted-foreground text-sm">إدارة النسخ الاحتياطية المحلية والسحابية</p>
        </div>
      </div>

      <Tabs defaultValue="local">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="local" className="gap-1">
            <HardDrive className="w-4 h-4" /> نسخ محلية
          </TabsTrigger>
          <TabsTrigger value="cloud" className="gap-1">
            <Cloud className="w-4 h-4" /> نسخ سحابية
          </TabsTrigger>
          <TabsTrigger value="auto" className="gap-1">
            <SettingsIcon className="w-4 h-4" /> نسخ تلقائي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="space-y-4 mt-4">
          {/* ===== Local backup tab ===== */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} /> تحديث
              </Button>
              <Button onClick={handleCreateBackup} disabled={creating}>
                {creating ? (
                  <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الإنشاء...</>
                ) : (
                  <><Plus className="w-4 h-4 ml-2" /> إنشاء نسخة احتياطية الآن</>
                )}
              </Button>
            </div>
          </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <HardDriveDownload className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-1">
              <p className="font-medium">معلومات النسخ الاحتياطي</p>
              <p className="text-amber-700">
                يتم نسخ قاعدة البيانات الحالية إلى مجلد النسخ الاحتياطية. يتم الاحتفاظ بآخر 10 نسخ فقط تلقائياً.
              </p>
              <p className="text-amber-700">
                <strong>للاستعادة:</strong> اختر نسخة من القائمة بالأسفل ثم اضغط زر "استعادة".
                سيتم أخذ نسخة احتياطية من القاعدة الحالية أولاً (للأمان)، ثم استبدالها بالنسخة المختارة.
                <strong className="text-red-700"> يجب إعادة تشغيل التطبيق بعد الاستعادة.</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">عدد النسخ</span>
              <FileArchive className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold num text-blue-700">
              {loading ? '...' : (data?.count ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">الحجم الكلي</span>
              <HardDrive className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold num text-amber-700">
              {loading ? '...' : (data ? formatSize(data.totalSize) : '0 B')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">آخر نسخة</span>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-emerald-700">
              {loading ? '...' : (data?.lastBackup ? formatDate(data.lastBackup) : 'لا توجد')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* قائمة النسخ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-primary" />
            قائمة النسخ الاحتياطية
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <div style={{ minWidth: '760px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0 z-10"
                style={{ gridTemplateColumns: '48px 1fr 90px 90px 100px 160px 130px' }}
              >
                <div className="text-center">#</div>
                <div className="text-center">اسم الملف</div>
                <div className="text-center">النوع</div>
                <div className="text-center">الفرع</div>
                <div className="text-center">الحجم</div>
                <div className="text-center">تاريخ الإنشاء</div>
                <div className="text-center">الإجراءات</div>
              </div>

              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : !data || data.backups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد نسخ احتياطية بعد. اضغط &quot;إنشاء نسخة احتياطية الآن&quot; للبدء.
                </div>
              ) : (
                data.backups.map((b, i) => {
                  const typeLabel = b.type === 'cloud' ? 'سحابية' :
                                   b.type === 'uploaded' ? 'مرفوعة' :
                                   b.type === 'local' ? 'محلية' : 'نسخة';
                  const typeColor = b.type === 'cloud' ? 'text-purple-600 bg-purple-50' :
                                   b.type === 'uploaded' ? 'text-blue-600 bg-blue-50' :
                                   b.type === 'local' ? 'text-emerald-600 bg-emerald-50' :
                                   'text-muted-foreground bg-muted';
                  // لون بادئة الفرع
                  const prefixColor = b.branchPrefix === 'MAIN' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                     b.branchPrefix === 'LEGACY' ? 'text-gray-600 bg-gray-50 border-gray-200' :
                                     'text-indigo-700 bg-indigo-50 border-indigo-200';
                  return (
                  <div
                    key={b.filename}
                    className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                    style={{ gridTemplateColumns: '48px 1fr 90px 90px 100px 160px 130px' }}
                  >
                    <div className="text-center num">
                      <Badge variant="secondary">{i + 1}</Badge>
                    </div>
                    <div className="text-right font-mono text-xs num break-all" title={b.filename}>{b.filename}</div>
                    <div className="text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColor}`}>
                        {typeLabel}
                      </span>
                    </div>
                    <div className="text-center">
                      {b.branchPrefix && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${prefixColor}`} title={b.branchName || b.branchPrefix}>
                          {b.branchPrefix}
                        </span>
                      )}
                    </div>
                    <div className="text-center num">{formatSize(b.size)}</div>
                    <div className="text-center num text-xs">{formatDate(b.createdAt)}</div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(b)}
                          title="تنزيل"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleBranchRestoreClick(b)}
                          disabled={restoringBranch}
                          title="استرجاع فرع محدد فقط"
                          className="h-8 w-8 p-0"
                        >
                          <Building2 className="w-4 h-4 text-purple-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRestoreConfirm(b)}
                          disabled={restoring !== null}
                          title="استعادة كاملة"
                          className="h-8 w-8 p-0"
                        >
                          {restoring === b.filename ? (
                            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                          ) : (
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Restore confirmation dialog ===== */}
      <Dialog open={!!restoreConfirm} onOpenChange={(o) => !o && setRestoreConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              تأكيد الاستعادة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              أنت على وشك استعادة قاعدة البيانات من النسخة:
            </p>
            <div className="p-3 bg-muted rounded-lg border">
              <p className="font-mono text-xs num break-all">{restoreConfirm?.filename}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {restoreConfirm && formatDate(restoreConfirm.createdAt)} • {restoreConfirm && formatSize(restoreConfirm.size)}
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
              <p className="font-medium flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> تنبيه:
              </p>
              <ul className="list-disc list-inside space-y-1 pr-2">
                <li>سيتم أخذ نسخة احتياطية من القاعدة الحالية أولاً (للأمان).</li>
                <li>جميع البيانات الحالية ستُستبدل بالبيانات من النسخة المختارة.</li>
                <li>البيانات المُدخَلة بعد تاريخ هذه النسخة ستُفقد.</li>
                <li><strong>يجب إعادة تشغيل التطبيق بعد الاستعادة</strong> (Ctrl+C ثم npm run dev).</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirm(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={handleRestoreExecute}
              disabled={restoring !== null}
            >
              {restoring ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاستعادة...</> : <><RotateCcw className="w-4 h-4 ml-2" /> استعادة الآن</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Branch-specific restore dialog ===== */}
      <Dialog open={!!branchRestoreBackup} onOpenChange={(o) => !o && setBranchRestoreBackup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Building2 className="w-5 h-5" />
              استرجاع فرع محدد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm">
              اختر الفرع الذي تريد استرجاع بياناته من النسخة:
            </p>
            <p className="text-xs text-muted-foreground font-mono break-all bg-muted p-2 rounded">
              {branchRestoreBackup?.filename}
            </p>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <p className="font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> ميزة آمنة:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>سيتم استبدال بيانات الفرع المحدد فقط</li>
                <li>بيانات الفروع الأخرى لن تتأثر</li>
                <li>مناسب لاسترجاع نسخة من فرع على خادم فرع آخر</li>
              </ul>
            </div>

            {loadingBranches ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="mr-2 text-sm">جاري قراءة الفروع...</span>
              </div>
            ) : branchesInBackup.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground space-y-2">
                <AlertTriangle className="w-10 h-10 mx-auto opacity-50" />
                <p className="font-medium">لا توجد بيانات قابلة للاسترجاع في هذه النسخة</p>
                <p className="text-xs">قد تكون النسخة:</p>
                <div className="text-xs space-y-1 bg-muted/50 p-3 rounded-lg max-w-md mx-auto">
                  <p>• نسخة فارغة أو تالفة</p>
                  <p>• نسخة قديمة قبل إضافة الجداول</p>
                  <p>• لا تحتوي على طلاب أو أساتذة</p>
                </div>
                <p className="text-xs mt-2">
                  💡 استخدم زر <span className="text-amber-600 font-medium">"استعادة كاملة"</span> (الأيقونة الكهرمانية)
                  لاسترجاع النسخة بالكامل بدلاً من فرع محدد
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Label className="text-sm font-medium">الفروع المتوفرة في النسخة:</Label>
                  {branchesInBackup.map((branch) => (
                    <label
                      key={branch.id}
                      className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedBranchId === branch.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-muted hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="branchSelect"
                        value={branch.id}
                        checked={selectedBranchId === branch.id}
                        onChange={(e) => {
                          setSelectedBranchId(e.target.value);
                          setRestoreBranchConfirm(false);
                        }}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{branch.name}</span>
                          {branch.code && <Badge variant="outline" className="text-xs">{branch.code}</Badge>}
                          {branch.receiptPrefix && <Badge variant="secondary" className="text-xs">{branch.receiptPrefix}</Badge>}
                          {!branch.isActive && <Badge variant="destructive" className="text-xs">معطّل</Badge>}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>👥 {branch.stats.students} طالب</span>
                          <span>🎓 {branch.stats.teachers} أستاذ</span>
                          <span>💰 {branch.stats.payments} دفعة</span>
                          <span>💸 {branch.stats.expenses} مصروف</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedBranchId && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreBranchConfirm}
                        onChange={(e) => setRestoreBranchConfirm(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-amber-900">
                        أوافق على حذف بيانات هذا الفرع الحالية واستبدالها بالنسخة الاحتياطية
                      </span>
                    </label>

                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
                      <p className="font-medium">⚠️ تنبيه:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>سيتم حذف كل بيانات الفرع المحدد من القاعدة الحالية</li>
                        <li>سيتم استبدالها ببيانات الفرع من النسخة الاحتياطية</li>
                        <li>بيانات الفروع الأخرى ستبقى كما هي</li>
                        <li>لا يمكن التراجع عن هذه العملية</li>
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchRestoreBackup(null)}>إلغاء</Button>
            <Button
              variant="default"
              disabled={!selectedBranchId || !restoreBranchConfirm || restoringBranch || branchesInBackup.length === 0}
              onClick={handleBranchRestoreExecute}
            >
              {restoringBranch ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاسترجاع...</>
              ) : (
                <><Building2 className="w-4 h-4 ml-2" /> استرجاع الفرع</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Restore from external file (uploaded .db) ===== */}
      <RestoreFromUploadCard />
        </TabsContent>

        <TabsContent value="cloud" className="space-y-4 mt-4">
          <CloudBackupTab />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4 mt-4">
          <AutoBackupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Restore From Upload Card =====
function RestoreFromUploadCard() {
  const [uploading, setUploading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.db')) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون بصيغة .db', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الملف كبير جداً (حد أقصى 100 ميجا)', variant: 'destructive' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setRestoreConfirm(file);
  };

  const handleRestoreExecute = async () => {
    if (!restoreConfirm) return;
    const file = restoreConfirm;
    setUploading(true);
    setRestoreConfirm(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/backup/restore-upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: 'تمت الاستعادة',
          description: `${data.message}. يجب إعادة تشغيل التطبيق.`,
        });
      } else {
        toast({
          title: 'خطأ',
          description: data.error || 'فشل الاستعادة',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          استعادة من ملف خارجي (من Telegram أو أي مصدر)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-1">
          <p className="font-medium">استعادة قاعدة البيانات من ملف .db خارجي:</p>
          <ol className="list-decimal list-inside space-y-0.5 pr-2">
            <li>حمّل ملف .db من Telegram (أو من أي مصدر آخر)</li>
            <li>اضغط &quot;اختر ملف .db&quot; بالأسفل</li>
            <li>اختر الملف الذي حمّلته</li>
            <li>اضغط &quot;استعادة الآن&quot; في نافذة التأكيد</li>
            <li>أعد تشغيل التطبيق (Ctrl+C ثم npm run dev)</li>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,application/octet-stream"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {uploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاستعادة...</> : <><Upload className="w-4 h-4 ml-2" /> اختر ملف .db</>}
          </Button>
          <span className="text-xs text-muted-foreground">
            مثالي: backup-cloud-X-مركز1-20260730-223000.db (من Telegram)
          </span>
        </div>

        {/* Restore confirmation dialog */}
        <Dialog open={!!restoreConfirm} onOpenChange={(o) => !o && setRestoreConfirm(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                تأكيد استعادة ملف خارجي
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">أنت على وشك استبدال قاعدة البيانات الحالية بالملف المرفوع:</p>
              <div className="p-3 bg-muted rounded-lg border">
                <p className="font-mono text-xs num break-all">{restoreConfirm?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {restoreConfirm && formatSize(restoreConfirm.size)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> تنبيه:</p>
                <ul className="list-disc list-inside space-y-1 pr-2">
                  <li>سيتم أخذ نسخة احتياطية من القاعدة الحالية أولاً (للأمان).</li>
                  <li>جميع البيانات الحالية ستُستبدل بالبيانات من الملف المرفوع.</li>
                  <li>البيانات المُدخَلة بعد تاريخ النسخة ستُفقد.</li>
                  <li>مفيد لاسترجاع بيانات فرع آخر (من Telegram) أو العودة لنسخة سابقة.</li>
                  <li><strong>يجب إعادة تشغيل التطبيق بعد الاستعادة</strong> (Ctrl+C ثم npm run dev).</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreConfirm(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleRestoreExecute} disabled={uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاستعادة...</> : <><RotateCcw className="w-4 h-4 ml-2" /> استعادة الآن</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ===== Cloud Backup Tab =====
function CloudBackupTab() {
  const [settings, setSettings] = useState<any>({
    cloud_backup_provider: 'none',
    cloud_backup_telegram_token: '',
    cloud_backup_telegram_chat_id: '',
    cloud_backup_webhook_url: '',
    cloud_backup_frequency: 'manual',
    cloud_backup_last_sync: '',
    cloud_backup_last_status: 'never',
    cloud_backup_last_error: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/cloud/settings');
      const data = await res.json();
      if (data.settings) {
        // Use actual values (no masking) — director-only endpoint
        setSettings({
          ...data.settings,
          _hasToken: !!data.settings.cloud_backup_telegram_token,
          _hasGoogleSa: !!data.settings.cloud_backup_googledrive_service_account,
        });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحميل الإعدادات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Auto-sync based on frequency (check on mount)
  useEffect(() => {
    const checkAutoSync = async () => {
      try {
        // Get latest settings
        const res = await fetch('/api/backup/cloud/settings');
        const data = await res.json();
        if (!data.settings) return;
        const freq = data.settings.cloud_backup_frequency;
        const lastSync = data.settings.cloud_backup_last_sync;
        const provider = data.settings.cloud_backup_provider;
        if (provider === 'none' || freq === 'manual') return;

        const now = Date.now();
        const lastTime = lastSync ? new Date(lastSync).getTime() : 0;
        const elapsed = now - lastTime;
        const shouldSync = (freq === 'daily' && elapsed >= 24 * 60 * 60 * 1000) ||
                           (freq === 'weekly' && elapsed >= 7 * 24 * 60 * 60 * 1000);
        if (!shouldSync) return;

        // Trigger sync silently
        const syncRes = await fetch('/api/backup/cloud/sync', { method: 'POST' });
        const syncData = await syncRes.json();
        if (syncRes.ok && syncData.ok) {
          toast({
            title: 'تم النسخ السحابي التلقائي',
            description: syncData.message,
          });
          load();
        }
      } catch {}
    };
    // Delay to let initial load complete
    const timer = setTimeout(checkAutoSync, 3000);
    return () => clearTimeout(timer);
  }, []);

  const update = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...settings };
      // Remove UI-only fields
      delete payload._hasToken;
      delete payload._hasGoogleSa;
      const res = await fetch('/api/backup/cloud/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: 'تم', description: 'تم حفظ الإعدادات' });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const payload: any = {
        provider: settings.cloud_backup_provider,
        token: settings.cloud_backup_telegram_token,
        chatId: settings.cloud_backup_telegram_chat_id,
        webhookUrl: settings.cloud_backup_webhook_url,
        gdriveSa: settings.cloud_backup_googledrive_service_account,
        gdriveFolderId: settings.cloud_backup_googledrive_folder_id,
      };
      const res = await fetch('/api/backup/cloud/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: 'نجح الاختبار', description: data.message });
      } else {
        toast({ title: 'فشل الاختبار', description: data.error || 'خطأ غير معروف', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/backup/cloud/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({ title: 'تم', description: data.message });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل المزامنة', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const lastSyncDate = settings.cloud_backup_last_sync ? new Date(settings.cloud_backup_last_sync) : null;
  const lastSyncStr = lastSyncDate
    ? `${String(lastSyncDate.getDate()).padStart(2, '0')}/${String(lastSyncDate.getMonth() + 1).padStart(2, '0')}/${lastSyncDate.getFullYear()} ${String(lastSyncDate.getHours()).padStart(2, '0')}:${String(lastSyncDate.getMinutes()).padStart(2, '0')}`
    : 'لا توجد';

  return (
    <div className="space-y-4">
      {/* Status card */}
      <Card className={settings.cloud_backup_last_status === 'success' ? 'border-emerald-200 bg-emerald-50/50' : settings.cloud_backup_last_status === 'error' ? 'border-red-200 bg-red-50/50' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings.cloud_backup_last_status === 'success' ? 'bg-emerald-100 text-emerald-700' : settings.cloud_backup_last_status === 'error' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                {settings.cloud_backup_last_status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : settings.cloud_backup_last_status === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-medium">
                  {settings.cloud_backup_provider === 'none' ? 'النسخ السحابي غير مُفعَّل' :
                   settings.cloud_backup_provider === 'telegram' ? 'مُفعَّل عبر Telegram' :
                   settings.cloud_backup_provider === 'webhook' ? 'مُفعَّل عبر Webhook' :
                   settings.cloud_backup_provider === 'googledrive' ? 'مُفعَّل عبر Google Drive' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  آخر مزامنة: <span className="num">{lastSyncStr}</span>
                </p>
                {settings.cloud_backup_last_status === 'error' && settings.cloud_backup_last_error && (
                  <p className="text-xs text-red-600 mt-1">خطأ: {settings.cloud_backup_last_error}</p>
                )}
              </div>
            </div>
            <Button onClick={handleSync} disabled={syncing || settings.cloud_backup_provider === 'none'}>
              {syncing ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري المزامنة...</> : <><Cloud className="w-4 h-4 ml-2" /> مزامنة الآن</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" /> إعدادات المزود
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>المزود السحابي</Label>
            <Select value={settings.cloud_backup_provider} onValueChange={(v) => update('cloud_backup_provider', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">غير مُفعَّل</SelectItem>
                <SelectItem value="telegram">Telegram (مجاني، مُوصى به)</SelectItem>
                <SelectItem value="googledrive">Google Drive (يتطلب Workspace مدفوع)</SelectItem>
                <SelectItem value="webhook">Webhook (n8n, Zapier, خادم مخصص)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.cloud_backup_provider === 'googledrive' && '⚠ Google Drive مع Service Account لا يعمل مع Gmail المجاني (لا يوجد quota). استخدم Telegram بدلاً من ذلك.'}
              {settings.cloud_backup_provider === 'telegram' && 'Telegram: مجاني ويعمل في الجزائر. أنشئ Bot عبر @BotFather واستخدمه لإرسال النسخ الاحتياطية.'}
              {settings.cloud_backup_provider === 'webhook' && 'Webhook يرسل الملف إلى أي URL (n8n, Zapier, Discord, خادم مخصص).'}
            </p>
          </div>

          {/* Telegram settings */}
          {settings.cloud_backup_provider === 'telegram' && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-900 flex items-center gap-1">
                <Send className="w-4 h-4" /> خطوات إعداد Telegram Bot:
              </div>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside pr-2">
                <li>افتح Telegram وابحث عن <code dir="ltr" className="bg-blue-100 px-1 rounded">@BotFather</code></li>
                <li>أرسل <code dir="ltr" className="bg-blue-100 px-1 rounded">/newbot</code> وأنشئ bot جديد</li>
                <li>انسخ الـ Token الناتج (مثل: <code dir="ltr" className="bg-blue-100 px-1 rounded">123456:ABC-DEF...</code>)</li>
                <li>أضف الـ Bot إلى قناة/مجموعة واحصل على Chat ID</li>
                <li>للحصول على Chat ID: أرسل رسالة للـ bot ثم افتح <code dir="ltr" className="bg-blue-100 px-1 rounded">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
              </ol>
              <div className="space-y-2">
                <Label>Bot Token {settings._hasToken && <span className="text-xs text-muted-foreground">(محفوظ — اتركه فارغاً للإبقاء عليه)</span>}</Label>
                <Input
                  type="password"
                  value={settings.cloud_backup_telegram_token || ''}
                  onChange={(e) => update('cloud_backup_telegram_token', e.target.value)}
                  placeholder={settings._hasToken ? '•••••••• (محفوظ)' : '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>Chat ID</Label>
                <Input
                  value={settings.cloud_backup_telegram_chat_id || ''}
                  onChange={(e) => update('cloud_backup_telegram_chat_id', e.target.value)}
                  placeholder="-1001234567890 (للقنوات) أو 123456789 (للمحادثات)"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Webhook settings */}
          {settings.cloud_backup_provider === 'webhook' && (
            <div className="space-y-3 p-3 bg-purple-50/50 rounded-lg border border-purple-200">
              <div className="text-sm font-medium text-purple-900">إعدادات Webhook:</div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={settings.cloud_backup_webhook_url || ''}
                  onChange={(e) => update('cloud_backup_webhook_url', e.target.value)}
                  placeholder="https://example.com/webhook أو https://hooks.zapier.com/..."
                  dir="ltr"
                />
                <p className="text-xs text-purple-800">
                  سيتم إرسال ملف <code>.db</code> كـ multipart/form-data مع حقل <code>file</code>.
                </p>
              </div>
            </div>
          )}

          {/* Google Drive settings */}
          {settings.cloud_backup_provider === 'googledrive' && (
            <div className="space-y-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
              {/* Quota warning */}
              <div className="p-2 bg-red-100 border border-red-400 rounded text-xs text-red-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>⚠ تنبيه مهم:</strong> Service Accounts لا تملك مساحة تخزين في الحسابات المجانية (Gmail).
                  ستحصل على خطأ "storage quota" عند الرفع.
                  <div className="mt-1">
                    <strong>الحلول البديلة:</strong>
                    <ul className="list-disc list-inside mt-0.5">
                      <li>استخدم <strong>Telegram</strong> (مجاني، بدون قيود) — مُوصى به</li>
                      <li>أو استخدم Google Workspace (مدفوع) مع Shared Drives</li>
                      <li>أو استخدم <strong>Webhook</strong> مع خادمك الخاص</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-sm font-medium text-emerald-900">خطوات إعداد Google Drive Service Account:</div>
              <ol className="text-xs text-emerald-800 space-y-1 list-decimal list-inside pr-2">
                <li>اذهب إلى <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline">Google Cloud Console</a></li>
                <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
                <li>فعّل <strong>Google Drive API</strong>: <a href="https://console.developers.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline">رابط التفعيل</a> ← اضغط "Enable"</li>
                <li>من القائمة: <strong>IAM &amp; Admin → Service Accounts → Create</strong></li>
                <li>أنشئ Service Account جديد بدون أي صلاحيات</li>
                <li>اضغط على الحساب → <strong>Keys → Add Key → Create New Key → JSON</strong></li>
                <li>نزّل ملف JSON — افتحه وانسخ محتواه بالكامل</li>
                <li>الصق المحتوى في الحقل بالأسفل</li>
                <li><strong>اختياري:</strong> أنشئ مجلد في Google Drive وشاركه مع البريد الإلكتروني للحساب (<code dir="ltr">xxx@xxx.iam.gserviceaccount.com</code>) مع صلاحية "محرر"</li>
                <li><strong>اختياري:</strong> انسخ معرّف المجلد من URL (مثل: <code dir="ltr">https://drive.google.com/drive/folders/<b>1ABC...</b></code>)</li>
              </ol>

              {/* Important: Enable Drive API banner */}
              <div className="p-2 bg-amber-100 border border-amber-400 rounded text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>مهم جداً:</strong> يجب تفعيل <strong>Google Drive API</strong> قبل أول مزامنة.
                  <a href="https://console.developers.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="text-amber-700 underline block mt-1">
                    اضغط هنا لتفعيل Google Drive API →
                  </a>
                  <span className="block mt-1 text-amber-700">بعد التفعيل، انتظر 1-2 دقيقة ثم اضغط "مزامنة الآن".</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Service Account JSON{' '}
                  {settings._hasGoogleSa && <span className="text-xs text-muted-foreground">(محفوظ — اتركه فارغاً للإبقاء عليه)</span>}
                </Label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  value={settings.cloud_backup_googledrive_service_account || ''}
                  onChange={(e) => update('cloud_backup_googledrive_service_account', e.target.value)}
                  placeholder={settings._hasGoogleSa ? '(محفوظ — اتركه فارغاً للإبقاء عليه)' : '{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "client_email": "...@....iam.gserviceaccount.com",\n  ...\n}'}
                  dir="ltr"
                />
                <p className="text-xs text-emerald-700">
                  🔒 الـ JSON محفوظ في قاعدة البيانات (مشفر بصلاحية المدير فقط). لا يُعرض بعد الحفظ.
                </p>
              </div>

              {/* Show Service Account email + share instructions */}
              <ServiceAccountEmailCard saJson={settings.cloud_backup_googledrive_service_account} hasSavedSa={settings._hasGoogleSa} />

              <div className="space-y-2">
                <Label>Folder ID (اختياري)</Label>
                <Input
                  value={settings.cloud_backup_googledrive_folder_id || ''}
                  onChange={(e) => update('cloud_backup_googledrive_folder_id', e.target.value)}
                  placeholder="1ABC...XYZ (من URL المجلد)"
                  dir="ltr"
                />
                <p className="text-xs text-emerald-700">
                  إذا تُرك فارغاً، سيتم الرفع إلى المجلد الجذر للـ Service Account.
                  <strong> إذا وضعت Folder ID، يجب مشاركة المجلد مع البريد الإلكتروني أعلاه بصلاحية "محرر".</strong>
                </p>
              </div>
            </div>
          )}

          {/* Frequency */}
          {settings.cloud_backup_provider !== 'none' && (
            <div className="space-y-2">
              <Label>تكرار النسخ التلقائي</Label>
              <Select value={settings.cloud_backup_frequency} onValueChange={(v) => update('cloud_backup_frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">يدوي فقط (عند الضغط على الزر)</SelectItem>
                  <SelectItem value="daily">يومياً (عند فتح التطبيق)</SelectItem>
                  <SelectItem value="weekly">أسبوعياً (كل 7 أيام)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                النسخ التلقائي يحدث عند فتح التطبيق إذا مرّ الوقت المحدد. (يتطلب بقاء التطبيق مفتوحاً)
              </p>
            </div>
          )}

          {/* Action buttons */}
          {settings.cloud_backup_provider !== 'none' && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</> : <>حفظ الإعدادات</>}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاختبار...</> : <><Send className="w-4 h-4 ml-2" /> اختبار الاتصال</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore from cloud card */}
      <CloudRestoreCard onReload={load} />

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 space-y-1">
              <p className="font-medium">لماذا النسخ السحابي؟</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-800">
                <li>حماية من فقدان البيانات (عطل الجهاز، سرقة، فيروس)</li>
                <li>وصول للنسخ من أي مكان</li>
                <li><strong>Google Drive</strong>: 15 جيجا مجاناً، يدمج مع Google Workspace</li>
                <li><strong>Telegram</strong>: مجاني، حتى 50 ميجا لكل ملف</li>
                <li><strong>Webhook</strong>: مرونة كاملة (n8n, Zapier، خادم مخصص)</li>
                <li>النسخة السحابية تحتوي على كل البيانات (طلاب، أساتذة، مدفوعات، إلخ)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Cloud Restore Card — lists files in Google Drive + allows restore =====
function CloudRestoreCard({ onReload }: { onReload: () => void }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<any | null>(null);
  const { toast } = useToast();

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/cloud/list');
      const data = await res.json();
      if (res.ok && data.ok) {
        setFiles(data.files || []);
      } else {
        toast({ title: 'خطأ', description: data.error || 'تعذر تحميل القائمة', variant: 'destructive' });
        setFiles([]);
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (file: any) => {
    const link = document.createElement('a');
    link.href = `/api/backup/cloud/download?fileId=${encodeURIComponent(file.id)}`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'جاري التنزيل', description: file.name });
  };

  const handleRestoreExecute = async () => {
    if (!restoreConfirm) return;
    const fileId = restoreConfirm.id;
    const filename = restoreConfirm.name;
    setRestoring(fileId);
    setRestoreConfirm(null);
    try {
      const res = await fetch('/api/backup/cloud/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: 'تمت الاستعادة',
          description: `${data.message}. يجب إعادة تشغيل التطبيق.`,
        });
        onReload();
      } else {
        toast({
          title: 'خطأ',
          description: data.error || data.details || 'فشل الاستعادة',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" />
            استرجاع نسخة من السحابة
          </div>
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحميل...</> : <><RefreshCw className="w-4 h-4 ml-2" /> عرض الملفات</>}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          يستعرض هذا القسم النسخ الاحتياطية الموجودة في Google Drive ويسمح بتنزيلها أو استعادتها.
          مفيد لاسترجاع بيانات فرع آخر أو العودة إلى نسخة سابقة.
        </p>

        {files.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {loading ? 'جاري التحميل...' : 'اضغط "عرض الملفات" لاستعراض النسخ المتوفرة في Google Drive'}
          </div>
        ) : (
          <div style={{ minWidth: '600px' }} className="overflow-x-auto max-h-80 overflow-y-auto border rounded-lg">
            {/* Header */}
            <div
              className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0 z-10"
              style={{ gridTemplateColumns: '1fr 90px 140px 110px' }}
            >
              <div className="text-center">اسم الملف</div>
              <div className="text-center">الحجم</div>
              <div className="text-center">آخر تعديل</div>
              <div className="text-center">إجراءات</div>
            </div>
            {/* Rows */}
            {files.map((f) => (
              <div
                key={f.id}
                className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 text-sm"
                style={{ gridTemplateColumns: '1fr 90px 140px 110px' }}
              >
                <div className="text-right font-mono text-xs num break-all" title={f.name}>{f.name}</div>
                <div className="text-center num">{f.sizeLabel}</div>
                <div className="text-center num text-xs">{formatDate(f.modifiedTime)}</div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(f)}
                      title="تنزيل إلى الجهاز"
                      className="h-8 w-8 p-0"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRestoreConfirm(f)}
                      disabled={restoring !== null}
                      title="استعادة (استبدال القاعدة الحالية)"
                      className="h-8 w-8 p-0"
                    >
                      {restoring === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                      ) : (
                        <RotateCcw className="w-4 h-4 text-amber-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restore confirmation dialog */}
        <Dialog open={!!restoreConfirm} onOpenChange={(o) => !o && setRestoreConfirm(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                تأكيد استعادة نسخة سحابية
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">أنت على وشك استبدال قاعدة البيانات الحالية بالنسخة السحابية:</p>
              <div className="p-3 bg-muted rounded-lg border">
                <p className="font-mono text-xs num break-all">{restoreConfirm?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {restoreConfirm?.sizeLabel} • {restoreConfirm && formatDate(restoreConfirm.modifiedTime)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> تنبيه:</p>
                <ul className="list-disc list-inside space-y-1 pr-2">
                  <li>سيتم أخذ نسخة احتياطية من القاعدة الحالية أولاً (تُحفظ محلياً).</li>
                  <li>جميع البيانات الحالية ستُستبدل بالبيانات من النسخة السحابية.</li>
                  <li>البيانات المُدخَلة بعد تاريخ النسخة ستُفقد.</li>
                  <li>مفيد لاسترجاع بيانات فرع آخر أو العودة لنسخة سابقة.</li>
                  <li><strong>يجب إعادة تشغيل التطبيق بعد الاستعادة</strong> (Ctrl+C ثم npm run dev).</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreConfirm(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleRestoreExecute} disabled={restoring !== null}>
                {restoring ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الاستعادة...</> : <><RotateCcw className="w-4 h-4 ml-2" /> استعادة الآن</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ===== Service Account Email Card — shows the SA email + share instructions =====
function ServiceAccountEmailCard({ saJson, hasSavedSa }: { saJson: string; hasSavedSa: boolean }) {
  const { toast } = useToast();
  // Try to extract client_email from the JSON being typed (live)
  let email: string | null = null;
  if (saJson && saJson.startsWith('{')) {
    try {
      const parsed = JSON.parse(saJson);
      email = parsed.client_email || null;
    } catch {
      // Not valid JSON yet — try regex
      const match = saJson.match(/"client_email"\s*:\s*"([^"]+)"/);
      if (match) email = match[1];
    }
  }

  const handleCopy = () => {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      toast({ title: 'تم النسخ', description: 'تم نسخ البريد الإلكتروني' });
    }).catch(() => {
      toast({ title: 'تعذر النسخ', description: 'انسخ البريد يدوياً', variant: 'destructive' });
    });
  };

  if (!email && !hasSavedSa) return null;

  return (
    <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
      <div className="text-xs font-medium text-amber-900 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> مهم: شارك المجلد مع هذا البريد
      </div>
      {email ? (
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 break-all">
            {email}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopy} className="flex-shrink-0">
            نسخ
          </Button>
        </div>
      ) : (
        <p className="text-xs text-amber-800">
          البريد محفوظ لكن غير معروض (للأمان). احفظ الإعدادات ثم اضغط "اختبار الاتصال" — ستظهر رسالة الخطأ مع البريد.
        </p>
      )}
      <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside pr-2">
        <li>افتح <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-amber-700 underline">Google Drive</a> في المتصفح</li>
        <li>اضغط يميناً على المجلد ← "مشاركة" ← "مشاركة"</li>
        <li>الصق البريد الإلكتروني أعلاه</li>
        <li>اختر صلاحية <strong>"محرر"</strong></li>
        <li>اضغط "إرسال" (قد يطلب تأكيد — اضغط "مشاركة على أي حال")</li>
      </ol>
      <p className="text-xs text-amber-700">
        💡 بدلاً من ذلك، اترك <strong>Folder ID فارغاً</strong> — سيتم الرفع إلى مجلد Service Account الخاص (يمكنك الوصول له فقط عبر API).
      </p>
    </div>
  );
}

// ===== تبويب النسخ التلقائي =====
function AutoBackupTab() {
  const [status, setStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggeringNow, setTriggeringNow] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backup/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setSettings(data.settings);
        setStats(data.stats);
        setRecentLogs(data.recentLogs || []);
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'تعذر التحميل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/backup/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: 'تم حفظ الإعدادات' });
        setSettings(data.settings);
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    setTriggeringNow(true);
    try {
      const res = await fetch('/api/backup/auto', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast({
          title: 'تم',
          description: `تم إنشاء نسخة تلقائية${data.local?.filename ? ': ' + data.local.filename : ''}`,
        });
        load();
      } else if (data.skipped) {
        toast({
          title: 'تم تخطي النسخ',
          description: data.reason || 'لم يحين وقت النسخ',
        });
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setTriggeringNow(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const freqLabels: Record<string, string> = {
    'every6h': 'كل 6 ساعات',
    'every12h': 'كل 12 ساعة',
    'daily': 'يومياً',
    'weekly': 'أسبوعياً',
  };

  return (
    <div className="space-y-4">
      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي النسخ</span>
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{stats?.totalBackups || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">نسخ تلقائية</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700">{stats?.autoBackups || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">نسخ يدوية</span>
              <HardDrive className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats?.manualBackups || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">حجم النسخ</span>
              <FileArchive className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-700">{stats?.diskSizeMB || 0} MB</p>
          </CardContent>
        </Card>
      </div>

      {/* بطاقة حالة النسخ التلقائي */}
      <Card className={settings?.autoBackupEnabled ? 'border-emerald-300 bg-emerald-50/50' : 'border-muted'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              حالة النسخ التلقائي
            </span>
            <Badge variant={settings?.autoBackupEnabled ? 'default' : 'secondary'}>
              {settings?.autoBackupEnabled ? 'مُفعّل' : 'معطّل'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings?.autoBackupEnabled ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">آخر نسخة تلقائية:</span>
                  <span className="font-medium">
                    {settings?.lastAutoBackupAt ? formatDate(settings.lastAutoBackupAt) : 'لا توجد'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">النسخة القادمة:</span>
                  <span className="font-medium">{status?.timeUntilNextBackup || '-'}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">التكرار:</span>
                  <span className="font-medium">{freqLabels[settings?.frequency] || settings?.frequency}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">الوقت المجدول:</span>
                  <span className="font-medium num" dir="ltr">{settings?.scheduledTime}</span>
                </div>
              </div>
              <Button onClick={handleTriggerNow} disabled={triggeringNow} className="w-full">
                {triggeringNow ? (
                  <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الفحص...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 ml-2" /> فحص ونسخ الآن (محلي + سحابي)</>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>النسخ التلقائي معطّل. فعّله من الإعدادات أدناه.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* بطاقة حالة النسخ السحابي */}
      {status?.cloud && status.cloud.provider !== 'none' && (
        <Card className={status.cloud.lastStatus === 'success' ? 'border-emerald-300 bg-emerald-50/50' : status.cloud.lastStatus === 'error' ? 'border-red-300 bg-red-50/50' : 'border-muted'}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                حالة النسخ السحابي التلقائي
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{status.cloud.provider === 'telegram' ? 'Telegram' : status.cloud.provider === 'googledrive' ? 'Google Drive' : status.cloud.provider === 'webhook' ? 'Webhook' : status.cloud.provider}</Badge>
                <Badge variant={status.cloud.frequency !== 'manual' ? 'default' : 'secondary'}>
                  {status.cloud.frequency !== 'manual' ? 'تلقائي' : 'يدوي'}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">آخر مزامنة:</span>
                <span className="font-medium">
                  {status.cloud.lastSync ? formatDate(status.cloud.lastSync) : 'لا توجد'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">النسخة القادمة:</span>
                <span className="font-medium">{status.cloud.timeUntilNextCloudBackup || '-'}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">الحالة:</span>
                <Badge variant={status.cloud.lastStatus === 'success' ? 'default' : status.cloud.lastStatus === 'error' ? 'destructive' : 'secondary'}>
                  {status.cloud.lastStatus === 'success' ? '✓ نجح' : status.cloud.lastStatus === 'error' ? '✗ فشل' : '—'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">التكرار:</span>
                <span className="font-medium">{freqLabels[status.cloud.frequency] || status.cloud.frequency}</span>
              </div>
            </div>
            {status.cloud.lastError && status.cloud.lastStatus === 'error' && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                <strong>آخر خطأ:</strong> {status.cloud.lastError}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              💡 لإعداد النسخ السحابي (Telegram/Google Drive/Webhook)، اذهب إلى تبويب "نسخ سحابية"
            </p>
          </CardContent>
        </Card>
      )}

      {/* بطاقة الإعدادات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SettingsIcon className="w-5 h-5" />
            إعدادات النسخ التلقائي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <Label className="font-medium">تفعيل النسخ التلقائي</Label>
              <p className="text-xs text-muted-foreground mt-0.5">إنشاء نسخة احتياطية تلقائياً حسب الجدول</p>
            </div>
            <Button
              variant={settings?.autoBackupEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSetting('autoBackupEnabled', !settings?.autoBackupEnabled)}
            >
              {settings?.autoBackupEnabled ? '✓ مُفعّل' : 'معطّل'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>تكرار النسخ</Label>
            <Select
              value={settings?.frequency || 'daily'}
              onValueChange={(v) => updateSetting('frequency', v)}
              disabled={!settings?.autoBackupEnabled}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="every6h">كل 6 ساعات</SelectItem>
                <SelectItem value="every12h">كل 12 ساعة</SelectItem>
                <SelectItem value="daily">يومياً</SelectItem>
                <SelectItem value="weekly">أسبوعياً</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>وقت النسخ اليومي</Label>
            <Input
              type="time"
              value={settings?.scheduledTime || '02:00'}
              onChange={(e) => updateSetting('scheduledTime', e.target.value)}
              disabled={!settings?.autoBackupEnabled || settings?.frequency === 'every6h' || settings?.frequency === 'every12h'}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">يُستخدم فقط عند اختيار "يومياً" أو "أسبوعياً"</p>
          </div>

          <div className="space-y-2">
            <Label>عدد النسخ المحتفظ بها (الحد الأقصى)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={settings?.maxBackups || 30}
              onChange={(e) => updateSetting('maxBackups', parseInt(e.target.value) || 30)}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">سيتم حذف النسخ الأقدم تلقائياً عند تجاوز هذا العدد</p>
          </div>

          <div className="space-y-2">
            <Label>خيارات إضافية</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.notifyOnAutoBackup || false}
                  onChange={(e) => updateSetting('notifyOnAutoBackup', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">إشعار عند كل نسخة تلقائية ناجحة</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.notifyOnBackupFailure ?? true}
                  onChange={(e) => updateSetting('notifyOnBackupFailure', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">إشعار عند فشل النسخ التلقائي (مُوصى به)</span>
              </label>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 ml-2" /> حفظ الإعدادات</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* سجل العمليات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">آخر العمليات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد عمليات مسجلة</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border-b hover:bg-muted/30 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      log.status === 'success' ? 'default' :
                      log.status === 'failed' ? 'destructive' : 'secondary'
                    }>
                      {log.status === 'success' ? 'نجح' : log.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
                    </Badge>
                    <Badge variant="outline">
                      {log.type === 'auto' ? 'تلقائي' : log.type === 'manual' ? 'يدوي' : log.type === 'restore' ? 'استرجاع' : log.type}
                    </Badge>
                    <span className="text-muted-foreground text-xs num" dir="ltr">{log.filename}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-muted-foreground num">{formatDate(log.createdAt)}</div>
                    {log.size > 0 && <div className="text-xs">{formatSize(log.size)}</div>}
                    {log.errorMessage && <div className="text-xs text-red-600">{log.errorMessage}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
