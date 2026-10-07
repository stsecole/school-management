'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Search, Edit, Trash2, FileText, Users, BarChart3, Save, Loader2,
  Award, TrendingUp, X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Exam {
  id: string;
  title: string;
  examDate: string;
  maxScore: number;
  passingScore: number;
  weight: number;
  term: string;
  status: string;
  departmentId: string | null;
  levelId: string | null;
  courseId: string | null;
  notes: string | null;
  department?: { name: string } | null;
  level?: { name: string } | null;
  course?: { name: string } | null;
  _count: { grades: number };
  stats: {
    average: number;
    highest: number;
    lowest: number;
    passRate: number;
    gradedCount: number;
  };
}

interface Grade {
  id: string;
  studentId: string;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  notes: string | null;
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    department?: { name: string } | null;
    level?: { name: string } | null;
  };
}

interface ExamDetails extends Exam {
  grades: Grade[];
}

interface Department { id: string; name: string; }
interface Level { id: string; name: string; }
interface Course { id: string; name: string; }

const emptyForm = {
  title: '', examDate: '', maxScore: '20', passingScore: '10', weight: '1',
  term: 'first', status: 'scheduled', departmentId: '', levelId: '', courseId: '',
  notes: '', autoEnroll: false,
};

const termLabels: Record<string, string> = {
  first: 'الفصل الأول',
  second: 'الفصل الثاني',
  final: 'الامتحان النهائي',
};

const statusLabels: Record<string, string> = {
  scheduled: 'مجدول',
  completed: 'منتهٍ',
  cancelled: 'ملغى',
};

export function ExamsSection({ isDirector = false }: { isDirector?: boolean }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [formData, setFormData] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  // grades dialog
  const [gradesDialog, setOpenGrades] = useState<{ open: boolean; exam: ExamDetails | null }>({ open: false, exam: null });
  const [gradesLoading, setGradesLoading] = useState(false);
  const [editableGrades, setEditableGrades] = useState<Grade[]>([]);
  const [savingGrades, setSavingGrades] = useState(false);

  // stats dialog
  const [statsDialog, setStatsDialog] = useState<{ open: boolean; exam: Exam | null; stats: any }>({ open: false, exam: null, stats: null });
  const [statsLoading, setStatsLoading] = useState(false);

  // add students dialog
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [addStudentsDept, setAddStudentsDept] = useState('');
  const [addStudentsLevel, setAddStudentsLevel] = useState('');

  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterDept !== 'all') params.set('departmentId', filterDept);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    try {
      const res = await fetch(`/api/exams?${params.toString()}`);
      const data = await res.json();
      setExams(data.exams || []);
    } catch {
      toast({ title: 'خطأ', description: 'تعذر تحميل الامتحانات', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
    fetch('/api/levels').then(r => r.json()).then(d => setLevels(d.levels || []));
    fetch('/api/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
  }, []);

  useEffect(() => { load(); }, [search, filterDept, filterStatus]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (e: Exam) => {
    setEditing(e);
    setFormData({
      title: e.title,
      examDate: e.examDate ? e.examDate.split('T')[0] : '',
      maxScore: String(e.maxScore),
      passingScore: String(e.passingScore),
      weight: String(e.weight),
      term: e.term,
      status: e.status,
      departmentId: e.departmentId || '',
      levelId: e.levelId || '',
      courseId: e.courseId || '',
      notes: e.notes || '',
      autoEnroll: false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.examDate) {
      toast({ title: 'تنبيه', description: 'العنوان والتاريخ مطلوبان', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/exams/${editing.id}` : '/api/exams';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: Exam) => {
    if (!confirm(`حذف الامتحان "${e.title}"؟ سيتم حذف جميع الدرجات المرتبطة.`)) return;
    const res = await fetch(`/api/exams/${e.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'تم', description: 'تم الحذف' });
      load();
    } else {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
    }
  };

  // ===== إدارة الدرجات =====
  const handleOpenGrades = async (e: Exam) => {
    setOpenGrades({ open: true, exam: null });
    setGradesLoading(true);
    try {
      const res = await fetch(`/api/exams/${e.id}`);
      const data = await res.json();
      if (res.ok) {
        setOpenGrades({ open: true, exam: data.exam });
        setEditableGrades(data.exam.grades.map((g: Grade) => ({ ...g })));
      } else {
        toast({ title: 'خطأ', description: data.error || 'تعذر التحميل', variant: 'destructive' });
        setOpenGrades({ open: false, exam: null });
      }
    } finally {
      setGradesLoading(false);
    }
  };

  const updateGrade = (id: string, field: keyof Grade, value: any) => {
    setEditableGrades(prev =>
      prev.map(g => {
        if (g.id !== id) return g;
        const updated = { ...g, [field]: value };
        // غائب = لا درجة
        if (field === 'isAbsent' && value === true) {
          updated.score = null;
        }
        return updated;
      })
    );
  };

  const handleSaveGrades = async () => {
    if (!gradesDialog.exam) return;
    setSavingGrades(true);
    try {
      const res = await fetch(`/api/exams/${gradesDialog.exam.id}/grades`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grades: editableGrades.map(g => ({
            id: g.id,
            score: g.score,
            isAbsent: g.isAbsent,
            isExcused: g.isExcused,
            notes: g.notes,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: `تم حفظ ${data.updatedCount} درجة` });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } finally {
      setSavingGrades(false);
    }
  };

  const handleAddStudents = async () => {
    if (!gradesDialog.exam) return;
    if (!addStudentsDept) {
      toast({ title: 'تنبيه', description: 'اختر القسم', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(`/api/exams/${gradesDialog.exam.id}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: addStudentsDept, levelId: addStudentsLevel || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'تم', description: `تمت إضافة ${data.addedCount} طالب` });
        setAddStudentsOpen(false);
        setAddStudentsDept('');
        setAddStudentsLevel('');
        // إعادة تحميل الدرجات
        handleOpenGrades(gradesDialog.exam);
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الإضافة', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    }
  };

  // ===== إحصائيات =====
  const handleOpenStats = async (e: Exam) => {
    setStatsDialog({ open: true, exam: e, stats: null });
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/exams/${e.id}`);
      const data = await res.json();
      if (res.ok) {
        setStatsDialog({ open: true, exam: e, stats: data.stats });
      }
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> الامتحانات
          </h2>
          <p className="text-muted-foreground text-sm">
            <span className="num font-medium">{exams.length}</span> امتحان
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 ml-2" /> امتحان جديد
        </Button>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="scheduled">مجدول</SelectItem>
                <SelectItem value="completed">منتهٍ</SelectItem>
                <SelectItem value="cancelled">ملغى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* شبكة الامتحانات */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="mr-3 text-muted-foreground">جاري التحميل...</span>
        </div>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            لا توجد امتحانات. اضغط &quot;امتحان جديد&quot; للبدء.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map(e => (
            <Card key={e.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-base">{e.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.department?.name || 'بدون قسم'}
                      {e.level ? ` • ${e.level.name}` : ''}
                      {e.course ? ` • ${e.course.name}` : ''}
                    </p>
                  </div>
                  <Badge variant={e.status === 'completed' ? 'default' : e.status === 'cancelled' ? 'destructive' : 'secondary'}>
                    {statusLabels[e.status]}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="num">
                    {new Date(e.examDate).toLocaleDateString('ar')}
                  </Badge>
                  <Badge variant="outline">{termLabels[e.term] || e.term}</Badge>
                  <Badge variant="outline" className="num">
                    معامل {e.weight}
                  </Badge>
                  <Badge variant="outline" className="num">
                    <Users className="w-3 h-3 ml-1" /> {e._count.grades}
                  </Badge>
                </div>

                {e._count.grades > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">المعدل</p>
                      <p className="font-bold text-sm num text-primary">{e.stats.average}/{e.maxScore}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">نجاح</p>
                      <p className="font-bold text-sm num text-emerald-600">{e.stats.passRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">عليا</p>
                      <p className="font-bold text-sm num text-amber-600">{e.stats.highest}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => handleOpenGrades(e)}>
                    <Users className="w-3.5 h-3.5 ml-1" /> الدرجات
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleOpenStats(e)}>
                    <BarChart3 className="w-3.5 h-3.5 ml-1" /> إحصائيات
                  </Button>
                  {isDirector && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(e)}>
                        <Edit className="w-3.5 h-3.5 text-amber-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(e)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* حوار إنشاء/تعديل الامتحان */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل الامتحان' : 'امتحان جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>عنوان الامتحان *</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: امتحان الفصل الأول - رياضيات"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الامتحان *</Label>
                <Input
                  type="date"
                  value={formData.examDate}
                  onChange={e => setFormData({ ...formData, examDate: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>الفصل</Label>
                <Select value={formData.term} onValueChange={v => setFormData({ ...formData, term: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">الفصل الأول</SelectItem>
                    <SelectItem value="second">الفصل الثاني</SelectItem>
                    <SelectItem value="final">الامتحان النهائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>العلامة القصوى</Label>
                <Input type="number" step="0.5" value={formData.maxScore} onChange={e => setFormData({ ...formData, maxScore: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>علامة النجاح</Label>
                <Input type="number" step="0.5" value={formData.passingScore} onChange={e => setFormData({ ...formData, passingScore: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المعامل</Label>
                <Input type="number" step="0.5" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select value={formData.departmentId || 'none'} onValueChange={v => setFormData({ ...formData, departmentId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون قسم</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المستوى</Label>
                <Select value={formData.levelId || 'none'} onValueChange={v => setFormData({ ...formData, levelId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مستوى</SelectItem>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>المادة (اختياري)</Label>
              <Select value={formData.courseId || 'none'} onValueChange={v => setFormData({ ...formData, courseId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مادة</SelectItem>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">مجدول</SelectItem>
                  <SelectItem value="completed">منتهٍ</SelectItem>
                  <SelectItem value="cancelled">ملغى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>
            {!editing && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="auto-enroll" className="cursor-pointer">التسجيل التلقائي لطلاب القسم</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">إنشاء درجات فارغة لكل طلاب القسم المحدد</p>
                </div>
                <Switch
                  id="auto-enroll"
                  checked={formData.autoEnroll}
                  onCheckedChange={v => setFormData({ ...formData, autoEnroll: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار إدارة الدرجات */}
      <Dialog open={gradesDialog.open} onOpenChange={v => setOpenGrades({ ...gradesDialog, open: v })}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              إدارة الدرجات - {gradesDialog.exam?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                عدد الطلاب: <span className="num font-medium">{editableGrades.length}</span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddStudentsOpen(true)}>
                  <Plus className="w-3.5 h-3.5 ml-1" /> إضافة طلاب
                </Button>
                <Button size="sm" onClick={handleSaveGrades} disabled={savingGrades || editableGrades.length === 0}>
                  {savingGrades ? <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" /> : <Save className="w-3.5 h-3.5 ml-1" />}
                  حفظ الدرجات
                </Button>
              </div>
            </div>

            {gradesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : editableGrades.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                لا يوجد طلاب مسجلون. اضغط &quot;إضافة طلاب&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>الطالب</TableHead>
                      <TableHead className="text-center w-32">الدرجة ({gradesDialog.exam?.maxScore})</TableHead>
                      <TableHead className="text-center w-24">غائب</TableHead>
                      <TableHead className="text-center w-24">مبرر</TableHead>
                      <TableHead>ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editableGrades.map((g, i) => (
                      <TableRow key={g.id}>
                        <TableCell className="text-center num text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{g.student.name}</div>
                          {g.student.studentNumber && (
                            <div className="text-xs text-muted-foreground num">{g.student.studentNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max={gradesDialog.exam?.maxScore}
                            value={g.score ?? ''}
                            onChange={e => updateGrade(g.id, 'score', e.target.value === '' ? null : parseFloat(e.target.value))}
                            disabled={g.isAbsent}
                            className="text-center w-24"
                            dir="ltr"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={g.isAbsent}
                            onCheckedChange={v => updateGrade(g.id, 'isAbsent', v === true)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={g.isExcused}
                            onCheckedChange={v => updateGrade(g.id, 'isExcused', v === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={g.notes || ''}
                            onChange={e => updateGrade(g.id, 'notes', e.target.value)}
                            placeholder="-"
                            className="text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* حوار إضافة طلاب */}
      <Dialog open={addStudentsOpen} onOpenChange={setAddStudentsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة طلاب للامتحان</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>القسم *</Label>
              <Select value={addStudentsDept} onValueChange={setAddStudentsDept}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المستوى (اختياري)</Label>
              <Select value={addStudentsLevel || 'none'} onValueChange={v => setAddStudentsLevel(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="كل المستويات" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">كل المستويات</SelectItem>
                  {levels.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentsOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddStudents}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الإحصائيات */}
      <Dialog open={statsDialog.open} onOpenChange={v => setStatsDialog({ ...statsDialog, open: v })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              إحصائيات - {statsDialog.exam?.title}
            </DialogTitle>
          </DialogHeader>
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : statsDialog.stats ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-xs text-muted-foreground">المعدل</p>
                  <p className="text-xl font-bold num text-primary">{statsDialog.stats.average}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 text-center">
                  <p className="text-xs text-muted-foreground">أعلى درجة</p>
                  <p className="text-xl font-bold num text-emerald-700">{statsDialog.stats.highest}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 text-center">
                  <p className="text-xs text-muted-foreground">أدنى درجة</p>
                  <p className="text-xl font-bold num text-red-700">{statsDialog.stats.lowest}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 text-center">
                  <p className="text-xs text-muted-foreground">الغائبون</p>
                  <p className="text-xl font-bold num text-amber-700">{statsDialog.stats.absentCount}</p>
                </div>
              </div>

              {/* شريط نسبة النجاح */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">نسبة النجاح</span>
                  <span className="text-lg font-bold num">
                    {statsDialog.stats.passRate}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      statsDialog.stats.passRate >= 70 ? 'bg-emerald-500' :
                      statsDialog.stats.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${statsDialog.stats.passRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">الناجحون</p>
                    <p className="font-bold num text-emerald-600">{statsDialog.stats.passedCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">الراسبون</p>
                    <p className="font-bold num text-red-600">{statsDialog.stats.failedCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">إجمالي الدرجات</p>
                    <p className="font-bold num">{statsDialog.stats.totalStudents}</p>
                  </div>
                </div>
              </div>

              {/* معلومات إضافية */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <Award className="w-4 h-4 text-amber-600" />
                <span>علامة النجاح: <span className="font-bold num">{statsDialog.exam?.passingScore}/{statsDialog.exam?.maxScore}</span></span>
                <span className="mr-auto">معامل الامتحان: <span className="font-bold num">{statsDialog.exam?.weight}</span></span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsDialog({ ...statsDialog, open: false })}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
