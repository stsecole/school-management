'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive, Upload, Download, Trash2, Eye, FileText, Image as ImageIcon, Search,
  Loader2, X, Plus, Filter, Printer, FileArchive,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentItem {
  id: string;
  title: string;
  type: string;
  studentId: string | null;
  studentName: string | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  tags: string | null;
  uploadedBy: string | null;
  createdAt: string;
  student: { name: string; studentNumber: string | null } | null;
}

interface Student { id: string; name: string; }

const typeConfig: Record<string, { label: string; color: string; icon: any }> = {
  birth_cert: { label: 'شهادة ميلاد', color: 'bg-blue-100 text-blue-700', icon: FileText },
  id_card: { label: 'بطاقة تعريف', color: 'bg-purple-100 text-purple-700', icon: FileText },
  school_cert: { label: 'شهادة مدرسية', color: 'bg-emerald-100 text-emerald-700', icon: FileText },
  photo: { label: 'صورة', color: 'bg-amber-100 text-amber-700', icon: ImageIcon },
  medical: { label: 'شهادة طبية', color: 'bg-red-100 text-red-700', icon: FileText },
  contract: { label: 'عقد', color: 'bg-cyan-100 text-cyan-700', icon: FileText },
  diploma: { label: 'شهادة/دبلوم', color: 'bg-indigo-100 text-indigo-700', icon: FileText },
  other: { label: 'أخرى', color: 'bg-gray-100 text-gray-700', icon: FileArchive },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function ArchiveSection() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // حقول النموذج
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '', type: 'other', studentId: '', studentName: '',
    description: '', tags: '',
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType !== 'all') params.set('type', filterType);
      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      showStatus('error', 'فشل التحميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/students').then(r => r.json()).then(d => setStudents(d.students || []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [search, filterType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    if (!formData.title) {
      setFormData({ ...formData, title: file.name.replace(/\.[^/.]+$/, '') });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!formData.title) {
        setFormData({ ...formData, title: file.name.replace(/\.[^/.]+$/, '') });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      showStatus('error', 'الملف مطلوب');
      return;
    }
    if (!formData.title.trim()) {
      showStatus('error', 'العنوان مطلوب');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('title', formData.title);
      fd.append('type', formData.type);
      if (formData.studentId) fd.append('studentId', formData.studentId);
      if (formData.studentName) fd.append('studentName', formData.studentName);
      if (formData.description) fd.append('description', formData.description);
      if (formData.tags) fd.append('tags', formData.tags);

      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      if (res.ok) {
        showStatus('success', 'تم رفع الوثيقة بنجاح');
        setFormData({ title: '', type: 'other', studentId: '', studentName: '', description: '', tags: '' });
        setUploadFile(null);
        setShowForm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        showStatus('error', err.error || 'فشل الرفع');
      }
    } catch (e: any) {
      showStatus('error', 'خطأ: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذه الوثيقة نهائياً؟')) return;
    const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      showStatus('success', 'تم الحذف');
      load();
    } else {
      showStatus('error', 'فشل الحذف');
    }
  };

  const handlePrint = (doc: DocumentItem) => {
    const win = window.open(doc.filePath, '_blank');
    if (win) {
      win.onload = () => {
        setTimeout(() => win.print(), 500);
      };
    }
  };

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">الأرشيف</h2>
            <p className="text-sm text-muted-foreground">{documents.length} وثيقة — مسح وإدارة الوثائق</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
          {showForm ? 'إلغاء' : 'رفع وثيقة'}
        </Button>
      </div>

      {/* رسالة الحالة */}
      {statusMsg && (
        <div className={`p-3 rounded-lg border ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm font-medium">{statusMsg.text}</p>
        </div>
      )}

      {/* نموذج الرفع */}
      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardHeader><CardTitle>رفع وثيقة جديدة</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* منطقة رفع الملف */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-primary" />
                    <p className="font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(uploadFile.size)}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    >
                      <X className="w-4 h-4 ml-1" /> إزالة
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    <p className="font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
                    <p className="text-xs text-muted-foreground">صور (JPG, PNG, WebP) | PDF | Word — حد أقصى 10 ميغابايت</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>العنوان *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: شهادة ميلاد أحمد"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(typeConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الطالب (اختياري)</Label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => {
                      const s = students.find(s => s.id === e.target.value);
                      setFormData({ ...formData, studentId: e.target.value, studentName: s?.name || '' });
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— بدون طالب —</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>الوسوم (مفصولة بفواصل)</Label>
                  <Input
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="مثال: مهم، ملصق، 2026"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={uploading} className="flex-1">
                  {uploading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</> : <><Upload className="w-4 h-4 ml-2" /> رفع الوثيقة</>}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* الفلاتر */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث في الوثائق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل الأنواع</option>
          {Object.entries(typeConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* قائمة الوثائق */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>لا توجد وثائق في الأرشيف</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => {
            const tc = typeConfig[doc.type] || typeConfig.other;
            const TIcon = tc.icon;
            return (
              <Card key={doc.id} className="overflow-hidden hover:shadow-lg transition-all">
                {/* معاينة */}
                <div
                  className="h-40 bg-muted flex items-center justify-center cursor-pointer"
                  onClick={() => setPreviewDoc(doc)}
                >
                  {isImage(doc.mimeType) ? (
                    <img src={doc.filePath} alt={doc.title} className="w-full h-full object-cover" />
                  ) : isPdf(doc.mimeType) ? (
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto text-red-500" />
                      <p className="text-xs mt-1">PDF</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileArchive className="w-16 h-16 mx-auto text-muted-foreground" />
                      <p className="text-xs mt-1">ملف</p>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm truncate flex-1">{doc.title}</h4>
                    <Badge className={`text-xs ${tc.color} flex-shrink-0`}>
                      <TIcon className="w-3 h-3 ml-1" /> {tc.label}
                    </Badge>
                  </div>

                  {doc.student?.name && (
                    <p className="text-xs text-muted-foreground">👤 {doc.student.name}</p>
                  )}
                  {doc.studentName && !doc.student?.name && (
                    <p className="text-xs text-muted-foreground">👤 {doc.studentName}</p>
                  )}

                  {doc.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                  )}

                  {doc.tags && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.split(',').map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{tag.trim()}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-[10px] text-muted-foreground">
                      {formatSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreviewDoc(doc)}>
                      <Eye className="w-3 h-3 ml-1" /> عرض
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePrint(doc)} title="طباعة">
                      <Printer className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={doc.filePath} download title="تحميل">
                        <Download className="w-3 h-3" />
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)} title="حذف">
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* معاينة الوثيقة */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">{previewDoc.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {typeConfig[previewDoc.type]?.label} • {formatSize(previewDoc.fileSize)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handlePrint(previewDoc)}>
                  <Printer className="w-4 h-4 ml-1" /> طباعة
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={previewDoc.filePath} download>
                    <Download className="w-4 h-4 ml-1" /> تحميل
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30">
              {isImage(previewDoc.mimeType) ? (
                <img src={previewDoc.filePath} alt={previewDoc.title} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
              ) : isPdf(previewDoc.mimeType) ? (
                <iframe src={previewDoc.filePath} className="w-full h-[70vh] rounded-lg" title={previewDoc.title} />
              ) : (
                <div className="text-center py-12">
                  <FileArchive className="w-16 h-16 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">لا يمكن عرض هذا النوع من الملفات</p>
                  <Button asChild>
                    <a href={previewDoc.filePath} download>
                      <Download className="w-4 h-4 ml-2" /> تحميل الملف
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
