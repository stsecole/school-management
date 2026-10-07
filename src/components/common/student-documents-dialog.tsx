'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Upload, FileText, Trash2, Download, Loader2, CheckCircle2, AlertCircle, FileCheck2, Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  name: string;
  studentNumber: string | null;
  docSchoolCert: boolean;
  docMedicalCert: boolean;
  docBirthCert: boolean;
  docIdCard: boolean;
}

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: Student | null;
  onUpdated?: () => void; // callback to refresh the parent list
}

/**
 * Document types that map to both Student.docXxx boolean fields and Document.type
 */
const DOC_TYPES = [
  { key: 'school_cert', label: 'الشهادة المدرسية', docField: 'docSchoolCert', color: 'bg-emerald-500', required: true },
  { key: 'birth_cert',  label: 'شهادة الميلاد',    docField: 'docBirthCert',  color: 'bg-blue-500',    required: true },
  { key: 'id_card',     label: 'بطاقة التعريف',    docField: 'docIdCard',     color: 'bg-purple-500',  required: true },
  { key: 'medical',     label: 'الشهادة الطبية',   docField: 'docMedicalCert', color: 'bg-red-500',     required: true },
] as const;

/**
 * StudentDocumentsDialog
 *
 * Opens when the user clicks the "ملف ناقص/مكتمل" badge on a student row.
 * Allows uploading 4 document types (school cert, birth cert, ID card, medical cert),
 * lists previously uploaded documents of these types, and toggles the matching
 * Student.docXxx boolean fields. Documents are saved to the same Document table
 * used by the Archive section, so they appear there automatically.
 */
export function StudentDocumentsDialog({ open, onOpenChange, student, onUpdated }: Props) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  // Load existing documents whenever the dialog opens for a new student
  useEffect(() => {
    if (!open || !student) return;
    setLoading(true);
    fetch(`/api/documents?studentId=${student.id}`)
      .then(r => r.json())
      .then(d => {
        // Filter only the 4 types we manage here
        const wanted = DOC_TYPES.map(t => t.key);
        setDocs((d.documents || []).filter((doc: DocumentRow) => wanted.includes(doc.type)));
      })
      .catch(() => toast({ title: 'خطأ', description: 'تعذر تحميل الوثائق', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, student, toast]);

  if (!student) return null;

  const handleUpload = async (docType: string, file: File) => {
    if (!student) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الملف كبير جداً (حد أقصى 10 ميجا)', variant: 'destructive' });
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون صورة أو PDF', variant: 'destructive' });
      return;
    }

    setUploadingType(docType);
    try {
      // 1. Upload the file via multipart/form-data
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', DOC_TYPES.find(t => t.key === docType)?.label || docType);
      fd.append('type', docType);
      fd.append('studentId', student.id);
      fd.append('studentName', student.name);

      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'خطأ', description: data.error || 'فشل الرفع', variant: 'destructive' });
        return;
      }

      // 2. Toggle the matching Student.docXxx boolean to true
      const docTypeObj = DOC_TYPES.find(t => t.key === docType);
      if (docTypeObj) {
        const updateRes = await fetch(`/api/students/${student.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [docTypeObj.docField]: true }),
        });
        if (!updateRes.ok) {
          toast({ title: 'تنبيه', description: 'تم رفع الملف لكن لم يتم تحديث حالة الطالب' });
        }
      }

      // 3. Refresh local list + parent list
      toast({ title: 'تم', description: 'تم رفع الوثيقة بنجاح' });
      if (onUpdated) onUpdated();
      // Re-fetch documents
      const fresh = await fetch(`/api/documents?studentId=${student.id}`).then(r => r.json());
      const wanted = DOC_TYPES.map(t => t.key);
      setDocs((fresh.documents || []).filter((doc: DocumentRow) => wanted.includes(doc.type)));
    } catch (err) {
      toast({ title: 'خطأ', description: 'تعذر رفع الملف', variant: 'destructive' });
    } finally {
      setUploadingType(null);
      // Reset file input
      if (fileInputRefs.current[docType]) fileInputRefs.current[docType]!.value = '';
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    if (!student) return;
    if (!confirm(`حذف الوثيقة "${doc.title}"؟`)) return;
    try {
      const res = await fetch(`/api/documents?id=${doc.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' });
        return;
      }
      // Toggle the matching boolean off (only if no other docs of same type exist)
      const docTypeObj = DOC_TYPES.find(t => t.key === doc.type);
      if (docTypeObj) {
        await fetch(`/api/students/${student.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [docTypeObj.docField]: false }),
        });
      }
      toast({ title: 'تم', description: 'تم حذف الوثيقة' });
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      if (onUpdated) onUpdated();
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الحذف', variant: 'destructive' });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const completedCount = DOC_TYPES.filter(t => (student as any)[t.docField]).length;
  const isComplete = completedCount === DOC_TYPES.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-primary" />
              وثائق الطالب
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {student.name} {student.studentNumber ? `(${student.studentNumber})` : ''}
            </span>
            <Badge variant={isComplete ? 'default' : 'destructive'}>
              {isComplete ? (
                <><CheckCircle2 className="w-3 h-3 ml-1" /> ملف مكتمل</>
              ) : (
                <><AlertCircle className="w-3 h-3 ml-1" /> {completedCount}/{DOC_TYPES.length} مكتمل</>
              )}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              جاري تحميل الوثائق...
            </div>
          ) : (
            DOC_TYPES.map(docType => {
              const isUploaded = (student as any)[docType.docField];
              const existingDocs = docs.filter(d => d.type === docType.key);
              const isUploading = uploadingType === docType.key;

              return (
                <div
                  key={docType.key}
                  className={`rounded-lg border-2 p-3 transition-colors ${
                    isUploaded ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${docType.color}`} />
                      <span className="font-medium text-sm">{docType.label}</span>
                      {isUploaded ? (
                        <Badge variant="default" className="text-xs bg-emerald-600">
                          <CheckCircle2 className="w-3 h-3 ml-1" /> مرفوع
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 ml-1" /> مطلوب
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isUploaded ? 'outline' : 'default'}
                      disabled={isUploading}
                      onClick={() => fileInputRefs.current[docType.key]?.click()}
                    >
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الرفع...</>
                      ) : (
                        <><Upload className="w-4 h-4 ml-2" /> {isUploaded ? 'استبدال' : 'رفع'}</>
                      )}
                    </Button>
                    <input
                      ref={el => { fileInputRefs.current[docType.key] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(docType.key, f);
                      }}
                    />
                  </div>

                  {/* Existing documents of this type */}
                  {existingDocs.length > 0 && (
                    <div className="space-y-1.5">
                      {existingDocs.map(d => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 p-2 bg-white rounded border text-xs"
                        >
                          <FileText className={`w-4 h-4 flex-shrink-0 ${
                            d.mimeType === 'application/pdf' ? 'text-red-600' : 'text-blue-600'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{d.fileName}</div>
                            <div className="text-muted-foreground num">
                              {formatSize(d.fileSize)} • {new Date(d.createdAt).toLocaleDateString('ar')}
                            </div>
                          </div>
                          <a
                            href={d.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="عرض"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                          </a>
                          <a
                            href={d.filePath}
                            download={d.fileName}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="تحميل"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                          </a>
                          <button
                            onClick={() => handleDelete(d)}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Help banner */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">ملاحظات:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>الملفات المرفوعة تظهر تلقائياً في قسم الأرشيف</li>
              <li>الأنواع المدعومة: صور (JPG, PNG, WEBP) و PDF</li>
              <li>الحد الأقصى لحجم الملف: 10 ميجا</li>
              <li>عند رفع وثيقة، يتم تحديث حالة الملف تلقائياً</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
