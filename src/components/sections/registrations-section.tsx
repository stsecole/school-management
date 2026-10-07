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
import { Plus, Search, Trash2, Download, Upload, FileText, Image as ImageIcon, Loader2, Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Registration {
  id: string;
  date: string;
  courseName: string;
  level: string | null;
  specialty: string | null;
  note: string | null;
  photoUrl: string | null;
  student: { id: string; name: string; studentNumber: string | null; department?: { name: string }; };
}

interface Student { id: string; name: string; }
interface Course { id: string; name: string; }
interface Level { id: string; name: string; }

const empty = {
  studentId: '', courseId: '', courseName: '', level: '', specialty: '',
  date: new Date().toISOString().split('T')[0], note: '', photoUrl: '',
};

export function RegistrationsSection() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>(empty);
  const [fileUploading, setFileUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Registration | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const res = await fetch(`/api/registrations?${params.toString()}`);
    const data = await res.json();
    setRegistrations(data.registrations || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/students').then(r => r.json()).then(d => setStudents(d.students || []));
    fetch('/api/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
    fetch('/api/levels').then(r => r.json()).then(d => setLevels(d.levels || []));
  }, []);
  useEffect(() => { load(); }, [search]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'registrations');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل الرفع');
      }
      const data = await res.json();
      setFormData((prev: any) => ({ ...prev, photoUrl: data.url }));
      toast({ title: 'تم', description: 'تم رفع الملف' });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message || 'تعذر رفع الملف', variant: 'destructive' });
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.studentId) {
      toast({ title: 'تنبيه', description: 'يرجى اختيار الطالب', variant: 'destructive' });
      return;
    }
    const res = await fetch('/api/registrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
    });
    if (res.ok) {
      toast({ title: 'تم', description: 'تمت إضافة التسجيل' });
      setDialogOpen(false);
      setFormData(empty);
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا التسجيل؟')) return;
    const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  const isImage = (url: string | null) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">التسجيلات</h2>
          <p className="text-muted-foreground text-sm">إجمالي: {registrations.length} تسجيل</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/registrations', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={() => { setFormData(empty); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-2" /> تسجيل جديد
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الدورة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
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
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الطالب</TableHead>
                  <TableHead>رقم الطالب</TableHead>
                  <TableHead>الدورة</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead className="text-center">الملف</TableHead>
                  <TableHead>ملاحظة</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : registrations.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد تسجيلات</TableCell></TableRow>
                ) : registrations.map((r, i) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="num text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="num text-sm">{new Date(r.date).toLocaleDateString('ar')}</TableCell>
                    <TableCell className="font-medium">{r.student.name}</TableCell>
                    <TableCell className="font-mono text-xs num">{r.student.studentNumber || '-'}</TableCell>
                    <TableCell>{r.courseName}</TableCell>
                    <TableCell>{r.level || '-'}</TableCell>
                    <TableCell className="text-center">
                      {r.photoUrl ? (
                        <button
                          onClick={() => setPreviewFile(r)}
                          className="inline-flex p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          title="عرض الملف"
                        >
                          {isImage(r.photoUrl) ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.note || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: تسجيل جديد */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>تسجيل جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>الطالب *</Label>
              <Select value={formData.studentId} onValueChange={(v) => setFormData({ ...formData, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الدورة</Label>
              <Select value={formData.courseId} onValueChange={(v) => {
                const c = courses.find(c => c.id === v);
                setFormData({ ...formData, courseId: v, courseName: c?.name || '' });
              }}>
                <SelectTrigger><SelectValue placeholder="اختر الدورة" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levels.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التخصص</Label>
              <Input value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} dir="ltr" />
            </div>

            {/* مرفق: ملف التسجيل */}
            <div className="space-y-2 md:col-span-2">
              <Label>ملف التسجيل (صورة / PDF)</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUploading}
                >
                  {fileUploading ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</>
                  ) : (
                    <><Upload className="w-4 h-4 ml-2" /> رفع ملف</>
                  )}
                </Button>
                {formData.photoUrl && (
                  <>
                    <Badge variant="secondary" className="gap-1">
                      {isImage(formData.photoUrl) ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      ملف مرفق
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, photoUrl: '' })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              {formData.photoUrl && isImage(formData.photoUrl) && (
                <div className="mt-2">
                  <img
                    src={formData.photoUrl}
                    alt="معاينة"
                    className="max-h-32 rounded-lg border"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظة</Label>
              <Textarea value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>تسجيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: معاينة الملف */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ملف التسجيل — {previewFile?.student.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {previewFile?.photoUrl && isImage(previewFile.photoUrl) ? (
              <img
                src={previewFile.photoUrl}
                alt="ملف التسجيل"
                className="w-full max-h-[70vh] object-contain rounded-lg border"
              />
            ) : previewFile?.photoUrl ? (
              <div className="flex flex-col items-center gap-4 p-8">
                <FileText className="w-16 h-16 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">هذا ملف PDF</p>
                <Button asChild>
                  <a href={previewFile.photoUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="w-4 h-4 ml-2" /> فتح الملف في تبويب جديد
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button asChild variant="outline">
              <a href={previewFile?.photoUrl || '#'} target="_blank" rel="noopener noreferrer" download>
                <Download className="w-4 h-4 ml-2" /> تحميل
              </a>
            </Button>
            <Button onClick={() => setPreviewFile(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
