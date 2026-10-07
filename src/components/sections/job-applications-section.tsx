'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Search, Trash2, Download, FileText, Image as ImageIcon, File, Eye, X, Loader2, Upload, Briefcase,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JobApplication {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  diploma: string | null;
  experience: string | null;
  schedule: string;
  cvUrl: string | null;
  diplomaUrl: string | null;
  status: string;
  note: string | null;
  appliedAt: string;
  createdAt: string;
}

const formatDate = (iso: string | Date) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// تحويل URL إلى API endpoint (لضمان المعاينة الصحيحة)
const normalizeFileUrl = (url: string): string => {
  if (!url) return url;
  // إذا كان URL يبدأ بـ /uploads/jobs/، حوّله إلى API endpoint
  if (url.startsWith('/uploads/jobs/') || url.startsWith('uploads/jobs/')) {
    const filename = url.split('/').pop();
    return `/api/job-applications/file?path=uploads/jobs/${filename}`;
  }
  // إذا كان يبدأ بـ /download/job-files/
  if (url.startsWith('/download/job-files/') || url.startsWith('download/job-files/')) {
    const filename = url.split('/').pop();
    return `/api/job-applications/file?path=download/job-files/${filename}`;
  }
  // إذا كان بالفعل API endpoint، اتركه كما هو
  return url;
};

const getFileIcon = (url: string) => {
  const ext = url.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-600" />;
  if (['jpg', 'jpeg', 'png'].includes(ext)) return <ImageIcon className="w-4 h-4 text-blue-600" />;
  return <File className="w-4 h-4 text-gray-600" />;
};

const getFileType = (url: string): 'pdf' | 'image' | 'other' => {
  const ext = url.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  return 'other';
};

export function JobApplicationsSection() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState<any>({
    firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '',
    diploma: '', experience: '', schedule: 'full-time', note: '', status: 'pending',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(`/api/job-applications?${params.toString()}`);
      const data = await res.json();
      const apps = data.applications || [];
      // تشخيص: تحقق من وجود id في كل سجل
      apps.forEach((app: any, i: number) => {
        if (!app.id) {
          console.error(`⚠️ Record ${i} has no id! Keys:`, Object.keys(app), 'Values:', Object.values(app).slice(0, 3));
        }
      });
      console.log(`✅ Loaded ${apps.length} applications. First app id:`, apps[0]?.id);
      setApplications(apps);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, filterStatus]);

  const handleFileUpload = async (file: File, type: 'cv' | 'diploma'): Promise<string | null> => {
    if (type === 'cv') setUploadingCv(true);
    else setUploadingDiploma(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/job-applications/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل رفع الملف', variant: 'destructive' });
        return null;
      }

      toast({ title: 'تم', description: `تم رفع ${type === 'cv' ? 'السيرة الذاتية' : 'الدبلوم'}` });
      return data.fileUrl;
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      if (type === 'cv') setUploadingCv(false);
      else setUploadingDiploma(false);
    }
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName) {
      toast({ title: 'تنبيه', description: 'الاسم واللقب مطلوبان', variant: 'destructive' });
      return;
    }

    let cvUrl = editing?.cvUrl || null;
    let diplomaUrl = editing?.diplomaUrl || null;

    if (cvFile) {
      cvUrl = await handleFileUpload(cvFile, 'cv');
      if (!cvUrl) return;
    }
    if (diplomaFile) {
      diplomaUrl = await handleFileUpload(diplomaFile, 'diploma');
      if (!diplomaUrl) return;
    }

    const payload = {
      ...formData,
      birthDate: formData.birthDate || null,
      cvUrl,
      diplomaUrl,
    };

    const url = editing ? `/api/job-applications/${editing.id}` : '/api/job-applications';
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || 'فشل الحفظ';
        const details = data.details ? `\n${data.details}` : '';
        toast({
          title: 'خطأ',
          description: errorMsg + details,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      setCvFile(null);
      setDiplomaFile(null);
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (app: JobApplication) => {
    const displayName = app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'هذا الطلب';
    // تحقق من وجود id
    if (!app.id) {
      toast({
        title: 'خطأ',
        description: 'معرف السجل غير موجود. أعد تحميل الصفحة.',
        variant: 'destructive',
      });
      console.error('app.id is undefined! Full app object:', app);
      load();  // أعد تحميل القائمة
      return;
    }
    if (!confirm(`حذف طلب ${displayName}؟\nسيتم حذف البيانات والملفات المرفقة.`)) return;
    try {
      console.log('Deleting app with id:', app.id);
      const res = await fetch(`/api/job-applications/${app.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: 'تم', description: data.message || 'تم الحذف بنجاح' });
        load();
      } else {
        // عرض رسالة خطأ مفصلة
        let errorMsg = data.error || 'فشل الحذف';
        if (data.sampleIds && data.sampleIds.length > 0) {
          errorMsg += `\n(السجلات الموجودة: ${data.sampleIds.slice(0, 3).join(', ')}...)`;
        }
        toast({
          title: 'خطأ في الحذف',
          description: errorMsg,
          variant: 'destructive',
        });
        // طباعة التشخيص في console
        console.error('Delete failed:', data);
      }
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'تعذر الاتصال بالخادم',
        variant: 'destructive',
      });
    }
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({
      firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '',
      diploma: '', experience: '', schedule: 'full-time', note: '', status: 'pending',
    });
    setCvFile(null);
    setDiplomaFile(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (app: JobApplication) => {
    setEditing(app);
    setFormData({
      firstName: app.firstName,
      lastName: app.lastName,
      birthDate: app.birthDate ? app.birthDate.split('T')[0] : '',
      phone: app.phone || '',
      email: app.email || '',
      address: app.address || '',
      diploma: app.diploma || '',
      experience: app.experience || '',
      schedule: app.schedule,
      note: app.note || '',
      status: app.status,
    });
    setCvFile(null);
    setDiplomaFile(null);
    setDialogOpen(true);
  };

  const statusLabels: Record<string, string> = {
    'pending': 'قيد الانتظار',
    'reviewing': 'قيد المراجعة',
    'accepted': 'مقبول',
    'rejected': 'مرفوض',
  };
  const statusColors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-800',
    'reviewing': 'bg-blue-100 text-blue-800',
    'accepted': 'bg-emerald-100 text-emerald-800',
    'rejected': 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            طلبات العمل
          </h2>
          <p className="text-sm text-muted-foreground">{applications.length} طلب عمل</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="reviewing">قيد المراجعة</SelectItem>
              <SelectItem value="accepted">مقبول</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> طلب جديد</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، الهاتف، الإيميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد طلبات عمل بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: '900px' }}>
                <div
                  className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                  style={{ gridTemplateColumns: '1fr 120px 120px 100px 100px 100px' }}
                >
                  <div className="text-center">الاسم</div>
                  <div className="text-center">الهاتف</div>
                  <div className="text-center">الدبلوم</div>
                  <div className="text-center">الدوام</div>
                  <div className="text-center">الحالة</div>
                  <div className="text-center">إجراءات</div>
                </div>

                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/30 text-sm"
                    style={{ gridTemplateColumns: '1fr 120px 120px 100px 100px 100px' }}
                  >
                    <div className="text-right">
                      <div className="font-medium">{app.fullName || `${app.firstName || ''} ${app.lastName || ''}`.trim()}</div>
                      <div className="text-xs text-muted-foreground">{app.email || '-'}</div>
                      <div className="flex gap-1 mt-1">
                        {app.cvUrl && (
                          <button
                            onClick={() => setPreviewFile({ url: app.cvUrl!, name: 'السيرة الذاتية', type: getFileType(app.cvUrl!) })}
                            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70"
                            title="معاينة السيرة الذاتية"
                          >
                            {getFileIcon(app.cvUrl!)}
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                        {app.diplomaUrl && (
                          <button
                            onClick={() => setPreviewFile({ url: app.diplomaUrl!, name: 'الدبلوم', type: getFileType(app.diplomaUrl!) })}
                            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70"
                            title="معاينة الدبلوم"
                          >
                            {getFileIcon(app.diplomaUrl!)}
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-center num text-xs" dir="ltr">{app.phone || '-'}</div>
                    <div className="text-center text-xs">{app.diploma || '-'}</div>
                    <div className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {app.schedule === 'full-time' ? 'كلي' : 'جزئي'}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <Badge className={`text-xs ${statusColors[app.status] || ''}`}>
                        {statusLabels[app.status] || app.status}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(app)} className="h-7 w-7 p-0" title="تعديل">
                          <FileText className="w-3.5 h-3.5 text-amber-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(app)} className="h-7 w-7 p-0" title="حذف">
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل طلب عمل' : 'طلب عمل جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>اللقب *</Label>
              <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الميلاد</Label>
              <Input type="date" value={formData.birthDate} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الإيميل</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الدبلوم</Label>
              <Input value={formData.diploma} onChange={(e) => setFormData({ ...formData, diploma: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الدوام</Label>
              <Select value={formData.schedule} onValueChange={(v) => setFormData({ ...formData, schedule: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">كلي</SelectItem>
                  <SelectItem value="part-time">جزئي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="reviewing">قيد المراجعة</SelectItem>
                  <SelectItem value="accepted">مقبول</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>الخبرة</Label>
              <Textarea value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} rows={2} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>السيرة الذاتية (PDF, JPEG, PNG)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="file"
                  accept=".pdf,.jpeg,.jpg,.png"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="flex-1"
                  dir="ltr"
                />
                {uploadingCv && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing?.cvUrl && !cvFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFile({ url: editing.cvUrl!, name: 'السيرة الذاتية', type: getFileType(editing.cvUrl!) })}
                  >
                    {getFileIcon(editing.cvUrl)}
                    <Eye className="w-3.5 h-3.5 ml-1" /> معاينة
                  </Button>
                )}
              </div>
              {cvFile && <p className="text-xs text-emerald-600">✓ تم اختيار: {cvFile.name}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>الدبلوم (PDF, JPEG, PNG)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="file"
                  accept=".pdf,.jpeg,.jpg,.png"
                  onChange={(e) => setDiplomaFile(e.target.files?.[0] || null)}
                  className="flex-1"
                  dir="ltr"
                />
                {uploadingDiploma && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing?.diplomaUrl && !diplomaFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewFile({ url: editing.diplomaUrl!, name: 'الدبلوم', type: getFileType(editing.diplomaUrl!) })}
                  >
                    {getFileIcon(editing.diplomaUrl)}
                    <Eye className="w-3.5 h-3.5 ml-1" /> معاينة
                  </Button>
                )}
              </div>
              {diplomaFile && <p className="text-xs text-emerald-600">✓ تم اختيار: {diplomaFile.name}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={uploadingCv || uploadingDiploma}>
              {(uploadingCv || uploadingDiploma) ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</>
              ) : (
                <><Upload className="w-4 h-4 ml-2" /> حفظ</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {previewFile && (previewFile.type === 'pdf' ? <FileText className="w-5 h-5 text-red-600" /> : <ImageIcon className="w-5 h-5 text-blue-600" />)}
                معاينة {previewFile?.name}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewFile(null)} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-2">
            {previewFile && previewFile.type === 'pdf' && (
              <iframe
                src={normalizeFileUrl(previewFile.url)}
                className="w-full h-[80vh] border-0 rounded-lg"
                title={previewFile.name}
              />
            )}
            {previewFile && previewFile.type === 'image' && (
              <div className="flex items-center justify-center">
                <img
                  src={normalizeFileUrl(previewFile.url)}
                  alt={previewFile.name}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              </div>
            )}
            {previewFile && previewFile.type === 'other' && (
              <div className="text-center py-12">
                <File className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">لا يمكن معاينة هذا النوع من الملفات</p>
                <a href={normalizeFileUrl(previewFile.url) + '&download=true'} download>
                  <Button variant="outline">
                    <Download className="w-4 h-4 ml-2" /> تنزيل الملف
                  </Button>
                </a>
              </div>
            )}
          </div>
          <DialogFooter>
            <a href={previewFile ? normalizeFileUrl(previewFile.url) + '&download=true' : '#'} download>
              <Button variant="outline">
                <Download className="w-4 h-4 ml-2" /> تنزيل
              </Button>
            </a>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
