'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Edit, Trash2, Briefcase, FileText, Eye, X, Loader2, Upload,
  Phone, Mail, MapPin, Calendar, MessageCircle, Award, FileUser,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JobApplication {
  id: string;
  name: string;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  diploma: string | null;
  experience: string | null;
  address: string | null;
  note: string | null;
  cvUrl: string | null;
  diplomaUrl: string | null;
  status: string;
  appliedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'قيد المراجعة', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200' },
  reviewed: { label: 'تمت المراجعة', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  accepted: { label: 'مقبول', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-200' },
  rejected: { label: 'مرفوض', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
};

const empty = {
  name: '', birthDate: '', phone: '', email: '', whatsapp: '',
  diploma: '', experience: '', address: '', note: '',
  cvUrl: '', diplomaUrl: '', status: 'pending',
};

const formatDate = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export function JobApplicationsSection() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState<any>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingDiploma, setUploadingDiploma] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const diplomaInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/job-applications?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplications(data.applications || []);
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل تحميل الطلبات', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(empty);
    setDialogOpen(true);
  };

  const handleOpenEdit = (a: JobApplication) => {
    setEditing(a);
    setFormData({
      ...a,
      birthDate: a.birthDate ? a.birthDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const uploadFile = async (file: File, type: 'cv' | 'diploma') => {
    if (type === 'cv') setUploadingCv(true);
    else setUploadingDiploma(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // استخدم نفس /api/upload الخاص برفع صور الطلاب
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFormData((prev: any) => ({ ...prev, [type === 'cv' ? 'cvUrl' : 'diplomaUrl']: data.url }));
        toast({
          title: 'تم',
          description: type === 'cv' ? 'تم رفع السيرة الذاتية' : 'تم رفع ملف الدبلوم',
        });
      } else {
        toast({
          title: 'خطأ في رفع الملف',
          description: data.error || 'فشل الرفع',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر الاتصال بالخادم',
        variant: 'destructive',
      });
    } finally {
      if (type === 'cv') setUploadingCv(false);
      else setUploadingDiploma(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'الاسم واللقب مطلوبان', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/job-applications/${editing.id}` : '/api/job-applications';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: 'تم',
          description: editing ? 'تم تحديث الطلب' : 'تمت إضافة الطلب',
        });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: JobApplication) => {
    if (!confirm(`حذف طلب "${a.name}"؟`)) return;
    const res = await fetch(`/api/job-applications/${a.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (a: JobApplication, newStatus: string) => {
    try {
      const res = await fetch(`/api/job-applications/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, status: newStatus, birthDate: a.birthDate ? a.birthDate.split('T')[0] : '' }),
      });
      if (res.ok) {
        toast({ title: 'تم', description: 'تم تحديث الحالة' });
        load();
      }
    } catch {}
  };

  const pending = applications.filter(a => a.status === 'pending').length;
  const accepted = applications.filter(a => a.status === 'accepted').length;
  const rejected = applications.filter(a => a.status === 'rejected').length;

  return (
    <div className="space-y-4">
      {/* رأس أخضر جذاب */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/40 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">طلبات العمل</h2>
            <p className="text-sm text-emerald-100">
              <span className="num font-medium">{applications.length}</span> طلب •
              <span className="num font-medium text-amber-200 mx-1">{pending}</span> قيد المراجعة •
              <span className="num font-medium text-emerald-200 mx-1">{accepted}</span> مقبول
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenAdd}
          className="bg-amber-400 hover:bg-amber-500 text-emerald-900 font-bold"
        >
          <Plus className="w-4 h-4 ml-2" /> طلب جديد
        </Button>
      </div>

      {/* بطاقات KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">الإجمالي</span>
            <Briefcase className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-900">{applications.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-amber-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-amber-700">قيد المراجعة</span>
            <Loader2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold num text-amber-700">{pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-700">مقبول</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold num text-emerald-700">{accepted}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-md border border-red-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-red-700">مرفوض</span>
            <X className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-bold num text-red-700">{rejected}</p>
        </div>
      </div>

      {/* فلتر */}
      <div className="bg-white rounded-2xl shadow-md border border-emerald-100 p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <Input
              placeholder="بحث بالاسم، الهاتف، الايميل، الدبلوم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border-emerald-200 focus:border-emerald-500"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="reviewed">تمت المراجعة</SelectItem>
              <SelectItem value="accepted">مقبول</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* قائمة الطلبات */}
      <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-emerald-100">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-3 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold">قائمة طلبات العمل</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-emerald-900 text-xs font-bold num">
            {applications.length}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-10 text-emerald-600 text-sm">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
            جاري التحميل...
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <Briefcase className="w-8 h-8 text-emerald-300" />
            </div>
            <p className="font-bold text-emerald-900 text-base">لا توجد طلبات</p>
            <p className="text-xs text-muted-foreground mt-1">أضف طلباً جديداً للبدء</p>
          </div>
        ) : (
          <div className="divide-y divide-emerald-50">
            {applications.map(a => {
              const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
              return (
                <div key={a.id} className="p-4 hover:bg-emerald-50/30 transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h4 className="font-bold text-emerald-900 text-base">{a.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-emerald-700">
                        {a.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span className="num" dir="ltr">{a.phone}</span>
                          </div>
                        )}
                        {a.whatsapp && (
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3 text-emerald-500" />
                            <span className="num" dir="ltr">{a.whatsapp}</span>
                          </div>
                        )}
                        {a.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-emerald-500" />
                            <span className="truncate">{a.email}</span>
                          </div>
                        )}
                        {a.birthDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-500" />
                            <span>{formatDate(a.birthDate)}</span>
                          </div>
                        )}
                        {a.diploma && (
                          <div className="flex items-center gap-1">
                            <Award className="w-3 h-3 text-emerald-500" />
                            <span className="truncate">{a.diploma}</span>
                          </div>
                        )}
                        {a.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-500" />
                            <span className="truncate">{a.address}</span>
                          </div>
                        )}
                      </div>

                      {a.experience && (
                        <p className="text-xs text-emerald-700 mt-2 bg-emerald-50/50 rounded p-2">
                          <strong className="text-emerald-900">الخبرة:</strong> {a.experience}
                        </p>
                      )}
                      {a.note && (
                        <p className="text-xs text-emerald-600 mt-1 italic">📝 {a.note}</p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {a.cvUrl && (
                          <button
                            onClick={() => setPreviewFile({ url: a.cvUrl!, name: 'السيرة الذاتية' })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            <FileUser className="w-3 h-3" /> السيرة الذاتية
                          </button>
                        )}
                        {a.diplomaUrl && (
                          <button
                            onClick={() => setPreviewFile({ url: a.diplomaUrl!, name: 'الدبلوم' })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 hover:bg-amber-100 transition"
                          >
                            <FileText className="w-3 h-3" /> الدبلوم
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Select
                        value={a.status}
                        onValueChange={(v) => handleStatusChange(a, v)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs border-emerald-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">قيد المراجعة</SelectItem>
                          <SelectItem value="reviewed">تمت المراجعة</SelectItem>
                          <SelectItem value="accepted">مقبول</SelectItem>
                          <SelectItem value="rejected">مرفوض</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(a)}
                        className="h-8 w-8 p-0 hover:bg-amber-50"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(a)}
                        className="h-8 w-8 p-0 hover:bg-red-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-emerald-400 mt-2 num">
                    تاريخ الطلب: {formatDate(a.appliedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* نافذة إضافة/تعديل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-emerald-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-700" />
              {editing ? 'تعديل طلب العمل' : 'طلب عمل جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">الاسم واللقب *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: محمد أحمد بن قاسم"
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">تاريخ الميلاد</Label>
                <Input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">رقم الهاتف</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="06XX XX XX XX"
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@email.com"
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">رقم الوتس اب</Label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="06XX XX XX XX"
                  dir="ltr"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">الدبلوم</Label>
                <Input
                  value={formData.diploma}
                  onChange={(e) => setFormData({ ...formData, diploma: e.target.value })}
                  placeholder="مثال: ليسانس علوم قانونية"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">العنوان</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة، الحي، الشارع"
                  className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">الخبرة المهنية</Label>
              <Textarea
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                rows={3}
                placeholder="اذكر خبراتك المهنية السابقة..."
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">ملاحظة</Label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
                placeholder="أي معلومات إضافية..."
                className="border-emerald-200 focus:border-emerald-500 focus:ring-emerald-200"
              />
            </div>

            {/* رفع الملفات */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">رفع السيرة الذاتية (PDF)</Label>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, 'cv');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                >
                  {uploadingCv ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {formData.cvUrl ? 'تغيير الملف' : 'رفع ملف'}</>
                  )}
                </button>
                {formData.cvUrl && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <FileUser className="w-3 h-3" />
                    <a href={formData.cvUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      معاينة الملف المرفوع
                    </a>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-emerald-900 font-bold">رفع ملف الدبلوم (PDF/صورة)</Label>
                <input
                  ref={diplomaInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f, 'diploma');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => diplomaInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-amber-200 text-amber-700 hover:bg-amber-50 transition"
                >
                  {uploadingDiploma ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {formData.diplomaUrl ? 'تغيير الملف' : 'رفع ملف'}</>
                  )}
                </button>
                {formData.diplomaUrl && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <a href={formData.diplomaUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      معاينة الملف المرفوع
                    </a>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-emerald-900 font-bold">الحالة</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="border-emerald-200 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="reviewed">تمت المراجعة</SelectItem>
                  <SelectItem value="accepted">مقبول</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
              ) : (
                <>{editing ? 'حفظ' : 'إضافة'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة معاينة الملف */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-700 text-white p-3 flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-2">
                <Eye className="w-5 h-5" /> {previewFile.name}
              </h4>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-white hover:bg-emerald-800 rounded-full w-8 h-8 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {previewFile.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] mx-auto"
                />
              ) : (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[70vh] border-0"
                  title={previewFile.name}
                />
              )}
              <div className="text-center mt-3">
                <a
                  href={previewFile.url}
                  download
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-sm"
                >
                  <FileText className="w-4 h-4" /> تحميل الملف
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
