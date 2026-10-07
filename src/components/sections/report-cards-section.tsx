'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Award, Search, Loader2, Printer, FileText, User, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Calendar, Percent, Trophy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentListItem {
  id: string;
  name: string;
  studentNumber: string | null;
  department?: { name: string } | null;
  _count?: { grades: number };
}

interface ReportCard {
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    gender: string | null;
    phone: string | null;
    department: string;
    level: string;
    specialization: string;
  };
  exams: {
    examId: string;
    examTitle: string;
    subjectName: string;
    examDate: string;
    score: number;
    maxScore: number;
    passingScore: number;
    weight: number;
    percentage: number;
    isAbsent: boolean;
    isExcused: boolean;
    isPassed: boolean;
    notes: string | null;
  }[];
  summary: {
    totalExams: number;
    gradedExams: number;
    absentCount: number;
    average: number;
    passedCount: number;
    failedCount: number;
    passRate: number;
    rank: number;
    totalStudentsInDept: number;
    appreciation: string;
    appreciationColor: string;
  };
  generatedAt: string;
}

interface Department { id: string; name: string; }

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return iso; }
};

const APPRECIATION_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
};

export function ReportCardsSection() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('all');

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const { toast } = useToast();

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/report-cards');
      const data = await res.json();
      setStudents(data.students || []);
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر التحميل', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    const res = await fetch('/api/departments');
    const data = await res.json();
    setDepartments(data.departments || []);
  };

  useEffect(() => { loadStudents(); loadDepartments(); }, []);

  const loadReportCard = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setLoadingReport(true);
    setReportCard(null);
    try {
      const res = await fetch(`/api/report-cards?studentId=${studentId}`);
      const data = await res.json();
      if (res.ok) {
        setReportCard(data.reportCard);
      } else {
        toast({ title: 'خطأ', description: data.error, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'تعذر تحميل البطاقة', variant: 'destructive' });
    } finally {
      setLoadingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // فلترة الطلاب
  const filteredStudents = students.filter((s) => {
    if (filterDept !== 'all' && s.department?.name !== departments.find((d) => d.id === filterDept)?.name) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !(s.studentNumber || '').includes(search)) return false;
    return true;
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="space-y-4">
      {/* رأس الصفحة */}
      <div className="flex items-center gap-3 no-print">
        <div className="p-3 rounded-2xl bg-indigo-50">
          <Award className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">بطاقات النتائج</h2>
          <p className="text-muted-foreground text-sm">
            {students.length} طالب لديه درجات
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* قائمة الطلاب */}
        <div className="space-y-3 no-print">
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
              </div>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <p>لا يوجد طلاب لديهم درجات</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => loadReportCard(s.id)}
                      className={`w-full text-right p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex items-center gap-2 ${
                        selectedStudentId === s.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.department?.name || 'بدون قسم'}
                          {s._count && ` • ${s._count.grades} درجة`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* بطاقة النتائج */}
        <div>
          {!selectedStudentId ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground no-print">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>اختر طالباً من القائمة لعرض بطاقة نتائجه</p>
              </CardContent>
            </Card>
          ) : loadingReport ? (
            <Card>
              <CardContent className="py-16 text-center no-print">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">جاري توليد البطاقة...</p>
              </CardContent>
            </Card>
          ) : reportCard ? (
            <ReportCardView reportCard={reportCard} onPrint={handlePrint} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ===== مكون عرض بطاقة النتائج =====
function ReportCardView({ reportCard, onPrint }: { reportCard: ReportCard; onPrint: () => void }) {
  const { student, exams, summary } = reportCard;
  const apprStyle = APPRECIATION_STYLES[summary.appreciationColor] || APPRECIATION_STYLES.amber;

  return (
    <Card className="print:shadow-none print:border-0">
      <CardContent className="p-6">
        {/* رأس البطاقة */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-primary no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">بطاقة النتائج</h3>
              <p className="text-xs text-muted-foreground">مدرسة السلامة التعليمية</p>
            </div>
          </div>
          <Button onClick={onPrint} size="sm">
            <Printer className="w-4 h-4 ml-1" /> طباعة
          </Button>
        </div>

        {/* رأس الطباعة (يظهر فقط عند الطباعة) */}
        <div className="hidden print:block text-center mb-6 pb-4 border-b-2">
          <h1 className="text-2xl font-bold">مدرسة السلامة التعليمية</h1>
          <p className="text-lg mt-1">بطاقة النتائج</p>
        </div>

        {/* معلومات الطالب */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">الاسم واللقب</p>
            <p className="font-bold text-sm">{student.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">رقم الطالب</p>
            <p className="font-medium text-sm num">{student.studentNumber || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">القسم</p>
            <p className="font-medium text-sm">{student.department || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">المستوى</p>
            <p className="font-medium text-sm">{student.level || '-'}</p>
          </div>
        </div>

        {/* الإحصائيات الرئيسية */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {/* المعدل */}
          <div className={`p-3 rounded-lg text-center ${apprStyle.bg} border ${apprStyle.border}`}>
            <p className="text-xs text-muted-foreground">المعدل العام</p>
            <p className={`text-2xl font-bold num ${apprStyle.text}`}>{summary.average}</p>
          </div>
          {/* الترتيب */}
          <div className="p-3 bg-purple-50 rounded-lg text-center border border-purple-200">
            <p className="text-xs text-muted-foreground">الترتيب</p>
            <p className="text-2xl font-bold num text-purple-700">
              {summary.rank > 0 ? `#${summary.rank}` : '-'}
              {summary.totalStudentsInDept > 0 && (
                <span className="text-sm font-normal">/{summary.totalStudentsInDept}</span>
              )}
            </p>
          </div>
          {/* نسبة النجاح */}
          <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-200">
            <p className="text-xs text-muted-foreground">نسبة النجاح</p>
            <p className="text-2xl font-bold num text-blue-700">{summary.passRate}%</p>
          </div>
          {/* ناجح */}
          <div className="p-3 bg-emerald-50 rounded-lg text-center border border-emerald-200">
            <p className="text-xs text-muted-foreground">ناجح</p>
            <p className="text-2xl font-bold num text-emerald-700">{summary.passedCount}</p>
          </div>
          {/* راسب */}
          <div className="p-3 bg-red-50 rounded-lg text-center border border-red-200">
            <p className="text-xs text-muted-foreground">راسب</p>
            <p className="text-2xl font-bold num text-red-700">{summary.failedCount}</p>
          </div>
        </div>

        {/* التقدير */}
        <div className={`p-3 rounded-lg text-center mb-6 ${apprStyle.bg} border ${apprStyle.border}`}>
          <p className={`text-lg font-bold ${apprStyle.text}`}>
            التقدير: {summary.appreciation}
          </p>
        </div>

        {/* جدول الدرجات */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 bg-muted/50">
                <th className="p-2 text-right">#</th>
                <th className="p-2 text-right">المادة / الاختبار</th>
                <th className="p-2 text-center">التاريخ</th>
                <th className="p-2 text-center">الدرجة</th>
                <th className="p-2 text-center">المعامل</th>
                <th className="p-2 text-center">النسبة</th>
                <th className="p-2 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    لا توجد درجات مسجلة
                  </td>
                </tr>
              ) : exams.map((exam, i) => (
                <tr key={exam.examId} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-2 text-center num text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <p className="font-medium">{exam.examTitle}</p>
                    {exam.subjectName && (
                      <p className="text-xs text-muted-foreground">{exam.subjectName}</p>
                    )}
                  </td>
                  <td className="p-2 text-center num text-xs">{formatDate(exam.examDate)}</td>
                  <td className="p-2 text-center num font-bold">
                    {exam.isAbsent ? (
                      <span className="text-amber-600">غائب</span>
                    ) : exam.isExcused ? (
                      <span className="text-blue-600">معفى</span>
                    ) : (
                      <span className={exam.isPassed ? 'text-emerald-600' : 'text-red-600'}>
                        {exam.score} / {exam.maxScore}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center num">{exam.weight}</td>
                  <td className="p-2 text-center num">
                    {exam.isAbsent || exam.isExcused ? '-' : `${exam.percentage}%`}
                  </td>
                  <td className="p-2 text-center">
                    {exam.isAbsent ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">غائب</Badge>
                    ) : exam.isExcused ? (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">معفى</Badge>
                    ) : exam.isPassed ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 ml-0.5" /> ناجح
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700">
                        <XCircle className="w-3 h-3 ml-0.5" /> راسب
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {exams.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-bold">
                  <td colSpan={3} className="p-2 text-left">المجموع:</td>
                  <td className="p-2 text-center num">{summary.average}</td>
                  <td className="p-2 text-center num">
                    {exams.reduce((s, e) => s + (e.isAbsent || e.isExcused ? 0 : e.weight), 0)}
                  </td>
                  <td colSpan={2} className="p-2 text-center num">{summary.passRate}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ملاحظات وتوقيع */}
        <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-2">ملاحظات:</p>
            <div className="h-16 border border-dashed rounded"></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">توقيع المدير / الختم:</p>
            <div className="h-16 border border-dashed rounded"></div>
          </div>
        </div>

        {/* تاريخ الإصدار */}
        <div className="text-center mt-4 pt-2 border-t text-xs text-muted-foreground">
          تاريخ الإصدار: {formatDate(reportCard.generatedAt)}
        </div>
      </CardContent>
    </Card>
  );
}
