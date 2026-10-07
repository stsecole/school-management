'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Edit, Trash2, Download, Clock, Timer, AlertCircle, Users, CheckCircle2, Loader2, ScanLine, Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsQR from 'jsqr';

interface Attendance {
  id: string;
  date: string;
  courseName: string;
  level: string | null;
  startTime: string | null;
  endTime: string | null;
  timeSlot: string | null;
  teacherName: string | null;
  totalCount: number;
  maleCount: number;
  femaleCount: number;
  durationMinutes: number;
  unpaidCount: number;
  notes: string | null;
}

interface Teacher { id: string; name: string; }
interface Course { id: string; name: string; }
interface Level { id: string; name: string; }
interface Department { id: string; name: string; }
interface Specialization { id: string; name: string; departmentId: string; }
interface Student { id: string; name: string; gender: string | null; studentNumber: string | null; department?: { name: string } | null; }
interface ScannedStudent { id: string; name: string; gender: string | null; studentNumber: string | null; department?: string | null; scannedAt: number; }

const empty = {
  date: new Date().toISOString().split('T')[0],
  courseId: '', courseName: '', level: '',
  departmentId: '', specializationId: '',
  startTime: '08:00', endTime: '10:00',
  teacherId: '', teacherName: '',
  totalCount: '0', maleCount: '0', femaleCount: '0',
  unpaidCount: '0', notes: '',
};

/** Parse "HH:MM" → minutes since midnight. Returns null if invalid. */
function parseTimeToMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Compute duration in minutes between start and end. Handles overnight. */
function computeDurationMinutes(start: string, end: string): number {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === null || e === null) return 0;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/** Format minutes as "Xh Ym" or "Ym" or "Xh". */
function formatDuration(mins: number): string {
  if (mins <= 0) return '0د';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
}

/** Convert minutes to decimal hours (e.g. 90 → 1.5). */
function toHours(mins: number): number {
  return Math.round((mins / 60) * 100) / 100;
}

export function AttendanceSection() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState<any>(empty);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [dialogSpecializations, setDialogSpecializations] = useState<Specialization[]>([]);
  const [bulkDept, setBulkDept] = useState('all');
  const [bulkSpec, setBulkSpec] = useState('all');

  // ===== QR scanning state (inside single attendance dialog) =====
  const [scanning, setScanning] = useState(false);
  const [scannedStudents, setScannedStudents] = useState<ScannedStudent[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanFeedback, setLastScanFeedback] = useState<{ type: 'success' | 'duplicate' | 'error'; message: string } | null>(null);
  // ===== Manual entry fallback (when camera not available) =====
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualStudentSearch, setManualStudentSearch] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanIdRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [bulkStudents, setBulkStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [bulkForm, setBulkForm] = useState({
    date: new Date().toISOString().split('T')[0],
    level: '', startTime: '08:00', endTime: '10:00',
    teacherId: '', notes: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [bulkSearch, setBulkSearch] = useState('');
  const { toast } = useToast();

  // Compute duration live as the user types start/end times
  const liveDuration = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return 0;
    return computeDurationMinutes(formData.startTime, formData.endTime);
  }, [formData.startTime, formData.endTime]);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterTeacher !== 'all') params.set('teacherId', filterTeacher);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await fetch(`/api/attendance?${params.toString()}`);
    const data = await res.json();
    setAttendances(data.attendances || []);
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/teachers').then(r => r.json()).then(d => setTeachers(d.teachers || []));
    fetch('/api/courses').then(r => r.json()).then(d => setCourses(d.courses || []));
    fetch('/api/levels').then(r => r.json()).then(d => setLevels(d.levels || []));
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d.departments || []));
  }, []);
  useEffect(() => { load(); }, [search, filterTeacher, startDate, endDate]);

  // ===== Offline bulk attendance sync (auto-sync on mount) =====
  useEffect(() => {
    const OFFLINE_QUEUE_KEY = 'attendance_offline_bulk_queue';
    const syncOffline = async () => {
      try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (!raw) return;
        const queue = JSON.parse(raw);
        if (!Array.isArray(queue) || queue.length === 0) return;
        const failed: any[] = [];
        let synced = 0;
        for (const item of queue) {
          try {
            const url = item.editingId ? `/api/attendance/${item.editingId}` : '/api/attendance/bulk';
            const method = item.editingId ? 'PUT' : 'POST';
            const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            if (res.ok) {
              synced++;
            } else {
              failed.push(item);
            }
          } catch {
            // Network still down — keep all remaining
            failed.push(item);
            break;
          }
        }
        if (failed.length > 0) {
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
        } else {
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
        }
        if (synced > 0) {
          toast({
            title: 'تمت المزامنة',
            description: `تمت مزامنة ${synced} سجل حضور محفوظ offline`,
          });
          load();
        }
      } catch {}
    };
    // Only sync if we're online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncOffline();
    }
    // Also listen for online event
    const handleOnline = () => syncOffline();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [toast]);

  // ===== Bulk attendance =====
  const loadBulkStudents = async (deptId: string, specId: string = 'all') => {
    const params = new URLSearchParams();
    if (deptId && deptId !== 'all') params.set('departmentId', deptId);
    if (specId && specId !== 'all') params.set('specializationId', specId);
    params.set('limit', '500');
    const res = await fetch(`/api/students?${params.toString()}`);
    const data = await res.json();
    setBulkStudents(data.students || []);
    setSelectedStudentIds(new Set());
  };

  // Load specializations for a department
  const loadSpecializations = async (deptId: string) => {
    if (!deptId || deptId === 'all') {
      setSpecializations([]);
      return;
    }
    try {
      const res = await fetch(`/api/specializations?departmentId=${deptId}`);
      const data = await res.json();
      setSpecializations(data.specializations || []);
    } catch {
      setSpecializations([]);
    }
  };

  // Handle department change in bulk dialog
  const handleBulkDeptChange = (deptId: string) => {
    setBulkDept(deptId);
    setBulkSpec('all'); // reset specialization
    loadSpecializations(deptId);
    loadBulkStudents(deptId, 'all');
  };

  // Handle specialization change in bulk dialog
  const handleBulkSpecChange = (specId: string) => {
    setBulkSpec(specId);
    loadBulkStudents(bulkDept, specId);
  };

  const handleOpenBulk = () => {
    setBulkOpen(true);
    setBulkResult(null);
    setBulkSearch('');
    setBulkDept('all');
    setBulkSpec('all');
    setSpecializations([]);
    loadBulkStudents('all');
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const visible = filteredBulkStudents;
    const allSelected = visible.every(s => selectedStudentIds.has(s.id));
    if (allSelected) {
      setSelectedStudentIds(prev => {
        const next = new Set(prev);
        visible.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedStudentIds(prev => {
        const next = new Set(prev);
        visible.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const filteredBulkStudents = bulkStudents.filter(s => {
    if (!bulkSearch.trim()) return true;
    const q = bulkSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q);
  });

  const handleBulkSave = async () => {
    if (selectedStudentIds.size === 0) {
      toast({ title: 'تنبيه', description: 'اختر طالباً واحداً على الأقل', variant: 'destructive' });
      return;
    }
    if (!bulkForm.startTime || !bulkForm.endTime) {
      toast({ title: 'تنبيه', description: 'وقت البداية والنهاية مطلوبان', variant: 'destructive' });
      return;
    }
    // Build courseName from department + specialization
    const deptName = departments.find(d => d.id === bulkDept)?.name || '';
    const specName = specializations.find(s => s.id === bulkSpec)?.name || '';
    let courseName = 'حضور جماعي';
    if (deptName && specName) courseName = `${deptName} - ${specName}`;
    else if (deptName) courseName = deptName;
    else if (specName) courseName = specName;

    setBulkSaving(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bulkForm,
          courseName,
          departmentId: bulkDept !== 'all' ? bulkDept : undefined,
          specializationId: bulkSpec !== 'all' ? bulkSpec : undefined,
          studentIds: Array.from(selectedStudentIds),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBulkResult(data.stats);
        toast({ title: 'تم', description: `تم تسجيل حضور ${data.stats.total} طالب` });
        load();
      } else {
        toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ ...empty, date: new Date().toISOString().split('T')[0] });
    setDialogSpecializations([]);
    setScannedStudents([]);
    setScanning(false);
    setScanError(null);
    setLastScanFeedback(null);
    setManualStudentId('');
    setManualStudentSearch('');
    setManualSearchResults([]);
    setDialogOpen(true);
  };

  // Load specializations for single dialog when department changes
  const handleDialogDeptChange = async (deptId: string) => {
    setFormData({ ...formData, departmentId: deptId, specializationId: '' });
    if (!deptId) {
      setDialogSpecializations([]);
      return;
    }
    try {
      const res = await fetch(`/api/specializations?departmentId=${deptId}`);
      const data = await res.json();
      setDialogSpecializations(data.specializations || []);
    } catch {
      setDialogSpecializations([]);
    }
  };

  const handleDialogSpecChange = (specId: string) => {
    setFormData({ ...formData, specializationId: specId });
  };

  // ===== QR scan functions for single attendance dialog =====
  const playScanBeep = useCallback((type: 'success' | 'duplicate' | 'error') => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.2, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.02);
      };
      if (type === 'success') { playTone(880, 0, 0.12); playTone(1320, 0.15, 0.15); }
      else if (type === 'duplicate') { playTone(440, 0, 0.25); }
      else { playTone(220, 0, 0.4); }
    } catch {}
  }, []);

  const startQrScan = async () => {
    setScanError(null);
    setLastScanFeedback(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError('الكاميرا غير مدعومة في هذا المتصفح. استخدم HTTPS أو localhost.');
      return;
    }
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanIntervalRef.current = setInterval(scanQrFrame, 200);
      }
    } catch (e: any) {
      const errName = e?.name || '';
      let msg = 'تعذر الوصول للكاميرا: ' + (e.message || errName);
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        msg = 'تم رفض إذن الكاميرا. اضغط أيقونة الكاميرا في شريط العنوان واختر "السماح".';
      } else if (errName === 'NotFoundError') {
        msg = 'لا توجد كاميرا متصلة بهذا الجهاز.';
      } else if (errName === 'NotReadableError') {
        msg = 'الكاميرا مستخدمة من تطبيق آخر. أغلق التطبيقات الأخرى وأعد المحاولة.';
      }
      setScanError(msg);
      setScanning(false);
    }
  };

  const stopQrScan = useCallback(() => {
    setScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const scanQrFrame = useCallback(() => {
    if (!scanning) return;
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      const scannedId = code.data.trim();
      const now = Date.now();
      // Prevent re-scanning the same QR within 3 seconds
      if (lastScanIdRef.current === scannedId && (now - lastScanTimeRef.current) < 3000) {
        return;
      }
      lastScanIdRef.current = scannedId;
      lastScanTimeRef.current = now;
      submitScannedStudent(scannedId);
    }
  }, [scanning]);

  const submitScannedStudent = async (studentId: string) => {
    try {
      const trimmedId = studentId.trim();
      if (!trimmedId) return;

      // Check if already in scanned list (duplicate by id OR studentNumber)
      const existingByNumber = scannedStudents.find(s => s.studentNumber === trimmedId);
      if (existingByNumber) {
        setLastScanFeedback({
          type: 'duplicate',
          message: `${existingByNumber.name} مسجّل بالفعل في القائمة`,
        });
        playScanBeep('duplicate');
        return;
      }
      // Note: if scannedStudents already has an entry with this id, also duplicate
      // (can happen when QR code contains the id but student was already added)
      if (scannedStudents.some(s => s.id === trimmedId)) {
        const dup = scannedStudents.find(s => s.id === trimmedId);
        setLastScanFeedback({
          type: 'duplicate',
          message: `${dup?.name || 'الطالب'} مسجّل بالفعل في القائمة`,
        });
        playScanBeep('duplicate');
        return;
      }

      // Fetch student details using GET with search (now supports exact id lookup)
      const res = await fetch(`/api/students?search=${encodeURIComponent(trimmedId)}&limit=20`);
      let student: any = null;
      if (res.ok) {
        const data = await res.json();
        const all = data.students || [];
        // Prefer exact match on id or studentNumber
        student = all.find((s: any) => s.id === trimmedId || s.studentNumber === trimmedId) || all[0] || null;
      }

      if (!student) {
        setLastScanFeedback({
          type: 'error',
          message: `لم يتم العثور على طالب بالمعرف: ${trimmedId}`,
        });
        playScanBeep('error');
        return;
      }

      // Check duplicate by fetched id (in case scanned id matched studentNumber but resolved to existing student)
      if (scannedStudents.some(s => s.id === student.id)) {
        const dup = scannedStudents.find(s => s.id === student.id);
        setLastScanFeedback({
          type: 'duplicate',
          message: `${dup?.name || student.name} مسجّل بالفعل في القائمة`,
        });
        playScanBeep('duplicate');
        return;
      }

      const newEntry: ScannedStudent = {
        id: student.id,
        name: student.name,
        gender: student.gender || null,
        studentNumber: student.studentNumber || null,
        department: student.department?.name || null,
        scannedAt: Date.now(),
      };
      setScannedStudents(prev => [...prev, newEntry]);
      setLastScanFeedback({
        type: 'success',
        message: `تمت إضافة: ${student.name}`,
      });
      playScanBeep('success');
    } catch (e: any) {
      setLastScanFeedback({
        type: 'error',
        message: 'خطأ في الاتصال بالخادم',
      });
      playScanBeep('error');
    }
  };

  const removeScannedStudent = (id: string) => {
    setScannedStudents(prev => prev.filter(s => s.id !== id));
  };

  const clearScannedStudents = () => {
    if (!confirm('مسح كل الطلاب المسحوبين؟')) return;
    setScannedStudents([]);
    setLastScanFeedback(null);
  };

  // ===== Manual student ID entry (fallback for camera permission) =====
  const handleManualAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const id = manualStudentId.trim();
    if (!id) return;
    setManualStudentId('');
    await submitScannedStudent(id);
  };

  // ===== Student search for manual selection =====
  useEffect(() => {
    if (!manualStudentSearch.trim() || manualStudentSearch.trim().length < 2) {
      setManualSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(manualStudentSearch)}&limit=15`);
        const data = await res.json();
        setManualSearchResults(data.students || []);
      } catch {
        setManualSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualStudentSearch]);

  // ===== Image upload QR (alternative to camera) =====
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastScanFeedback(null);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        submitScannedStudent(code.data.trim());
      } else {
        setLastScanFeedback({
          type: 'error',
          message: 'لم يتم العثور على QR Code في الصورة. تأكد من وضوح الصورة.',
        });
        playScanBeep('error');
      }
    };
    img.onerror = () => {
      setLastScanFeedback({ type: 'error', message: 'تعذر قراءة الصورة' });
    };
    img.src = URL.createObjectURL(file);
    // Clear input so same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ===== Detect non-secure context (HTTP) =====
  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'https:'
  );

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Stop scanning when dialog closes
  useEffect(() => {
    if (!dialogOpen && scanning) {
      stopQrScan();
    }
  }, [dialogOpen, scanning, stopQrScan]);

  const handleOpenEdit = async (a: Attendance) => {
    setEditing(a);
    // Strip the [QR:...] prefix from notes for display (kept internally for student list)
    const cleanNotes = (a.notes || '').replace(/\[QR:[^\]]*\]\s*/g, '');
    setFormData({
      date: a.date.split('T')[0],
      courseId: '', courseName: a.courseName, level: a.level || '',
      departmentId: '', specializationId: '',
      startTime: a.startTime || '08:00',
      endTime: a.endTime || '10:00',
      teacherId: '', teacherName: a.teacherName || '',
      totalCount: String(a.totalCount), maleCount: String(a.maleCount),
      femaleCount: String(a.femaleCount),
      unpaidCount: String(a.unpaidCount), notes: cleanNotes,
    });
    setDialogSpecializations([]);
    setScannedStudents([]);
    setScanning(false);
    setScanError(null);
    setLastScanFeedback(null);
    setManualStudentId('');
    setManualStudentSearch('');
    setManualSearchResults([]);

    // ===== Parse notes to extract previously-saved student IDs =====
    // Format: "[QR:id1,id2,id3] summary text"
    const notesStr = a.notes || '';
    const qrMatch = notesStr.match(/\[QR:([^\]]+)\]/);
    if (qrMatch) {
      const ids = qrMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        try {
          // Fetch student details in parallel
          const fetched = await Promise.all(
            ids.map(async id => {
              try {
                const res = await fetch(`/api/students?search=${encodeURIComponent(id)}&limit=1`);
                if (!res.ok) return null;
                const data = await res.json();
                const candidates = (data.students || []).filter((s: any) =>
                  s.id === id || s.studentNumber === id
                );
                return candidates[0] || (data.students || [])[0] || null;
              } catch { return null; }
            })
          );
          const loaded: ScannedStudent[] = fetched
            .filter((s: any) => s)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              gender: s.gender || null,
              studentNumber: s.studentNumber || null,
              department: s.department?.name || null,
              scannedAt: Date.now(),
            }));
          setScannedStudents(loaded);
        } catch {}
      }
    }

    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validate required time fields
    if (!formData.startTime || !formData.endTime) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال وقت البداية ووقت النهاية (إجباري)', variant: 'destructive' });
      return;
    }
    if (parseTimeToMinutes(formData.startTime) === null) {
      toast({ title: 'خطأ', description: 'صيغة وقت البداية غير صحيحة. استخدم HH:MM', variant: 'destructive' });
      return;
    }
    if (parseTimeToMinutes(formData.endTime) === null) {
      toast({ title: 'خطأ', description: 'صيغة وقت النهاية غير صحيحة. استخدم HH:MM', variant: 'destructive' });
      return;
    }
    if (liveDuration <= 0) {
      toast({ title: 'خطأ', description: 'وقت النهاية يجب أن يكون بعد وقت البداية', variant: 'destructive' });
      return;
    }

    // Build courseName from department + specialization
    const deptName = departments.find(d => d.id === formData.departmentId)?.name || '';
    const specName = dialogSpecializations.find(s => s.id === formData.specializationId)?.name || '';
    let builtCourseName = formData.courseName || '';
    if (deptName && specName) builtCourseName = `${deptName} - ${specName}`;
    else if (deptName) builtCourseName = deptName;
    else if (specName) builtCourseName = specName;
    else if (!builtCourseName) builtCourseName = 'حضور';

    // ===== If QR-scanned students exist =====
    if (scannedStudents.length > 0) {
      const total = scannedStudents.length;
      const male = scannedStudents.filter(s => s.gender === 'ذكر').length;
      const female = scannedStudents.filter(s => s.gender === 'أنثى').length;
      const studentIds = scannedStudents.map(s => s.id);
      // Store student IDs in notes for future editing: "[QR:id1,id2,...] summary"
      // Strip any existing [QR:...] prefix from user-entered notes first
      const cleanNotes = (formData.notes || '').replace(/\[QR:[^\]]*\]\s*/g, '');
      const summary = cleanNotes || `حضور بمسح QR - ${total} طالب (${male} ذكر، ${female} أنثى)`;
      const notesWithIds = `[QR:${studentIds.join(',')}] ${summary}`;

      // Stop camera if still running
      stopQrScan();

      try {
        if (editing) {
          // ===== Update existing attendance record with new student list =====
          const res = await fetch(`/api/attendance/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: formData.date,
              courseName: builtCourseName,
              level: formData.level || '',
              startTime: formData.startTime,
              endTime: formData.endTime,
              teacherId: formData.teacherId || '',
              teacherName: formData.teacherName || '',
              totalCount: String(total),
              maleCount: String(male),
              femaleCount: String(female),
              unpaidCount: formData.unpaidCount || '0',
              notes: notesWithIds,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            toast({ title: 'خطأ', description: data.error || 'فشل التحديث', variant: 'destructive' });
            return;
          }
          toast({
            title: 'تم',
            description: `تم تحديث الحضور - ${total} طالب (${male} ذكر، ${female} أنثى)`,
          });
          setDialogOpen(false);
          setScannedStudents([]);
          load();
          return;
        } else {
          // ===== Create new attendance record with student list =====
          const res = await fetch('/api/attendance/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: formData.date,
              courseName: builtCourseName,
              level: formData.level || null,
              startTime: formData.startTime,
              endTime: formData.endTime,
              teacherId: formData.teacherId || null,
              departmentId: formData.departmentId || undefined,
              specializationId: formData.specializationId || undefined,
              studentIds,
              notes: notesWithIds,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
            return;
          }
          toast({
            title: 'تم',
            description: `تم تسجيل حضور ${data.stats.total} طالب (${data.stats.male} ذكر، ${data.stats.female} أنثى)`,
          });
          setDialogOpen(false);
          setScannedStudents([]);
          load();
          return;
        }
      } catch (e: any) {
        // ===== Offline mode: save attendance to localStorage for later sync =====
        const OFFLINE_QUEUE_KEY = 'attendance_offline_bulk_queue';
        try {
          const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
          const queue = raw ? JSON.parse(raw) : [];
          const item = {
            id: `offline-${Date.now()}`,
            editingId: editing?.id || null,
            date: formData.date,
            courseName: builtCourseName,
            level: formData.level || '',
            startTime: formData.startTime,
            endTime: formData.endTime,
            teacherId: formData.teacherId || '',
            teacherName: formData.teacherName || '',
            departmentId: formData.departmentId || '',
            specializationId: formData.specializationId || '',
            studentIds,
            notes: notesWithIds,
            total,
            male,
            female,
            savedAt: new Date().toISOString(),
          };
          queue.push(item);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
          toast({
            title: 'محفوظ offline',
            description: `لا يوجد اتصال. تم حفظ الحضور (${total} طالب) محلياً وستُزامن عند عودة الاتصال.`,
          });
          setDialogOpen(false);
          setScannedStudents([]);
        } catch (storageErr) {
          toast({
            title: 'خطأ',
            description: 'تعذر الاتصال بالخادم ولا يمكن الحفظ محلياً (الذاكرة ممتلئة؟)',
            variant: 'destructive',
          });
        }
        return;
      }
    }

    // ===== Otherwise, use the single attendance API =====
    const payload = {
      ...formData,
      courseName: builtCourseName,
      // Remove helper fields not in API schema
      departmentId: undefined,
      specializationId: undefined,
    };

    const url = editing ? `/api/attendance/${editing.id}` : '/api/attendance';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: 'خطأ', description: data.error || 'فشل الحفظ', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم', description: editing ? 'تم التحديث' : 'تمت الإضافة' });
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (a: Attendance) => {
    if (!confirm('حذف سجل الحضور؟')) return;
    const res = await fetch(`/api/attendance/${a.id}`, { method: 'DELETE' });
    if (res.ok) { toast({ title: 'تم', description: 'تم الحذف' }); load(); }
  };

  // Aggregate stats
  const totalStudents = attendances.reduce((s, a) => s + a.totalCount, 0);
  const totalMale = attendances.reduce((s, a) => s + a.maleCount, 0);
  const totalFemale = attendances.reduce((s, a) => s + a.femaleCount, 0);
  const totalDurationMinutes = attendances.reduce((s, a) => s + (a.durationMinutes || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">قوائم الحضور</h2>
          <p className="text-muted-foreground text-sm">
            إجمالي: {attendances.length} سجل • {totalStudents} حضور ({totalMale} ذكر، {totalFemale} أنثى) • المدة: <span className="num font-medium text-primary">{formatDuration(totalDurationMinutes)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/attendance', '_blank')}>
            <Download className="w-4 h-4 ml-2" /> تصدير
          </Button>
          <Button onClick={handleOpenAdd}><Plus className="w-4 h-4 ml-2" /> تسجيل حضور</Button>
          <Button variant="outline" onClick={handleOpenBulk} className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Users className="w-4 h-4 ml-2" /> حضور جماعي
          </Button>
          <Button variant="outline" onClick={() => window.open('/scan', '_blank')} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <ScanLine className="w-4 h-4 ml-2" /> مسح QR
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger><SelectValue placeholder="كل الأساتذة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأساتذة</SelectItem>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" placeholder="من تاريخ" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" placeholder="إلى تاريخ" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: '960px' }}>
              {/* Header */}
              <div
                className="grid items-center gap-2 px-3 py-2 border-b bg-muted/50 font-medium text-sm"
                style={{ gridTemplateColumns: '40px 110px 1fr 100px 150px 130px 90px 70px 70px 70px' }}
              >
                <div className="text-center">#</div>
                <div className="text-center">التاريخ</div>
                <div className="text-center">المادة</div>
                <div className="text-center">المستوى</div>
                <div className="text-center">التوقيت</div>
                <div className="text-center">الأستاذ</div>
                <div className="text-center">المدة</div>
                <div className="text-center">حضور</div>
                <div className="text-center">ذكر</div>
                <div className="text-center">أنثى</div>
              </div>

              {/* Body */}
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : attendances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد سجلات</div>
              ) : attendances.map((a, i) => (
                <div
                  key={a.id}
                  className="grid items-center gap-2 px-3 py-2 border-b hover:bg-muted/50 cursor-pointer text-sm"
                  onClick={() => handleOpenEdit(a)}
                  style={{ gridTemplateColumns: '40px 110px 1fr 100px 150px 130px 90px 70px 70px 70px' }}
                >
                  <div className="text-center num text-muted-foreground">{i + 1}</div>
                  <div className="text-center num text-sm whitespace-nowrap">{
                    (() => {
                      const d = new Date(a.date);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                    })()
                  }</div>
                  <div className="text-right font-medium truncate" title={a.courseName}>{a.courseName}</div>
                  <div className="text-right text-sm truncate" title={a.level || ''}>{a.level || '-'}</div>
                  <div className="text-center whitespace-nowrap">
                    {a.startTime && a.endTime ? (
                      <Badge variant="outline" className="num font-mono">
                        <Clock className="w-3 h-3 ml-1" />
                        {a.startTime} ← {a.endTime}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                  <div className="text-right text-sm truncate" title={a.teacherName || ''}>{a.teacherName || '-'}</div>
                  <div className="text-center whitespace-nowrap">
                    {a.durationMinutes > 0 ? (
                      <Badge variant="secondary" className="num">
                        {formatDuration(a.durationMinutes)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                  <div className="text-center num font-bold">{a.totalCount}</div>
                  <div className="text-center num">{a.maleCount}</div>
                  <div className="text-center num">{a.femaleCount}</div>
                </div>
              ))}

              {/* Footer totals */}
              {attendances.length > 0 && (
                <div
                  className="grid items-center gap-2 px-3 py-3 border-t-2 bg-muted/30 font-medium text-sm"
                  style={{ gridTemplateColumns: '40px 110px 1fr 100px 150px 130px 90px 70px 70px 70px' }}
                >
                  <div className="text-left" style={{ gridColumn: '1 / span 7' }}>
                    الإجمالي ({attendances.length} سجل):
                  </div>
                  <div className="text-center num font-bold">{totalStudents}</div>
                  <div className="text-center num">{totalMale}</div>
                  <div className="text-center num">{totalFemale}</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل سجل الحضور' : 'تسجيل حضور جديد'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} dir="ltr" />
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

            {/* Time fields - required, with live duration calculation */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> وقت البداية <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                dir="ltr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> وقت النهاية <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                dir="ltr"
                required
              />
            </div>

            {/* Live duration display */}
            <div className="md:col-span-2">
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                liveDuration > 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Timer className={`w-5 h-5 ${liveDuration > 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      المدة المحسوبة:
                    </p>
                    <p className={`text-lg font-bold num ${liveDuration > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {liveDuration > 0 ? formatDuration(liveDuration) : '—'}
                    </p>
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                  <p>بالساعات العشرية: <span className="num font-medium">{toHours(liveDuration)} س</span></p>
                  <p>بالدقائق: <span className="num font-medium">{liveDuration} د</span></p>
                </div>
              </div>
              {liveDuration === 0 && formData.startTime && formData.endTime && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> تأكد من أن وقت النهاية بعد وقت البداية
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={formData.departmentId || 'none'}
                onValueChange={(v) => handleDialogDeptChange(v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون قسم —</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                التخصص {!formData.departmentId && (
                  <span className="text-muted-foreground text-xs">(اختر القسم أولاً)</span>
                )}
                {formData.departmentId && dialogSpecializations.length === 0 && (
                  <span className="text-muted-foreground text-xs">(لا يوجد تخصصات)</span>
                )}
              </Label>
              <Select
                value={formData.specializationId || 'none'}
                onValueChange={(v) => handleDialogSpecChange(v === 'none' ? '' : v)}
                disabled={!formData.departmentId || dialogSpecializations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !formData.departmentId
                      ? 'اختر القسم أولاً'
                      : dialogSpecializations.length === 0
                        ? 'لا يوجد تخصصات'
                        : 'اختر التخصص'
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون تخصص —</SelectItem>
                  {dialogSpecializations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الأستاذ</Label>
              <Select value={formData.teacherId} onValueChange={(v) => {
                const t = teachers.find(t => t.id === v);
                setFormData({ ...formData, teacherId: v, teacherName: t?.name || formData.teacherName });
              }}>
                <SelectTrigger><SelectValue placeholder="اختر الأستاذ" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الحضور الإجمالي</Label>
              <Input type="number" min="0" value={formData.totalCount} onChange={(e) => setFormData({ ...formData, totalCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عدد الذكور</Label>
              <Input type="number" min="0" value={formData.maleCount} onChange={(e) => setFormData({ ...formData, maleCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>عدد الإناث</Label>
              <Input type="number" min="0" value={formData.femaleCount} onChange={(e) => setFormData({ ...formData, femaleCount: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
            </div>

            {/* ===== QR Scan Section (works for both add and edit) ===== */}
            <div className="md:col-span-2 border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1 font-semibold">
                  <ScanLine className="w-4 h-4 text-emerald-600" />
                  {editing ? 'الطلاب الحاضرون المسجلون (يمكنك إضافة المزيد)' : 'مسح QR لإحصاء الطلاب الحاضرين'}
                </Label>
                  {scannedStudents.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearScannedStudents} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5 ml-1" /> مسح القائمة
                    </Button>
                  )}
                </div>

                {/* Stats row when there are scanned students */}
                {scannedStudents.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-blue-50 rounded border border-blue-200 text-center">
                      <p className="text-xs text-muted-foreground">إجمالي</p>
                      <p className="text-xl font-bold num text-blue-700">{scannedStudents.length}</p>
                    </div>
                    <div className="p-2 bg-cyan-50 rounded border border-cyan-200 text-center">
                      <p className="text-xs text-muted-foreground">ذكور</p>
                      <p className="text-xl font-bold num text-cyan-700">
                        {scannedStudents.filter(s => s.gender === 'ذكر').length}
                      </p>
                    </div>
                    <div className="p-2 bg-pink-50 rounded border border-pink-200 text-center">
                      <p className="text-xs text-muted-foreground">إناث</p>
                      <p className="text-xl font-bold num text-pink-700">
                        {scannedStudents.filter(s => s.gender === 'أنثى').length}
                      </p>
                    </div>
                  </div>
                )}

                {/* Camera section */}
                {!scanning ? (
                  <div className="space-y-2">
                    {/* HTTP warning */}
                    {!isSecureContext && (
                      <div className="p-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800">
                        <strong>تنبيه:</strong> الكاميرا تتطلب HTTPS أو localhost.
                        استخدم رفع صورة QR أو الإدخال اليدوي بالأسفل.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Button
                        onClick={startQrScan}
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        disabled={!isSecureContext}
                      >
                        <Camera className="w-4 h-4 ml-2" />
                        {scannedStudents.length > 0 ? 'استئناف المسح' : 'بدء مسح QR'}
                      </Button>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <ScanLine className="w-4 h-4 ml-2" /> رفع صورة QR
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                    {scanError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-1">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{scanError}</span>
                        </div>
                        {/* Re-enable camera instructions */}
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs underline">كيف أسمح بالكاميرا؟</summary>
                          <div className="text-xs space-y-1 mt-1 pr-4">
                            <p><strong>Chrome / Edge:</strong> اضغط أيقونة القفل أو الكاميرا في شريط العنوان ← الكاميرا ← السماح ← أعد تحميل الصفحة.</p>
                            <p><strong>Firefox:</strong> اضغط أيقونة القفل ← الأذونات ← الكاميرا ← السماح.</p>
                            <p>أو استخدم <strong>رفع صورة QR</strong> أو <strong>الإدخال اليدوي</strong> بالأسفل.</p>
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Manual entry fallback */}
                    <div className="border-t pt-2 space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        إدخال يدوي (بديل للكاميرا):
                      </Label>
                      <form onSubmit={handleManualAdd} className="flex gap-2">
                        <Input
                          placeholder="رقم الطالب أو المعرف..."
                          value={manualStudentId}
                          onChange={(e) => setManualStudentId(e.target.value)}
                          dir="ltr"
                          className="text-sm"
                        />
                        <Button type="submit" size="sm" disabled={!manualStudentId.trim()}>
                          <Plus className="w-4 h-4 ml-1" /> إضافة
                        </Button>
                      </form>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="أو ابحث بالاسم..."
                          value={manualStudentSearch}
                          onChange={(e) => setManualStudentSearch(e.target.value)}
                          className="pr-10 text-sm"
                        />
                      </div>
                      {manualSearchResults.length > 0 && (
                        <div className="border rounded max-h-48 overflow-y-auto divide-y">
                          {manualSearchResults.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full p-2 text-right hover:bg-muted/50 flex items-center justify-between"
                              onClick={() => {
                                submitScannedStudent(s.id);
                                setManualStudentSearch('');
                                setManualSearchResults([]);
                              }}
                            >
                              <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground num">
                                  {s.studentNumber || '—'} • {s.department?.name || '—'}
                                </p>
                              </div>
                              <Plus className="w-4 h-4 text-emerald-600" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        className="w-full"
                        style={{ maxHeight: '300px', objectFit: 'cover' }}
                        playsInline
                        muted
                      />
                      <div
                        className="absolute inset-0 border-4 border-emerald-500 pointer-events-none"
                        style={{ margin: '20%' }}
                      />
                      <Badge
                        variant="outline"
                        className="absolute top-2 right-2 bg-black/70 text-white border-white/30"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1 animate-pulse" /> جاري المسح...
                      </Badge>
                    </div>
                    <Button onClick={stopQrScan} variant="outline" className="w-full">
                      <X className="w-4 h-4 ml-2" /> إيقاف المسح
                    </Button>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Last scan feedback */}
                {lastScanFeedback && (
                  <div className={`p-2 rounded text-xs flex items-center gap-2 ${
                    lastScanFeedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : lastScanFeedback.type === 'duplicate'
                        ? 'bg-amber-50 border border-amber-200 text-amber-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {lastScanFeedback.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span>{lastScanFeedback.message}</span>
                  </div>
                )}

                {/* Scanned students list */}
                {scannedStudents.length > 0 && (
                  <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                    {scannedStudents.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/30">
                        <Badge variant="outline" className="num text-xs">{i + 1}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground num">
                            {s.studentNumber || '—'} • {s.department || '—'}
                          </p>
                        </div>
                        {s.gender && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              s.gender === 'ذكر'
                                ? 'text-cyan-700 border-cyan-300 bg-cyan-50'
                                : 'text-pink-700 border-pink-300 bg-pink-50'
                            }`}
                          >
                            {s.gender}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeScannedStudent(s.id)}
                          className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                          title="إزالة"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={liveDuration <= 0}>
              {editing ? 'حفظ' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Bulk Attendance Dialog ===== */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" /> تسجيل حضور جماعي
            </DialogTitle>
          </DialogHeader>

          {/* Session info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-3 border-b">
            <div className="space-y-1">
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={bulkForm.date} onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الأقسام</Label>
              <Select value={bulkDept} onValueChange={handleBulkDeptChange}>
                <SelectTrigger><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                التخصص {bulkDept !== 'all' && specializations.length === 0 && (
                  <span className="text-muted-foreground">(لا يوجد)</span>
                )}
              </Label>
              <Select
                value={bulkSpec}
                onValueChange={handleBulkSpecChange}
                disabled={bulkDept === 'all' || specializations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={bulkDept === 'all' ? 'اختر القسم أولاً' : specializations.length === 0 ? 'لا يوجد تخصصات' : 'كل التخصصات'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التخصصات</SelectItem>
                  {specializations.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">من</Label>
              <Input type="time" value={bulkForm.startTime} onChange={(e) => setBulkForm({ ...bulkForm, startTime: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى</Label>
              <Input type="time" value={bulkForm.endTime} onChange={(e) => setBulkForm({ ...bulkForm, endTime: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الأستاذ</Label>
              <Select value={bulkForm.teacherId || 'none'} onValueChange={(v) => setBulkForm({ ...bulkForm, teacherId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون أستاذ</SelectItem>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Student selection */}
          <div className="flex items-center gap-2 py-2 border-b">
            <Input placeholder="بحث بالاسم..." value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} className="flex-1" />
            <Button variant="outline" size="sm" onClick={selectAllVisible}>
              {filteredBulkStudents.every(s => selectedStudentIds.has(s.id)) && filteredBulkStudents.length > 0
                ? 'إلغاء الكل' : 'تحديد الكل'}
            </Button>
            <Badge variant="secondary" className="num">{selectedStudentIds.size} / {bulkStudents.length}</Badge>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredBulkStudents.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">لا يوجد طلاب</p>
            ) : (
              <div className="divide-y">
                {filteredBulkStudents.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/30 transition-colors ${
                      selectedStudentIds.has(s.id) ? 'bg-purple-50/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.has(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground mr-2 num">
                        {s.studentNumber || '—'} • {s.department?.name || '—'}
                      </span>
                    </div>
                    {s.gender && <Badge variant="outline" className="text-xs">{s.gender}</Badge>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {bulkResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-emerald-800">تم تسجيل الحضور بنجاح</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-muted-foreground">إجمالي الحضور</p>
                  <p className="text-xl font-bold num text-blue-700">{bulkResult.total}</p>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-muted-foreground">ذكور</p>
                  <p className="text-xl font-bold num text-blue-600">{bulkResult.male}</p>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-muted-foreground">إناث</p>
                  <p className="text-xl font-bold num text-pink-600">{bulkResult.female}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>إغلاق</Button>
            <Button onClick={handleBulkSave} disabled={bulkSaving || selectedStudentIds.size === 0}>
              {bulkSaving ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الحفظ...</> : <><CheckCircle2 className="w-4 h-4 ml-2" /> حفظ الحضور ({selectedStudentIds.size})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
