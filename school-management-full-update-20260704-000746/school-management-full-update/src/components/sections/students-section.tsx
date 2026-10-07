'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, Edit, Trash2, BarChart3, Download, Upload, Image as ImageIcon, X, Loader2, CalendarClock, Wallet, Banknote, QrCode, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StudentStatsModal } from '@/components/common/student-stats-modal';
import { InstallmentPlanModal } from '@/components/common/installment-plan-modal';

interface Student {
  id: string;
  studentNumber: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  photoUrl: string | null;
  departmentId: string | null;
  levelId: string | null;
  specializationId: string | null;
  section: string | null;
  specialty: string | null;
  college: string | null;
  courseStartDate: string | null;
  totalAmount: number | null;
  initialPayment: number | null;
  status: string;
  docPhotos: boolean;
  docBirthCert: boolean;
  docIdCard: boolean;
  docTsPhotos: boolean;
  docTsBirthCerts: boolean;
  docTsIdCards: boolean;
  docSchoolCert: boolean;
  docMedicalCert: boolean;
  notes: string | null;
  registrationDate: string;
  department?: { name: string; hasInstallments: boolean; installmentMonths: number | null; code: string | null };
  level?: { name: string };
  specialization?: { name: string };
}

interface Department {
  id: string; name: string; code: string | null;
  isFixed: boolean; hasInstallments: boolean; installmentMonths: number | null;
  defaultMonthlyAmount: number | null;
}
interface Level { id: string; name: string; }
interface Specialization { id: string; name: string; departmentId: string; }

// رموز الأقسام التي تتطلب مستندات ملف (02 صور، شهادة ميلاد، نسخة بطاقة التعريف)
const DEPTS_WITH_DOCUMENTS = ['LANG', 'WOM', 'QUAL'];
// رمز قسم التقني سامي (له مستندات أكثر تفصيلاً)
const TS_DEPT_CODE = 'TS';

const STUDENT_STATUSES = [
  { value: 'registered', label: 'مسجل' },
  { value: 'continuing', label: 'مستمر' },
  { value: 'abandoned', label: 'متخلي' },
  { value: 'postponed', label: 'مؤجل' },
  { value: 'graduated', label: 'متخرج' },
];

const getStatusLabel = (s: string) => STUDENT_STATUSES.find(st => st.value === s)?.label || s;

const empty = {
  name: '', email: '', phone: '', gender: 'ذكر',
  departmentId: '', levelId: '', specializationId: '',
  section: '', specialty: '', college: '', notes: '',
  status: 'registered', photoUrl: '',
  birthDate: '', address: '', courseStartDate: '',
  totalAmount: '', initialPayment: '',
  docPhotos: false, docBirthCert: false, docIdCard: false,
  docTsPhotos: false, docTsBirthCerts: false, docTsIdCards: false,
  docSchoolCert: false, docMedicalCert: false,
};

export function StudentsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterSpec, setFilterSpec] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [formData, setFormData] = useState<any>(empty);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statsModal, setStatsModal] = useState<{ open: boolean; studentId: string | null }>({ open: false, studentId: null });
  const [installmentModal, setInstallmentModal] = useState<{ open: boolean; studentId: string | null }>({ open: false, studentId: null });
  const [qrModal, setQrModal] = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });

  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterDept !== 'all') params.set('departmentId', filterDept);
    if (filterSpec !== 'all') params.set('specializationId', filterSpec);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    const res = await fetch(`/api/students?${params.toString()}`);
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  };

  const loadFilters = async () => {
    const [d, l, s] = await Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/levels').then(r => r.json()),
      fetch('/api/specializations').then(r => r.json()),
    ]);
    setDepartments(d.departments || []);
    setLevels(l.levels || []);
    setSpecializations(s.specializations || []);
  };

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { load(); }, [search, filterDept, filterSpec, filterStatus]);

  // Specializations filtered by selected department
  const availableSpecializations = formData.departmentId
    ? specializations.filter(s => s.departmentId === formData.departmentId)
    : [];

  // Get the selected department to check if it has installments (التقني سامي)
  const selectedDept = departments.find(d => d.id === formData.departmentId);
  const hasInstallments = selectedDept?.hasInstallments || false;
  // التحقق هل القسم المختار يتطلب مستندات ملف (الدورات التأهيلية، الدورات النسوية، اللغات)
  const requiresDocuments = !!(selectedDept?.code && DEPTS_WITH_DOCUMENTS.includes(selectedDept.code));
  // التحقق هل القسم المختار هو التقني سامي (له مستندات خاصة)
  const isTsDepartment = selectedDept?.code === TS_DEPT_CODE;
  // التحقق هل ملف التقني سامي مكتمل (كل المستندات الخمسة مؤشّرة)
  const tsFileComplete = !!(
    formData.docTsPhotos && formData.docTsBirthCerts && formData.docTsIdCards &&
    formData.docSchoolCert && formData.docMedicalCert
  );

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'خطأ', description: 'نوع الملف غير مدعوم', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الملف كبير جداً (حد أقصى 5 ميجا)', variant: 'destructive' });
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
        return;
      }
      setFormData((prev: any) => ({ ...prev, photoUrl: data.url }));
      setPhotoPreview(data.url);
      toast({ title: 'تم', description: 'تم رفع الصورة' });
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر رفع الصورة', variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev: any) => ({ ...prev, photoUrl: '' }));
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(empty);
    setPhotoPreview(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: Student) => {
    setEditing(s);
    setFormData({
      name: s.name, email: s.email || '', phone: s.phone || '', gender: s.gender || 'ذكر',
      departmentId: s.departmentId || '', levelId: s.levelId || '',
      specializationId: s.specializationId || '',
      section: s.section || '', specialty: s.specialty || '', college: s.college || '',
      notes: s.notes || '', status: s.status, photoUrl: s.photoUrl || '',
      birthDate: '', address: '',
      courseStartDate: s.courseStartDate ? s.courseStartDate.split('T')[0] : '',
      totalAmount: s.totalAmount ? String(s.totalAmount) : '',
      initialPayment: s.initialPayment ? String(s.initialPayment) : '',
      docPhotos: s.docPhotos || false,
      docBirthCert: s.docBirthCert || false,
      docIdCard: s.docIdCard || false,
      docTsPhotos: s.docTsPhotos || false,
      docTsBirthCerts: s.docTsBirthCerts || false,
      docTsIdCards: s.docTsIdCards || false,
      docSchoolCert: s.docSchoolCert || false,
      docMedicalCert: s.docMedicalCert || false,
    });
    setPhotoPreview(s.photoUrl || null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'تنبيه', description: 'اسم الطالب مطلوب', variant: 'destructive' });
      return;
    }
    // تنبيه إذا كان الملف ناقصاً لطالب التقني سامي
    if (isTsDepartment && !tsFileComplete) {
      const missingDocs: string[] = [];
      if (!formData.docTsPhotos) missingDocs.push('04 صور');
      if (!formData.docTsBirthCerts) missingDocs.push('03 شهادات ميلاد');
      if (!formData.docTsIdCards) missingDocs.push('03 نسخ من بطاقة التعريف');
      if (!formData.docSchoolCert) missingDocs.push('شهادة مدرسية أصلية');
      if (!formData.docMedicalCert) missingDocs.push('شهادة طبية');
      const confirmSave = confirm(
        `⚠️ الملف ناقص!\n\nالمستندات الناقصة:\n${missingDocs.map(d => `• ${d}`).join('\n')}\n\nهل تريد متابعة الحفظ رغم ذلك؟`
      );
      if (!confirmSave) return;
    }
    try {
      const url = editing ? `/api/students/${editing.id}` : '/api/students';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
        return;
      }
      toast({ title: 'تم', description: editing ? 'تم تحديث الطالب' : 'تمت إضافة الطالب' });
      setDialogOpen(false);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالخادم', variant: 'destructive' });
    }
  };

  const handleDelete = async (s: Student) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${s.name}"؟`)) return;
    const res = await fetch(`/api/students/${s.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم حذف الطالب' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'تعذر الحذف', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">إدارة الطلاب</h2>
          <p className="text-muted-foreground text-sm">إجمالي: {students.length} طالب</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/students', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير Excel
          </Button>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 ml-2" /> إضافة طالب
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الرقم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterSpec('all'); }}>
              <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSpec} onValueChange={setFilterSpec}>
              <SelectTrigger><SelectValue placeholder="كل التخصصات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التخصصات</SelectItem>
                {filterDept !== 'all' && specializations.filter(s => s.departmentId === filterDept).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {STUDENT_STATUSES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="text-center w-16">الصورة</TableHead>
                  <TableHead>رقم الطالب</TableHead>
                  <TableHead>الاسم واللقب</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>التخصص</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : students.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد طلاب</TableCell></TableRow>
                ) : students.map((s, i) => (
                  <TableRow key={s.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-center">
                      {s.photoUrl ? (
                        <div className="flex justify-center">
                          <img src={s.photoUrl} alt={s.name} className="w-10 h-10 rounded-full object-cover border border-primary/30" />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs num">{s.studentNumber || '-'}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      {s.department?.name || '-'}
                      {s.department?.hasInstallments && (
                        <Badge variant="secondary" className="mr-1 text-[10px]">30 شهر</Badge>
                      )}
                      {/* مؤشّر حالة المستندات للأقسام التي تتطلبها */}
                      {s.department?.code && DEPTS_WITH_DOCUMENTS.includes(s.department.code) && (
                        <div className="flex gap-1 mt-1">
                          <span
                            title="02 صور"
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${
                              s.docPhotos ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                            }`}
                          >ص</span>
                          <span
                            title="شهادة ميلاد"
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${
                              s.docBirthCert ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                            }`}
                          >م</span>
                          <span
                            title="نسخة بطاقة التعريف"
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${
                              s.docIdCard ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                            }`}
                          >ب</span>
                        </div>
                      )}
                      {/* مؤشّر حالة ملف التقني سامي (مكتمل/ناقص) */}
                      {s.department?.code === TS_DEPT_CODE && (
                        (() => {
                          const tsComplete = !!(s.docTsPhotos && s.docTsBirthCerts && s.docTsIdCards && s.docSchoolCert && s.docMedicalCert);
                          return (
                            <div className="mt-1">
                              {tsComplete ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> ملف مكتمل
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                                  <AlertCircle className="w-3 h-3" /> ملف ناقص
                                </span>
                              )}
                            </div>
                          );
                        })()
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{s.specialization?.name || s.specialty || '-'}</TableCell>
                    <TableCell className="num text-xs">{s.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        s.status === 'registered' ? 'default' :
                        s.status === 'continuing' ? 'secondary' :
                        s.status === 'graduated' ? 'outline' :
                        s.status === 'abandoned' ? 'destructive' :
                        'secondary'
                      }>
                        {getStatusLabel(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setQrModal({ open: true, student: s })} title="بطاقة QR">
                          <QrCode className="w-4 h-4 text-purple-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatsModal({ open: true, studentId: s.id })} title="إحصائيات">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                        </Button>
                        {s.department?.hasInstallments && (
                          <Button size="sm" variant="ghost" onClick={() => setInstallmentModal({ open: true, studentId: s.id })} title="جدول الأقساط">
                            <CalendarClock className="w-4 h-4 text-orange-600" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(s)} title="تعديل">
                          <Edit className="w-4 h-4 text-amber-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(s)} title="حذف">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => {
        setDialogOpen(v);
        if (!v) {
          setPhotoPreview(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Photo upload */}
            <div className="md:col-span-2">
              <Label>صورة الطالب</Label>
              <div className="flex items-start gap-4 p-3 border-2 border-dashed border-border rounded-lg bg-muted/30">
                <div className="flex-shrink-0">
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="معاينة" className="w-20 h-20 rounded-lg object-cover border-2 border-primary/30" />
                      <button type="button" onClick={handleRemovePhoto} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={photoUploading}>
                    {photoUploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</> : <><Upload className="w-4 h-4 ml-2" /> {photoPreview ? 'تغيير الصورة' : 'رفع صورة'}</>}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF - حد أقصى 5 ميجا</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>الاسم واللقب *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: أحمد بن محمد" />
            </div>
            <div className="space-y-2">
              <Label>الجنس</Label>
              <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الهاتف</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0770..." dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v, specializationId: '' })}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}{d.hasInstallments && ' (أقساط شهرية)'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التخصص (الشعبة)</Label>
              <Select value={formData.specializationId} onValueChange={(v) => setFormData({ ...formData, specializationId: v })} disabled={!formData.departmentId}>
                <SelectTrigger><SelectValue placeholder={formData.departmentId ? 'اختر التخصص' : 'اختر القسم أولاً'} /></SelectTrigger>
                <SelectContent>
                  {availableSpecializations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={formData.levelId} onValueChange={(v) => setFormData({ ...formData, levelId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUSES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* خانات تأشير مستندات الملف - تظهر فقط للأقسام: اللغات، الدورات النسوية، الدورات التأهيلية */}
            {requiresDocuments && (
              <div className="md:col-span-2 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-800 mb-2">مستندات الملف المطلوبة</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.docPhotos === true}
                      onChange={(e) => setFormData({ ...formData, docPhotos: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm">02 صور</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.docBirthCert === true}
                      onChange={(e) => setFormData({ ...formData, docBirthCert: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm">شهادة ميلاد</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.docIdCard === true}
                      onChange={(e) => setFormData({ ...formData, docIdCard: e.target.checked })}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm">نسخة من بطاقة التعريف</span>
                  </label>
                </div>
              </div>
            )}

            {/* خانات تأشير مستندات ملف التقني سامي - تظهر فقط لقسم التقني سامي */}
            {isTsDepartment && (
              <div className="md:col-span-2 p-3 bg-orange-50/50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-orange-800">مستندات ملف التقني سامي المطلوبة</p>
                  {tsFileComplete ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> الملف مكتمل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> الملف ناقص
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <label className={`flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors ${!formData.docTsPhotos ? 'border-red-300' : 'border-emerald-300'}`}>
                    <input
                      type="checkbox"
                      checked={formData.docTsPhotos === true}
                      onChange={(e) => setFormData({ ...formData, docTsPhotos: e.target.checked })}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="text-sm">04 صور</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors ${!formData.docTsBirthCerts ? 'border-red-300' : 'border-emerald-300'}`}>
                    <input
                      type="checkbox"
                      checked={formData.docTsBirthCerts === true}
                      onChange={(e) => setFormData({ ...formData, docTsBirthCerts: e.target.checked })}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="text-sm">03 شهادات ميلاد</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors ${!formData.docTsIdCards ? 'border-red-300' : 'border-emerald-300'}`}>
                    <input
                      type="checkbox"
                      checked={formData.docTsIdCards === true}
                      onChange={(e) => setFormData({ ...formData, docTsIdCards: e.target.checked })}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="text-sm">03 نسخ من بطاقة التعريف</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors ${!formData.docSchoolCert ? 'border-red-300' : 'border-emerald-300'}`}>
                    <input
                      type="checkbox"
                      checked={formData.docSchoolCert === true}
                      onChange={(e) => setFormData({ ...formData, docSchoolCert: e.target.checked })}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="text-sm">شهادة مدرسية أصلية</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 bg-background rounded border cursor-pointer hover:bg-muted/30 transition-colors ${!formData.docMedicalCert ? 'border-red-300' : 'border-emerald-300'}`}>
                    <input
                      type="checkbox"
                      checked={formData.docMedicalCert === true}
                      onChange={(e) => setFormData({ ...formData, docMedicalCert: e.target.checked })}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="text-sm">شهادة طبية</span>
                  </label>
                </div>
                {/* تنبيه بعدم اكتمال الملف */}
                {!tsFileComplete && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700">
                      <p className="font-medium">تنبيه: الملف ناقص!</p>
                      <p>المستندات الناقصة:</p>
                      <ul className="list-disc pr-4 mt-0.5">
                        {!formData.docTsPhotos && <li>04 صور</li>}
                        {!formData.docTsBirthCerts && <li>03 شهادات ميلاد</li>}
                        {!formData.docTsIdCards && <li>03 نسخ من بطاقة التعريف</li>}
                        {!formData.docSchoolCert && <li>شهادة مدرسية أصلية</li>}
                        {!formData.docMedicalCert && <li>شهادة طبية</li>}
                      </ul>
                      <p className="mt-1 font-medium">سيظهر تنبيه آخر عند محاولة الحفظ.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Course start date + total amount + initial payment - shown for installment departments (التقني سامي) */}
            {hasInstallments && (
              <>
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-1">
                    <CalendarClock className="w-4 h-4 text-orange-600" />
                    تاريخ بداية الدورة (لحساب الأقساط الـ {selectedDept?.installmentMonths || 30} شهر)
                  </Label>
                  <Input
                    type="date"
                    value={formData.courseStartDate}
                    onChange={(e) => setFormData({ ...formData, courseStartDate: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Wallet className="w-4 h-4 text-primary" />
                    المبلغ الإجمالي للدورة (دج) *
                  </Label>
                  <Input
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    placeholder="مثال: 90000"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    الدفعة الأولية (دج)
                  </Label>
                  <Input
                    type="number"
                    value={formData.initialPayment}
                    onChange={(e) => setFormData({ ...formData, initialPayment: e.target.value })}
                    placeholder="مثال: 10000"
                    dir="ltr"
                  />
                </div>
                <div className="md:col-span-2 p-3 bg-orange-50/50 border border-orange-200 rounded-lg">
                  <p className="text-xs text-orange-800">
                    <strong>طريقة حساب الأقساط:</strong>
                    {formData.totalAmount && formData.initialPayment ? (
                      <>
                        {' '}المبلغ الإجمالي ({Number(formData.totalAmount).toLocaleString()} دج) - الدفعة الأولية ({Number(formData.initialPayment).toLocaleString()} دج) = {Number(formData.totalAmount - formData.initialPayment).toLocaleString()} دج
                        {' ÷ '}{selectedDept?.installmentMonths || 30} شهر = <strong>{Math.round((Number(formData.totalAmount) - Number(formData.initialPayment)) / (selectedDept?.installmentMonths || 30)).toLocaleString()} دج/شهر</strong>
                      </>
                    ) : formData.totalAmount ? (
                      <>
                        {' '}المبلغ الإجمالي ({Number(formData.totalAmount).toLocaleString()} دج) ÷ {selectedDept?.installmentMonths || 30} شهر = <strong>{Math.round(Number(formData.totalAmount) / (selectedDept?.installmentMonths || 30)).toLocaleString()} دج/شهر</strong>
                      </>
                    ) : (
                      ' سيتم استخدام القسط الشهري الافتراضي للقسم: ' + (selectedDept?.defaultMonthlyAmount || 0) + ' دج'
                    )}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الكلية/الجامعة</Label>
              <Input value={formData.college} onChange={(e) => setFormData({ ...formData, college: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editing ? 'حفظ التعديلات' : 'إضافة'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StudentStatsModal open={statsModal.open} studentId={statsModal.studentId} onClose={() => setStatsModal({ open: false, studentId: null })} />
      <InstallmentPlanModal open={installmentModal.open} studentId={installmentModal.studentId} onClose={() => setInstallmentModal({ open: false, studentId: null })} />

      {/* QR Code Modal */}
      <Dialog open={qrModal.open} onOpenChange={(v) => !v && setQrModal({ open: false, student: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">بطاقة الطالب - QR Code</DialogTitle>
          </DialogHeader>
          {qrModal.student && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center">
                <p className="font-bold text-lg">{qrModal.student.name}</p>
                <p className="text-sm text-muted-foreground num">{qrModal.student.studentNumber || '-'}</p>
                <p className="text-xs text-muted-foreground">{qrModal.student.department?.name || '-'}</p>
              </div>
              <div className="p-3 bg-white border-2 border-muted rounded-lg">
                <img
                  src={`/api/qr?data=${encodeURIComponent(JSON.stringify({ id: qrModal.student.id, name: qrModal.student.name, num: qrModal.student.studentNumber }))}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">امسح الكود للوصول السريع لملف الطالب</p>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="w-4 h-4 ml-1" /> طباعة البطاقة
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
