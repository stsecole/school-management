'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload, Download, FileSpreadsheet, Users, Wallet, CalendarCheck,
  CheckCircle2, XCircle, Loader2, AlertCircle, FileDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ImportType = 'students' | 'payments' | 'attendance';

interface ImportResult {
  ok: boolean;
  total: number;
  success: number;
  skipped: number;
  errors: any[];
  errorsCount: number;
}

export function ImportSection({ isDirector }: { isDirector: boolean }) {
  const [activeType, setActiveType] = useState<ImportType>('students');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const types = [
    {
      id: 'students' as ImportType,
      label: 'طلاب',
      icon: Users,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
      desc: 'استيراد قائمة طلاب جدد',
    },
    {
      id: 'payments' as ImportType,
      label: 'دفعات',
      icon: Wallet,
      color: 'bg-green-50 border-green-200 text-green-700',
      desc: 'استيراد دفعات الطلاب',
    },
    {
      id: 'attendance' as ImportType,
      label: 'حضور',
      icon: CalendarCheck,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      desc: 'استيراد سجلات الحضور',
    },
  ];

  const downloadTemplate = (type: ImportType) => {
    window.open(`/api/import/template?type=${type}`, '_blank');
    toast({ title: 'تم', description: 'جاري تحميل القالب...' });
  };

  const handleFile = async (file: File) => {
    if (!file) return;

    // تحقق من النوع
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast({
        title: 'خطأ',
        description: 'صيغة غير مدعومة. استخدم: xlsx, xls, csv',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'خطأ',
        description: 'حجم الملف يتجاوز 5 ميغابايت',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/import/${activeType}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.ok !== undefined) {
        setResult(data);
        if (data.success > 0) {
          toast({
            title: 'تم الاستيراد',
            description: `نجح: ${data.success} | فشل: ${data.skipped}`,
          });
        } else {
          toast({
            title: 'لم يتم الاستيراد',
            description: 'فشل استيراد كل الصفوف',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'خطأ',
          description: data.error || 'فشل الاستيراد',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: 'خطأ',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      {/* رأس */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">استيراد البيانات</h2>
          <p className="text-sm text-muted-foreground">استيراد الطلاب والدفعات والحضور من ملفات Excel</p>
        </div>
      </div>

      {/* اختيار النوع */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {types.map(t => {
          const Icon = t.icon;
          const isActive = activeType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setActiveType(t.id); setResult(null); }}
              className={`p-4 rounded-xl border-2 text-right transition-all ${
                isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
              } ${t.color}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-6 h-6" />
                {isActive && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <h3 className="font-semibold text-lg">{t.label}</h3>
              <p className="text-xs opacity-80">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* منطقة الرفع */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>رفع ملف {types.find(t => t.id === activeType)?.label}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(activeType)}
            >
              <Download className="w-4 h-4 ml-2" />
              تحميل القالب
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                <p className="font-medium">جاري الاستيراد...</p>
                <p className="text-xs text-muted-foreground">قد يستغرق هذا عدة ثوانٍ</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="font-medium text-lg">اضغط لاختيار ملف أو اسحبه هنا</p>
                <p className="text-xs text-muted-foreground">
                  الصيغ المدعومة: XLSX, XLS, CSV (الحد الأقصى 5 ميغابايت)
                </p>
              </div>
            )}
          </div>

          {/* النتيجة */}
          {result && (
            <div className="mt-6 space-y-4">
              {/* ملخص */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">إجمالي</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.success}</p>
                  <p className="text-xs text-muted-foreground">ناجح</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">فاشل</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {result.total > 0 ? Math.round((result.success / result.total) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">نسبة النجاح</p>
                </div>
              </div>

              {/* رسالة */}
              {result.success > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    تم استيراد <strong>{result.success}</strong> سجل بنجاح!
                    {result.skipped > 0 && ` (${result.skipped} فشل)`}
                  </AlertDescription>
                </Alert>
              )}

              {/* الأخطاء */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    الأخطاء ({result.errorsCount})
                    {result.errorsCount > result.errors.length && (
                      <span className="text-xs text-muted-foreground">
                        (يتم عرض أول {result.errors.length} فقط)
                      </span>
                    )}
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {result.errors.map((e, i) => (
                      <div key={i} className="p-2 rounded border bg-red-50/50 text-sm">
                        <Badge variant="destructive" className="ml-2">صف {e.row}</Badge>
                        {e.name && <span className="font-medium ml-1">{e.name}: </span>}
                        <span className="text-muted-foreground">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* تعليمات */}
      <Card>
        <CardHeader><CardTitle className="text-lg">📖 تعليمات الاستيراد</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
              حمّل القالب
            </h4>
            <p className="text-muted-foreground mr-8">اضغط "تحميل القالب" للحصول على ملف Excel فارغ بالأعمدة الصحيحة.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
              املأ البيانات
            </h4>
            <p className="text-muted-foreground mr-8">افتح الملف، احذف صف المثال، أدخل بياناتك. احتفظ بأسماء الأعمدة كما هي.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
              ارفع الملف
            </h4>
            <p className="text-muted-foreground mr-8">اسحب الملف أو اضغط لاختياره. سيتم استيراد البيانات تلقائياً.</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">4</span>
              راجع النتيجة
            </h4>
            <p className="text-muted-foreground mr-8">سترى ملخصاً بالنجاح/الفشل + قائمة الأخطاء إن وُجدت.</p>
          </div>

          <Alert className="mt-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>تنبيهات مهمة:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>التواريخ بصيغة: YYYY-MM-DD (مثال: 2026-07-04)</li>
                <li>الأرقام بدون مسافات أو رموز</li>
                <li>أسماء الأقسام/المستويات/التخصصات يجب أن تطابق الموجود في النظام</li>
                <li>للدفعات: استيراد يبحث عن الطالب بالاسم أو الرقم الجامعي</li>
                <li>للحضور: الأستاذ والطالب اختياريان (يُبحث عنهما بالاسم)</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
