'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  IdCard, Users, BookOpen, UserPlus, Search, Printer, Loader2, GraduationCap,
  Camera, Upload, Filter, CalendarClock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  studentNumber: string | null;
  name: string;
  phone: string | null;
  gender: string | null;
  status: string;
  photoUrl: string | null;
  department: { name: string } | null;
  level: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface Specialization {
  id: string;
  name: string;
  departmentId: string;
}

const TS_DEPT_CODE = 'TS';
const SUPPORT_DEPT_CODE = 'SUPPORT';

/**
 * بطاقات هوية الطلاب
 *
 * Replacement for the old prompt()-based UI. Provides:
 *  - بطاقة "كل الطلاب": طباعة كل البطاقات
 *  - بطاقة "حسب القسم": اختيار القسم من قائمة منسدلة (وليس prompt)
 *  - بطاقة "طالب واحد": نافذة بحث حقيقية بالاسم/رقم الطالب، الضغط على الطالب يفتح البطاقة
 */
export function StudentCardsSection() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const { toast } = useToast();

  // Advanced filter state
  const [advFilterOpen, setAdvFilterOpen] = useState(false);
  const [filterDeptId, setFilterDeptId] = useState('all');
  const [filterSpecId, setFilterSpecId] = useState('all');
  const [filterBatchMonth, setFilterBatchMonth] = useState('all');
  const [filterEducationLevel, setFilterEducationLevel] = useState('all');
  const [filterSchoolStream, setFilterSchoolStream] = useState('all');
  const [filterSchoolYear, setFilterSchoolYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGender, setFilterGender] = useState('all');

  useEffect(() => {
    fetch('/api/students?limit=500')
      .then(r => r.json())
      .then(d => {
        setStudents(d.students || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch('/api/departments')
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []));
    fetch('/api/specializations')
      .then(r => r.json())
      .then(d => setSpecializations(d.specializations || []));
  }, []);

  // Get selected department
  const selectedDept = departments.find(d => d.id === filterDeptId);
  const isTsDept = selectedDept?.code === TS_DEPT_CODE;
  const isSupportDept = selectedDept?.code === SUPPORT_DEPT_CODE;

  // Available specializations for selected department
  const availableSpecs = useMemo(() => {
    if (filterDeptId === 'all') return [];
    return specializations.filter(s => s.departmentId === filterDeptId);
  }, [specializations, filterDeptId]);

  // Build filter URL
  const buildFilterUrl = () => {
    const params = new URLSearchParams();
    if (filterDeptId !== 'all') params.set('departmentId', filterDeptId);
    if (filterSpecId !== 'all') params.set('specializationId', filterSpecId);
    if (filterBatchMonth !== 'all') params.set('batchMonth', filterBatchMonth);
    if (filterEducationLevel !== 'all') params.set('educationLevel', filterEducationLevel);
    if (filterSchoolStream !== 'all') params.set('schoolStream', filterSchoolStream);
    if (filterSchoolYear !== 'all') params.set('schoolYear', filterSchoolYear);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterGender !== 'all') params.set('gender', filterGender);
    return `/api/student-cards?${params.toString()}`;
  };

  const handleAdvPrint = () => {
    openCard(buildFilterUrl());
    setAdvFilterOpen(false);
  };

  // Filter students by search (name or student number)
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students.slice(0, 50);
    const q = search.trim().toLowerCase();
    return students
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q) ||
        (s.department?.name || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [students, search]);

  // Group students by department for the "by department" view
  const studentsByDept = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(s => {
      const deptName = s.department?.name || 'بدون قسم';
      map.set(deptName, (map.get(deptName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [students]);

  const openCard = (url: string) => {
    window.open(url, '_blank');
    toast({ title: 'تم', description: 'تم فتح البطاقة للطباعة' });
  };

  // Trigger file picker for a specific student
  const handlePhotoClick = (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    setPendingUploadId(studentId);
    fileInputRef.current?.click();
  };

  // Upload selected photo to the server and update the student record
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const studentId = pendingUploadId;
    if (!file || !studentId) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون صورة', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الملف كبير جداً (حد أقصى 5 ميجا)', variant: 'destructive' });
      return;
    }

    setUploadingId(studentId);
    try {
      // 1. Upload the file
      const fd = new FormData();
      fd.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast({ title: 'خطأ', description: uploadData.error || 'فشل رفع الصورة', variant: 'destructive' });
        return;
      }

      // 2. Update student record with photoUrl
      const updateRes = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: uploadData.url }),
      });
      if (!updateRes.ok) {
        toast({ title: 'خطأ', description: 'تم رفع الصورة لكن فشل تحديث بيانات الطالب', variant: 'destructive' });
        return;
      }

      // 3. Update local state
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, photoUrl: uploadData.url } : s));
      toast({ title: 'تم', description: 'تم رفع صورة الطالب بنجاح' });
    } catch (err) {
      toast({ title: 'خطأ', description: 'تعذر رفع الصورة', variant: 'destructive' });
    } finally {
      setUploadingId(null);
      setPendingUploadId(null);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white">
          <IdCard className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">بطاقات هوية الطلاب</h2>
          <p className="text-sm text-muted-foreground">توليد وطباعة بطاقات احترافية مع QR Code</p>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي الطلاب</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold num text-blue-700">{students.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">عدد الأقسام</span>
              <BookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold num text-emerald-700">{departments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">مسجلين</span>
              <GraduationCap className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold num text-amber-700">
              {students.filter(s => s.status === 'registered').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">مستمرين</span>
              <GraduationCap className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold num text-purple-700">
              {students.filter(s => s.status === 'continuing').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Three action cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all" onClick={() => openCard('/api/student-cards?all=true')}>
          <Users className="w-12 h-12 mx-auto mb-3 text-blue-600" />
          <h3 className="font-semibold mb-1">كل الطلاب</h3>
          <p className="text-xs text-muted-foreground">طباعة بطاقات كل الطلاب ({students.length} طالب)</p>
        </Card>

        <Card className="p-6 text-center cursor-pointer hover:shadow-lg hover:border-emerald-400 transition-all" onClick={() => setDeptDialogOpen(true)}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
          <h3 className="font-semibold mb-1">حسب القسم</h3>
          <p className="text-xs text-muted-foreground">بطاقات قسم محدد ({departments.length} قسم)</p>
        </Card>

        <Card className="p-6 text-center cursor-pointer hover:shadow-lg hover:border-orange-400 transition-all" onClick={() => setAdvFilterOpen(true)}>
          <Filter className="w-12 h-12 mx-auto mb-3 text-orange-600" />
          <h3 className="font-semibold mb-1">فلترة متقدمة</h3>
          <p className="text-xs text-muted-foreground">تخصص، دفعة، شعبة، طور...</p>
        </Card>

        <Card className="p-6 text-center cursor-pointer hover:shadow-lg hover:border-purple-400 transition-all" onClick={() => setSearchOpen(true)}>
          <UserPlus className="w-12 h-12 mx-auto mb-3 text-purple-600" />
          <h3 className="font-semibold mb-1">طالب واحد</h3>
          <p className="text-xs text-muted-foreground">بحث عن طالب وطباعة بطاقته</p>
        </Card>
      </div>

      {/* Recent students quick-print */}
      <Card>
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-semibold flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" /> طباعة سريعة لطالب
          </h3>
          <p className="text-xs text-muted-foreground mt-1">اضغط على أي طالب لطباعة بطاقته مباشرة</p>
        </div>
        <div className="p-0 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              جاري التحميل...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا يوجد طلاب</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
              {filteredStudents.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 hover:border-primary cursor-pointer transition-all"
                  onClick={() => openCard(`/api/student-cards?id=${s.id}`)}
                  title="اضغط لطباعة البطاقة"
                >
                  <div className="relative flex-shrink-0">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-9 h-9 rounded-full object-cover border border-primary/30"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    {/* Photo upload button (overlaid) */}
                    <button
                      type="button"
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80 transition-colors"
                      onClick={(e) => handlePhotoClick(e, s.id)}
                      title={s.photoUrl ? 'تغيير الصورة' : 'إضافة صورة'}
                      disabled={uploadingId === s.id}
                    >
                      {uploadingId === s.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Camera className="w-2.5 h-2.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground num">
                      {s.studentNumber || '—'} • {s.department?.name || 'بدون قسم'}
                    </div>
                  </div>
                  <Printer className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Search dialog for single student */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-600" /> بحث عن طالب
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو رقم الطالب أو القسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                جاري التحميل...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search.trim() ? 'لا توجد نتائج مطابقة' : 'ابدأ بالكتابة للبحث'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStudents.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 hover:border-primary cursor-pointer transition-all"
                    onClick={() => {
                      openCard(`/api/student-cards?id=${s.id}`);
                      setSearchOpen(false);
                      setSearch('');
                    }}
                  >
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-primary/30 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground num">
                        {s.studentNumber || 'بدون رقم'} • {s.department?.name || 'بدون قسم'} • {s.level?.name || 'بدون مستوى'}
                      </div>
                    </div>
                    <Badge
                      variant={s.status === 'registered' ? 'default' : s.status === 'continuing' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {s.status === 'registered' ? 'مسجل' : s.status === 'continuing' ? 'مستمر' : s.status}
                    </Badge>
                    <Printer className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSearchOpen(false); setSearch(''); }}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department selection dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" /> اختر القسم
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-1 py-2">
            {departments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد أقسام</p>
            ) : (
              departments.map(d => {
                const count = studentsByDept.find(s => s.name === d.name)?.count || 0;
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 hover:border-emerald-500 cursor-pointer transition-all"
                    onClick={() => {
                      openCard(`/api/student-cards?departmentId=${d.id}`);
                      setDeptDialogOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">{d.name}</span>
                    </div>
                    <Badge variant="secondary" className="num">{count} طالب</Badge>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file input for photo uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* Advanced filter dialog */}
      <Dialog open={advFilterOpen} onOpenChange={setAdvFilterOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-orange-600" /> فلترة متقدمة للطباعة
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {/* Department */}
            <div className="space-y-2">
              <Label className="text-xs">القسم</Label>
              <Select value={filterDeptId} onValueChange={(v) => { setFilterDeptId(v); setFilterSpecId('all'); }}>
                <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Specialization (only for TS department) */}
            {isTsDept && availableSpecs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-purple-700">التخصص (التقني سامي)</Label>
                <Select value={filterSpecId} onValueChange={setFilterSpecId}>
                  <SelectTrigger><SelectValue placeholder="كل التخصصات" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل التخصصات</SelectItem>
                    {availableSpecs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Batch month (only for TS department) */}
            {isTsDept && (
              <div className="space-y-2">
                <Label className="text-xs text-blue-700">الدفعة (التقني سامي)</Label>
                <Input
                  type="month"
                  value={filterBatchMonth === 'all' ? '' : filterBatchMonth}
                  onChange={(e) => setFilterBatchMonth(e.target.value || 'all')}
                  dir="ltr"
                />
              </div>
            )}

            {/* Education level (only for SUPPORT department) */}
            {isSupportDept && (
              <div className="space-y-2">
                <Label className="text-xs text-purple-700">الطور (الدعم المدرسي)</Label>
                <Select value={filterEducationLevel} onValueChange={setFilterEducationLevel}>
                  <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="ابتدائي">ابتدائي</SelectItem>
                    <SelectItem value="متوسط">متوسط</SelectItem>
                    <SelectItem value="ثانوي">ثانوي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* School stream (only for SUPPORT) */}
            {isSupportDept && (
              <div className="space-y-2">
                <Label className="text-xs text-purple-700">الشعبة (الدعم المدرسي)</Label>
                <Select value={filterSchoolStream} onValueChange={setFilterSchoolStream}>
                  <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="علوم تجريبية">علوم تجريبية</SelectItem>
                    <SelectItem value="رياضيات">رياضيات</SelectItem>
                    <SelectItem value="تقني رياضي">تقني رياضي</SelectItem>
                    <SelectItem value="تسيير واقتصاد">تسيير واقتصاد</SelectItem>
                    <SelectItem value="لغات">لغات</SelectItem>
                    <SelectItem value="آداب وفلسفة">آداب وفلسفة</SelectItem>
                    <SelectItem value="طرائق">طرائق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* School year (only for SUPPORT) */}
            {isSupportDept && (
              <div className="space-y-2">
                <Label className="text-xs text-purple-700">السنة (الدعم المدرسي)</Label>
                <Select value={filterSchoolYear} onValueChange={setFilterSchoolYear}>
                  <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="الأولى">الأولى</SelectItem>
                    <SelectItem value="الثانية">الثانية</SelectItem>
                    <SelectItem value="الثالثة">الثالثة</SelectItem>
                    <SelectItem value="الرابعة">الرابعة</SelectItem>
                    <SelectItem value="الخامسة">الخامسة</SelectItem>
                    <SelectItem value="السادسة">السادسة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs">الحالة</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="registered">مسجّل</SelectItem>
                  <SelectItem value="continuing">مستمر</SelectItem>
                  <SelectItem value="graduated">متخرج</SelectItem>
                  <SelectItem value="abandoned">منقطع</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-xs">الجنس</Label>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="ذكر">ذكر</SelectItem>
                  <SelectItem value="أنثى">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary of active filters */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-900">
            <p className="font-medium mb-1">الفلاتر النشطة:</p>
            <div className="flex flex-wrap gap-1">
              {filterDeptId !== 'all' && <Badge variant="secondary" className="text-xs">قسم: {selectedDept?.name}</Badge>}
              {filterSpecId !== 'all' && <Badge variant="secondary" className="text-xs">تخصص</Badge>}
              {filterBatchMonth !== 'all' && <Badge variant="secondary" className="text-xs">دفعة: {filterBatchMonth}</Badge>}
              {filterEducationLevel !== 'all' && <Badge variant="secondary" className="text-xs">طور: {filterEducationLevel}</Badge>}
              {filterSchoolStream !== 'all' && <Badge variant="secondary" className="text-xs">شعبة: {filterSchoolStream}</Badge>}
              {filterSchoolYear !== 'all' && <Badge variant="secondary" className="text-xs">سنة: {filterSchoolYear}</Badge>}
              {filterStatus !== 'all' && <Badge variant="secondary" className="text-xs">حالة: {filterStatus}</Badge>}
              {filterGender !== 'all' && <Badge variant="secondary" className="text-xs">جنس: {filterGender}</Badge>}
              {filterDeptId === 'all' && filterStatus === 'all' && filterGender === 'all' && <span className="text-muted-foreground">لا توجد فلاتر — سيتم طباعة كل الطلاب</span>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFilterDeptId('all'); setFilterSpecId('all'); setFilterBatchMonth('all');
              setFilterEducationLevel('all'); setFilterSchoolStream('all'); setFilterSchoolYear('all');
              setFilterStatus('all'); setFilterGender('all');
            }}>إعادة ضبط</Button>
            <Button onClick={handleAdvPrint} className="bg-orange-600 hover:bg-orange-700">
              <Printer className="w-4 h-4 ml-2" /> طباعة البطاقات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info banner about photos */}
      {students.filter(s => !s.photoUrl).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-3 flex items-start gap-2">
            <Camera className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">إضافة صور الطلاب</p>
              <p className="mt-1">
                يوجد {students.filter(s => !s.photoUrl).length} طالب بدون صورة.
                اضغط على أيقونة <Camera className="w-3 h-3 inline mx-1" /> بجانب صورة الطالب لإضافة صورته.
                ستظهر الصورة في البطاقة المطبوعة تلقائياً.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
