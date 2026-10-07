'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Search, Trash2, Download, FileText, Image as ImageIcon, File, Eye, X, Loader2, Upload, Award,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Certificate {
  id: string;
  studentId: string | null;
  studentName: string;
  specialization: string;
  certificateNumber: string | null;
  deliveryDate: string | null;
  tsAccreditationNumber: string | null;
  tsTranscriptNumber: string | null;
  tsDiplomaNumber: string | null;
  diplomaUrl: string | null;
  tsAccreditationUrl: string | null;
  tsTranscriptUrl: string | null;
  tsDiplomaUrl: string | null;
  notes: string | null;
  createdAt: string;
}

interface StudentSearchResult {
  id: string;
  name: string;
  studentNumber: string | null;
  phone: string | null;
  department: { name: string; code: string | null } | null;
  specialization: { name: string } | null;
  status: string;
}

const formatDate = (iso: string | Date | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const SPEC_LABELS: Record<string, string> = {
  medical: 'التخصصات الطبية',
  qualification: 'التخصصات التأهيلية',
  ts: 'التقني سامي',
};

const SPEC_COLORS: Record<string, string> = {
  medical: 'bg-red-100 text-red-800',
  qualification: 'bg-blue-100 text-blue-800',
  ts: 'bg-purple-100 text-purple-800',
};

// تحويل URL إلى API endpoint
const normalizeFileUrl = (url: string): string => {
  if (!url) return url;
  if (url.startsWith('/uploads/certificates/') || url.startsWith('uploads/certificates/')) {
    const filename = url.split('/').pop();
    return `/api/certificates/file?path=uploads/certificates/${filename}`;
  }
  if (url.startsWith('/download/cert-files/') || url.startsWith('download/cert-files/')) {
    const filename = url.split('/').pop();
    return `/api/certificates/file?path=download/cert-files/${filename}`;
  }
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

export function CertificatesSection() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Certificate | null>(null);
  const [formData, setFormData] = useState<any>({
    studentId: '', studentName: '', specialization: '',
    certificateNumber: '', deliveryDate: '',
    tsAccreditationNumber: '', tsTranscriptNumber: '', tsDiplomaNumber: '',
    notes: '',
  });
  // بحث الطلاب
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentSearchRef = useRef<NodeJS.Timeout | null>(null);
  // رفع الملفات
  const [files, setFiles] = useState<{
    diploma?: File | null;
    tsAccreditation?: File | null;
    tsTranscript?: File | null;
    tsDiploma?: File | null;
  }>({});
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterSpec !== 'all') params.set('specialization', filterSpec);
      const res = await fetch(`/api/certificates?${params.toString()}`);
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, filterSpec]);

  // البحث في الطلاب (debounce)
  useEffect(() => {
    if (!studentSearch || studentSearch.length < 1) {
      setStudentResults([]);
      return;
    }
    if (studentSearchRef.current) clearTimeout(studentSearchRef.current);
    setSearchingStudents(true);
    studentSearchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(studentSearch)}`);
        const data = await res.json();
        setStudentResults(data.students || []);
        setShowStudentDropdown(true);
      } catch (err) {
        console.error('Student search error:', err);
      } finally {
        setSearchingStudents(false);
      }
    }, 300);
    return () => {
      if (studentSearchRef.current) clearTimeout(studentSearchRef.current);
    };
  }, [studentSearch]);

  const handleSelectStudent = (student: StudentSearchResult) => {
    setFormData({
      ...formData,
      studentId: student.id,
      studentName: student.name,
    });
    setStudentSearch(student.name);
    setShowStudentDropdown(false);
  };

  const handleFileUpload = async (file: File, type: string): Promise<string | null> => {
    setUploadingFile(type);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/certificates/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل رفع الملف', variant: 'destructive' });
        return null;
      }
      return data.fileUrl;
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setUploadingFile(null);
    }
  };

  const handleSave = async () => {
    if (!formData.studentName) {
      toast({ title: 'تنبيه', description: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    if (!formData.specialization) {
      toast({ title: 'تنبيه', description: 'التخصص مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);

    let diplomaUrl = editing?.diplomaUrl || null;
    let tsAccreditationUrl = editing?.tsAccreditationUrl || null;
    let tsTranscriptUrl = editing?.tsTranscriptUrl || null;
    let tsDiplomaUrl = editing?.tsDiplomaUrl || null;

    // رفع الملفات الجديدة
    if (files.diploma) {
      const url = await handleFileUpload(files.diploma, 'diploma');
      if (url) diplomaUrl = url;
    }
    if (files.tsAccreditation) {
      const url = await handleFileUpload(files.tsAccreditation, 'tsAccreditation');
      if (url) tsAccreditationUrl = url;
    }
    if (files.tsTranscript) {
      const url = await handleFileUpload(files.tsTranscript, 'tsTranscript');
      if (url) tsTranscriptUrl = url;
    }
    if (files.tsDiploma) {
      const url = await handleFileUpload(files.tsDiploma, 'tsDiploma');
      if (url) tsDiplomaUrl = url;
    }

    const payload = {
      ...formData,
      diplomaUrl,
      tsAccreditationUrl,
      tsTranscriptUrl,
      tsDiplomaUrl,
    };

    try {
      const url = editing ? `/api/certificates/${editing.id}` : '/api/certificates';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
        return;
      }
      toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
      setDialogOpen(false);
      setFiles({});
      load();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cert: Certificate) => {
    if (!cert.id) {
      toast({ title: 'خطأ', description: 'معرف السجل غير موجود', variant: 'destructive' });
      load();
      return;
    }
    if (!confirm(`حذف شهادة ${cert.studentName}؟`)) return;
    try {
      const res = await fetch(`/api/certificates/${cert.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: 'تم', description: data.message || 'تم الحذف' });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحذف', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({
      studentId: '', studentName: '', specialization: '',
      certificateNumber: '', deliveryDate: '',
      tsAccreditationNumber: '', tsTranscriptNumber: '', tsDiplomaNumber: '',
      notes: '',
    });
    setStudentSearch('');
    setFiles({});
    setDialogOpen(true);
  };

  const handleOpenEdit = (cert: Certificate) => {
    setEditing(cert);
    setFormData({
      studentId: cert.studentId || '',
      studentName: cert.studentName || '',
      specialization: cert.specialization || '',
      certificateNumber: cert.certificateNumber || '',
      deliveryDate: cert.deliveryDate ? cert.deliveryDate.split('T')[0] : '',
      tsAccreditationNumber: cert.tsAccreditationNumber || '',
      tsTranscriptNumber: cert.tsTranscriptNumber || '',
      tsDiplomaNumber: cert.tsDiplomaNumber || '',
      notes: cert.notes || '',
    });
    setStudentSearch(cert.studentName || '');
    setFiles({});
    setDialogOpen(true);
  };

  const isTS = formData.specialization === 'ts';

  // مكون حقل رفع ملف
  const FileUploadField = ({
    label, fileKey, currentUrl, required,
  }: { label: string; fileKey: string; currentUrl: string | null; required?: boolean }) => (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="file"
          accept=".pdf,.jpeg,.jpg,.png"
          onChange={(e) => setFiles({ ...files, [fileKey]: e.target.files?.[0] || null })}
          className="flex-1"
          dir="ltr"
        />
        {uploadingFile === fileKey && <Loader2 className="w-4 h-4 animate-spin" />}
        {currentUrl && !files[fileKey as keyof typeof files] && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewFile({ url: currentUrl!, name: label, type: getFileType(currentUrl!) })}
          >
            {getFileIcon(currentUrl!)}
            <Eye className="w-3.5 h-3.5 ml-1" /> معاينة
          </Button>
        )}
      </div>
      {files[fileKey as keyof typeof files] && (
        <p className="text-xs text-emerald-600">✓ تم اختيار: {(files[fileKey as keyof typeof files] as File)?.name}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            سجل الشهادات
          </h2>
          <p className="text-sm text-muted-foreground">{certificates.length} شهادة</p>
        </div>
        <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> شهادة جديدة</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، رقم الشهادة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={filterSpec} onValueChange={setFilterSpec}>
              <SelectTrigger><SelectValue placeholder="كل التخصصات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التخصصات</SelectItem>
                <SelectItem value="medical">التخصصات الطبية</SelectItem>
                <SelectItem value="qualification">التخصصات التأهيلية</SelectItem>
                <SelectItem value="ts">التقني سامي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>لا توجد شهادات بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: '1000px' }}>
                {/* Header */}
                <div
                  className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm sticky top-0"
                  style={{ gridTemplateColumns: '1fr 120px 130px 120px 100px 100px' }}
                >
                  <div className="text-center">الاسم</div>
                  <div className="text-center">التخصص</div>
                  <div className="text-center">رقم الشهادة</div>
                  <div className="text-center">تاريخ التسليم</div>
                  <div className="text-center">الملفات</div>
                  <div className="text-center">إجراءات</div>
                </div>

                {/* Body */}
                {certificates.map((cert) => {
                  const fileCount = [
                    cert.diplomaUrl, cert.tsAccreditationUrl, cert.tsTranscriptUrl, cert.tsDiplomaUrl
                  ].filter(Boolean).length;

                  return (
                    <div
                      key={cert.id}
                      className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/30 text-sm"
                      style={{ gridTemplateColumns: '1fr 120px 130px 120px 100px 100px' }}
                    >
                      <div className="text-right">
                        <div className="font-medium">{cert.studentName}</div>
                        {cert.tsAccreditationNumber && (
                          <div className="text-xs text-muted-foreground">
                            تثبيت: {cert.tsAccreditationNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <Badge className={`text-xs ${SPEC_COLORS[cert.specialization] || ''}`}>
                          {SPEC_LABELS[cert.specialization] || cert.specialization}
                        </Badge>
                      </div>
                      <div className="text-center num text-xs" dir="ltr">{cert.certificateNumber || '-'}</div>
                      <div className="text-center num text-xs">{formatDate(cert.deliveryDate)}</div>
                      <div className="text-center">
                        {fileCount > 0 ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {cert.diplomaUrl && (
                              <button
                                onClick={() => setPreviewFile({ url: cert.diplomaUrl!, name: 'الدبلوم', type: getFileType(cert.diplomaUrl!) })}
                                className="p-1 rounded bg-muted hover:bg-muted/70"
                                title="الدبلوم"
                              >
                                {getFileIcon(cert.diplomaUrl!)}
                              </button>
                            )}
                            {cert.tsAccreditationUrl && (
                              <button
                                onClick={() => setPreviewFile({ url: cert.tsAccreditationUrl!, name: 'شهادة التثبيت', type: getFileType(cert.tsAccreditationUrl!) })}
                                className="p-1 rounded bg-muted hover:bg-muted/70"
                                title="شهادة التثبيت"
                              >
                                {getFileIcon(cert.tsAccreditationUrl!)}
                              </button>
                            )}
                            {cert.tsTranscriptUrl && (
                              <button
                                onClick={() => setPreviewFile({ url: cert.tsTranscriptUrl!, name: 'كشف النقاط', type: getFileType(cert.tsTranscriptUrl!) })}
                                className="p-1 rounded bg-muted hover:bg-muted/70"
                                title="كشف النقاط"
                              >
                                {getFileIcon(cert.tsTranscriptUrl!)}
                              </button>
                            )}
                            {cert.tsDiplomaUrl && (
                              <button
                                onClick={() => setPreviewFile({ url: cert.tsDiplomaUrl!, name: 'الدبلوم', type: getFileType(cert.tsDiplomaUrl!) })}
                                className="p-1 rounded bg-muted hover:bg-muted/70"
                                title="الدبلوم"
                              >
                                {getFileIcon(cert.tsDiplomaUrl!)}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(cert)} className="h-7 w-7 p-0" title="تعديل">
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(cert)} className="h-7 w-7 p-0" title="حذف">
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل شهادة' : 'شهادة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {/* البحث في الطلاب (autocomplete) */}
            <div className="space-y-2 md:col-span-2">
              <Label>الاسم واللقب * (ابحث في الطلاب المسجلين)</Label>
              <div className="relative">
                <Input
                  placeholder="اكتب اسم الطالب للبحث..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setFormData({ ...formData, studentName: e.target.value, studentId: '' });
                  }}
                  onFocus={() => studentResults.length > 0 && setShowStudentDropdown(true)}
                  onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                />
                {searchingStudents && (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                )}
                {showStudentDropdown && studentResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {studentResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="w-full text-right p-2 hover:bg-muted border-b last:border-0 text-sm"
                      >
                        <div className="font-medium">{student.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          {student.studentNumber && <span>#{student.studentNumber}</span>}
                          {student.department && <span>{student.department.name}</span>}
                          {student.specialization && <span>• {student.specialization.name}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {formData.studentId && (
                <p className="text-xs text-emerald-600">✓ مرتبط بالطالب: {formData.studentName}</p>
              )}
            </div>

            {/* التخصص */}
            <div className="space-y-2">
              <Label>التخصص *</Label>
              <Select
                value={formData.specialization}
                onValueChange={(v) => setFormData({ ...formData, specialization: v })}
              >
                <SelectTrigger><SelectValue placeholder="اختر التخصص" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medical">التخصصات الطبية</SelectItem>
                  <SelectItem value="qualification">التخصصات التأهيلية</SelectItem>
                  <SelectItem value="ts">التقني سامي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* رقم الشهادة */}
            <div className="space-y-2">
              <Label>رقم الشهادة</Label>
              <Input
                value={formData.certificateNumber}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                dir="ltr"
              />
            </div>

            {/* تاريخ التسليم */}
            <div className="space-y-2">
              <Label>تاريخ التسليم</Label>
              <Input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                dir="ltr"
              />
            </div>

            {/* ===== حقول إضافية للتقني سامي فقط ===== */}
            {isTS && (
              <>
                <div className="md:col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-medium text-purple-900 mb-3">
                    🎓 حقول التقني سامي
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>رقم شهادة التثبيت</Label>
                      <Input
                        value={formData.tsAccreditationNumber}
                        onChange={(e) => setFormData({ ...formData, tsAccreditationNumber: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم كشف النقاط</Label>
                      <Input
                        value={formData.tsTranscriptNumber}
                        onChange={(e) => setFormData({ ...formData, tsTranscriptNumber: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الدبلوم</Label>
                      <Input
                        value={formData.tsDiplomaNumber}
                        onChange={(e) => setFormData({ ...formData, tsDiplomaNumber: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ===== رفع الملفات ===== */}
            <div className="md:col-span-2 space-y-3">
              <Label className="text-base font-medium">📄 الملفات المرفقة</Label>

              {/* للطبية والتأهيلية: رفع الدبلوم فقط */}
              {!isTS && (
                <FileUploadField
                  label="نسخة الدبلوم (PDF, JPEG, PNG)"
                  fileKey="diploma"
                  currentUrl={editing?.diplomaUrl || null}
                  required
                />
              )}

              {/* للتقني سامي: رفع 3 ملفات */}
              {isTS && (
                <div className="space-y-3">
                  <FileUploadField
                    label="شهادة التثبيت (PDF, JPEG, PNG)"
                    fileKey="tsAccreditation"
                    currentUrl={editing?.tsAccreditationUrl || null}
                    required
                  />
                  <FileUploadField
                    label="كشف النقاط (PDF, JPEG, PNG)"
                    fileKey="tsTranscript"
                    currentUrl={editing?.tsTranscriptUrl || null}
                    required
                  />
                  <FileUploadField
                    label="الدبلوم (PDF, JPEG, PNG)"
                    fileKey="tsDiploma"
                    currentUrl={editing?.tsDiplomaUrl || null}
                    required
                  />
                </div>
              )}
            </div>

            {/* ملاحظات */}
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || uploadingFile !== null}>
              {(saving || uploadingFile !== null) ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</>
              ) : (
                <><Upload className="w-4 h-4 ml-2" /> حفظ</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
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
