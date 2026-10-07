'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Database, HardDriveDownload, Clock, FileArchive, Loader2, RefreshCw, Plus, HardDrive,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Backup {
  filename: string;
  size: number;
  createdAt: string;
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

const formatDate = (iso: string) => new Date(iso).toLocaleString('ar-DZ');

export function BackupSection() {
  const [data, setData] = useState<BackupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" /> النسخ الاحتياطي
          </h2>
          <p className="text-muted-foreground text-sm">إدارة النسخ الاحتياطية لقاعدة البيانات</p>
        </div>
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
            <div className="text-sm text-amber-900">
              <p className="font-medium">معلومات النسخ الاحتياطي</p>
              <p className="mt-1 text-amber-700">
                يتم نسخ قاعدة البيانات الحالية إلى مجلد النسخ الاحتياطية. يتم الاحتفاظ بآخر 10 نسخ فقط تلقائياً.
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
          <CardTitle className="text-base">قائمة النسخ الاحتياطية</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>اسم الملف</TableHead>
                  <TableHead className="text-center">الحجم</TableHead>
                  <TableHead className="text-center">تاريخ الإنشاء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !data || data.backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      لا توجد نسخ احتياطية بعد. اضغط &quot;إنشاء نسخة احتياطية الآن&quot; للبدء.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.backups.map((b, i) => (
                    <TableRow key={b.filename} className="hover:bg-muted/50">
                      <TableCell className="text-center num">
                        <Badge variant="secondary">{i + 1}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs num">{b.filename}</TableCell>
                      <TableCell className="text-center num">{formatSize(b.size)}</TableCell>
                      <TableCell className="text-center num text-xs">{formatDate(b.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
