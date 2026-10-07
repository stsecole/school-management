'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  QrCode, Camera, Loader2, CheckCircle2, AlertCircle, ArrowRight,
  ScanLine, User, Clock, Users, X, Search, Volume2, VolumeX, Pause, Play,
  ImagePlus, ShieldAlert, Info,
} from 'lucide-react';
import jsQR from 'jsqr';

interface ScanResult {
  ok: boolean;
  message: string;
  student?: { id: string; name: string; studentNumber: string | null; department: string | null; level?: string | null };
  duplicate?: boolean;
}

interface TodayRecord {
  id: string;
  time: string;
  studentName: string;
  studentNumber: string | null;
  department: string | null;
}

interface ScanHistoryItem extends ScanResult {
  timestamp: number;
  scannedId: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'menu' | 'camera' | 'manual'>('menu');
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualId, setManualId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [stats, setStats] = useState({ success: 0, duplicates: 0, errors: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScanIdRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ===== Audio beep feedback =====
  const playBeep = useCallback((type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      // Success: two short high-pitched beeps
      // Duplicate: one medium-pitched beep
      // Error: one low-pitched beep
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
      if (type === 'success') {
        playTone(880, 0, 0.12);    // A5
        playTone(1320, 0.15, 0.15); // E6
      } else if (type === 'duplicate') {
        playTone(440, 0, 0.25);    // A4
      } else {
        playTone(220, 0, 0.4);     // A3
      }
    } catch {}
  }, [soundEnabled]);

  // ===== Load today's records =====
  const loadTodayRecords = async () => {
    try {
      const res = await fetch('/api/attendance/scan');
      const data = await res.json();
      setTodayRecords(data.records || []);
    } catch {}
  };

  useEffect(() => { loadTodayRecords(); }, []);

  // ===== Detect non-secure context (HTTP without HTTPS) =====
  const isSecureContext = typeof window !== 'undefined' &&
    (window.isSecureContext ||
     window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.protocol === 'https:');

  const [cameraError, setCameraError] = useState<string | null>(null);

  // ===== Image upload fallback (scan QR from image) =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastResult(null);
    try {
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
          submitScan(code.data.trim(), false);
        } else {
          setLastResult({
            ok: false,
            message: 'لم يتم العثور على QR Code في الصورة. تأكد من وضوح الصورة وأنها تحتوي على QR صالح.',
          });
          playBeep('error');
        }
      };
      img.onerror = () => {
        setLastResult({ ok: false, message: 'تعذر قراءة الصورة' });
      };
      img.src = URL.createObjectURL(file);
    } catch (err: any) {
      setLastResult({ ok: false, message: 'خطأ في معالجة الصورة: ' + err.message });
    } finally {
      // Clear input so the same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ===== Camera scanning with jsQR =====
  const startCamera = async () => {
    setMode('camera');
    setScanning(true);
    setPaused(false);
    setLastResult(null);
    setCameraError(null);

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('readonly');
      setLastResult({
        ok: false,
        message: 'متصفحك لا يدعم الوصول للكاميرا، أو أنك تستخدم اتصال HTTP غير آمن. استخدم HTTPS أو localhost. يمكنك أيضاً استخدام رفع صورة أو الإدخال اليدوي.',
      });
      setScanning(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanIntervalRef.current = setInterval(scanFrame, 200);
      }
    } catch (e: any) {
      const errName = e?.name || '';
      let msg = 'تعذر الوصول للكاميرا: ' + (e.message || errName);
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        msg = 'تم رفض إذن الكاميرا. للحل: 1) اضغط أيقونة الكاميرا في شريط العنوان بالمتصفح 2) اختر "السماح" 3) أعد تحميل الصفحة. أو استخدم رفع صورة QR أو الإدخال اليدوي.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        msg = 'لا توجد كاميرا متصلة بهذا الجهاز. استخدم رفع صورة QR أو الإدخال اليدوي / قارئ USB.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        msg = 'الكاميرا مستخدمة من قبل تطبيق آخر. أغلق التطبيقات الأخرى (مثل Zoom, Teams) وأعد المحاولة.';
      } else if (!isSecureContext) {
        msg = 'الكاميرا تتطلب اتصال HTTPS آمن. أنت تستخدم HTTP. الحل: استخدم HTTPS، أو localhost، أو استخدم رفع صورة QR، أو الإدخال اليدوي.';
      }
      setCameraError(errName || 'unknown');
      setLastResult({ ok: false, message: msg });
      setScanning(false);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    setPaused(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const togglePause = () => {
    setPaused(p => !p);
  };

  const scanFrame = () => {
    if (!scanning || paused || submitting) return;
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

      // Prevent re-scanning the same QR within 4 seconds
      if (lastScanIdRef.current === scannedId && (now - lastScanTimeRef.current) < 4000) {
        return;
      }

      lastScanIdRef.current = scannedId;
      lastScanTimeRef.current = now;
      // Don't stop the camera — just submit and keep scanning
      submitScan(scannedId, /*continuous*/ true);
    }
  };

  // ===== Offline queue (localStorage) =====
  const OFFLINE_QUEUE_KEY = 'attendance_offline_queue';
  const [offlineQueue, setOfflineQueue] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          setOfflineQueue(arr);
        }
      }
    } catch {}
    // Listen to online/offline events
    const handleOnline = () => { setIsOnline(true); };
    const handleOffline = () => { setIsOnline(false); };
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save offline queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    } catch {}
  }, [offlineQueue]);

  // Auto-sync when back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !syncing) {
      syncOfflineQueue();
    }
  }, [isOnline, offlineQueue, syncing]);

  const syncOfflineQueue = useCallback(async () => {
    if (syncing || offlineQueue.length === 0) return;
    setSyncing(true);
    // Take a snapshot of current queue
    const queue = [...offlineQueue];
    const failed: string[] = [];
    let synced = 0;
    for (const studentId of queue) {
      try {
        const res = await fetch('/api/attendance/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok || data.duplicate) {
            // Successfully synced (or duplicate, which is fine)
            synced++;
            continue;
          }
        }
        // Server returned error (not network) — keep in queue
        failed.push(studentId);
      } catch {
        // Network error — keep in queue, stop syncing
        failed.push(studentId);
        break;
      }
    }
    setOfflineQueue(failed);
    setSyncing(false);
    if (synced > 0) {
      setLastResult({
        ok: true,
        message: `تمت مزامنة ${synced} مسحة محفوظة offline`,
      });
      playBeep('success');
      loadTodayRecords();
    }
  }, [offlineQueue, syncing, playBeep, loadTodayRecords]);

  // ===== Submit scanned ID =====
  const submitScan = async (studentId: string, continuous = false) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      setLastResult(data);

      // Update history (keep last 10)
      const historyItem: ScanHistoryItem = {
        ...data,
        timestamp: Date.now(),
        scannedId: studentId,
      };
      setScanHistory(prev => [historyItem, ...prev].slice(0, 10));

      // Audio feedback + stats
      if (data.ok) {
        playBeep('success');
        setStats(s => ({ ...s, success: s.success + 1 }));
        loadTodayRecords();
      } else if (data.duplicate) {
        playBeep('duplicate');
        setStats(s => ({ ...s, duplicates: s.duplicates + 1 }));
      } else {
        playBeep('error');
        setStats(s => ({ ...s, errors: s.errors + 1 }));
      }

      // Start cooldown indicator (1.5s) for continuous mode
      if (continuous) {
        setCooldownMs(1500);
        const start = Date.now();
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, 1500 - elapsed);
          setCooldownMs(remaining);
          if (remaining <= 0 && cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
        }, 100);
      }
    } catch {
      // ===== Offline mode: save to localStorage queue =====
      setOfflineQueue(prev => [...prev, studentId]);
      setLastResult({
        ok: false,
        message: `⚠ لا يوجد اتصال. تم حفظ المسحة محلياً وستُزامن تلقائياً عند عودة الاتصال. (المسحات المعلّقة: ${offlineQueue.length + 1})`,
      });
      // Update history with offline marker
      const historyItem: ScanHistoryItem = {
        ok: false,
        message: `(محفوظ offline) ${studentId}`,
        timestamp: Date.now(),
        scannedId: studentId,
      };
      setScanHistory(prev => [historyItem, ...prev].slice(0, 10));
      playBeep('error');
      setStats(s => ({ ...s, errors: s.errors + 1 }));
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Manual input (USB barcode scanner or keyboard) =====
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    const value = manualId.trim();
    setManualId(''); // clear immediately so USB scanner can scan again
    await submitScan(value, /*continuous*/ false);
  };

  // ===== Student search for manual selection =====
  useEffect(() => {
    if (!studentSearch.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&limit=20`);
        const data = await res.json();
        setSearchResults(data.students || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  // ===== Cleanup on unmount =====
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-50">
              <ScanLine className="w-7 h-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">تسجيل حضور الطلاب</h1>
              <p className="text-muted-foreground text-sm">مسح البطاقة أو إدخال يدوي — يدعم المسح المتواصل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(s => !s)}
              title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
          </div>
        </div>

        {/* Today's count + session stats */}
        <Card className="mb-4">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold num text-purple-700">{todayRecords.length}</p>
                <p className="text-xs text-muted-foreground">مسجّل اليوم</p>
              </div>
              <div>
                <p className="text-2xl font-bold num text-emerald-600">{stats.success}</p>
                <p className="text-xs text-muted-foreground">ناجح بالجلسة</p>
              </div>
              <div>
                <p className="text-2xl font-bold num text-amber-600">{stats.duplicates}</p>
                <p className="text-xs text-muted-foreground">مكرر بالجلسة</p>
              </div>
              <div>
                <p className="text-2xl font-bold num text-red-600">{stats.errors}</p>
                <p className="text-xs text-muted-foreground">أخطاء بالجلسة</p>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={loadTodayRecords}>
                <Clock className="w-4 h-4 ml-1" /> تحديث
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Offline status banner */}
        {(!isOnline || offlineQueue.length > 0) && (
          <Card className={`mb-4 border-2 ${isOnline ? 'border-blue-300 bg-blue-50/50' : 'border-amber-300 bg-amber-50/50'}`}>
            <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-blue-500 animate-pulse' : 'bg-amber-500'}`} />
                <div>
                  <p className={`text-sm font-medium ${isOnline ? 'text-blue-800' : 'text-amber-800'}`}>
                    {!isOnline
                      ? '⚠ وضع عدم الاتصال — المسحات تُحفظ محلياً'
                      : syncing
                        ? '🔄 جاري مزامنة المسحات المحفوظة...'
                        : 'متصل — المسحات المحفوظة ستُزامن تلقائياً'}
                  </p>
                  {offlineQueue.length > 0 && (
                    <p className={`text-xs ${isOnline ? 'text-blue-700' : 'text-amber-700'}`}>
                      المسحات المعلّقة: <span className="num font-bold">{offlineQueue.length}</span>
                    </p>
                  )}
                </div>
              </div>
              {isOnline && offlineQueue.length > 0 && !syncing && (
                <Button size="sm" variant="outline" onClick={syncOfflineQueue}>
                  مزامنة الآن
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mode selection */}
        {mode === 'menu' && (
          <Card>
            <CardContent className="p-6 space-y-3">
              {/* HTTP warning banner */}
              {!isSecureContext && (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 space-y-1">
                    <p className="font-bold">تنبيه: الكاميرا لن تعمل على HTTP</p>
                    <p>المتصفحات تمنع الوصول للكاميرا على اتصال HTTP غير الآمن. استخدم أحد الحلول:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5 mr-2">
                      <li>HTTPS (مع شهادة SSL)</li>
                      <li><code dir="ltr">http://localhost:3000</code> أو <code dir="ltr">http://127.0.0.1:3000</code></li>
                      <li>استخدم رفع صورة QR أو الإدخال اليدوي بالأسفل</li>
                    </ul>
                  </div>
                </div>
              )}

              <Button onClick={startCamera} size="lg" className="w-full" disabled={!isSecureContext}>
                <Camera className="w-5 h-5 ml-2" /> مسح بكاميرا الجهاز (متواصل)
              </Button>

              <Button variant="outline" size="lg" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="w-5 h-5 ml-2" /> رفع صورة QR
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <Button variant="outline" size="lg" className="w-full" onClick={() => { setMode('manual'); setLastResult(null); }}>
                <ScanLine className="w-5 h-5 ml-2" /> إدخال يدوي / قارئ USB
              </Button>

              <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                <p>• <b>الكاميرا</b>: مسح متواصل للبطاقات تلقائياً — يتطلب HTTPS</p>
                <p>• <b>رفع صورة</b>: التقط صورة لبطاقة QR وارفعها — يعمل على HTTP أيضاً</p>
                <p>• <b>USB/يدوي</b>: ادخل الرقم ثم Enter — الحقل يُفرَّغ تلقائياً</p>
                <p>• صوت تنبيه بعد كل مسحة: ناجح / مكرر / خطأ</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Camera mode */}
        {mode === 'camera' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5" /> مسح بالكاميرا
                  {scanning && !paused && (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" /> نشط
                    </Badge>
                  )}
                  {paused && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      متوقف مؤقتاً
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={togglePause} disabled={!scanning}>
                  {paused ? <><Play className="w-4 h-4 ml-1" /> استئناف</> : <><Pause className="w-4 h-4 ml-1" /> إيقاف مؤقت</>}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!scanning && cameraError && (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-bold mb-1">فشل تشغيل الكاميرا</p>
                        <p className="text-xs leading-relaxed">{lastResult?.message}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                      <ImagePlus className="w-4 h-4 ml-2" /> رفع صورة QR بدلاً من ذلك
                    </Button>
                    <Button variant="outline" onClick={() => { setMode('manual'); setCameraError(null); setLastResult(null); }} className="w-full">
                      <ScanLine className="w-4 h-4 ml-2" /> الإدخال اليدوي / قارئ USB
                    </Button>
                    <Button variant="outline" onClick={() => { setCameraError(null); setLastResult(null); startCamera(); }} className="w-full">
                      <Camera className="w-4 h-4 ml-2" /> إعادة محاولة الكاميرا
                    </Button>
                    <Button variant="ghost" onClick={() => { setCameraError(null); setLastResult(null); setMode('menu'); }} className="w-full">
                      <ArrowRight className="w-4 h-4 ml-1" /> العودة للقائمة
                    </Button>
                  </div>
                </div>
              )}
              {scanning && (
                <div className="text-center space-y-3">
                  <div className="relative inline-block">
                    <video
                      ref={videoRef}
                      className="rounded-lg"
                      style={{ maxWidth: '100%', maxHeight: '400px' }}
                      playsInline
                      muted
                    />
                    {/* Scanning frame overlay */}
                    <div
                      className="absolute inset-0 border-4 border-purple-500 rounded-lg pointer-events-none"
                      style={{ margin: '15%' }}
                    />
                    {/* Corner indicators */}
                    <div className="absolute pointer-events-none" style={{ top: '15%', left: '15%', width: '20px', height: '20px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981' }} />
                    <div className="absolute pointer-events-none" style={{ top: '15%', right: '15%', width: '20px', height: '20px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981' }} />
                    <div className="absolute pointer-events-none" style={{ bottom: '15%', left: '15%', width: '20px', height: '20px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981' }} />
                    <div className="absolute pointer-events-none" style={{ bottom: '15%', right: '15%', width: '20px', height: '20px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981' }} />

                    {/* Cooldown indicator */}
                    {cooldownMs > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded num">
                        انتظر {(cooldownMs / 1000).toFixed(1)}s
                      </div>
                    )}
                    {submitting && (
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> جاري الحفظ
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    وجّه الكاميرا نحو QR Code — سيتم تسجيل كل بطاقة تلقائياً بدون توقف
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => { stopCamera(); setMode('menu'); }}>
                      <X className="w-4 h-4 ml-1" /> إنهاء المسح
                    </Button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </CardContent>
          </Card>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="w-5 h-5" /> إدخال يدوي / قارئ USB
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Direct input — for USB barcode scanners */}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  امسح البطاقة أو أدخل رقم الطالب ثم اضغط Enter — الحقل يُفرَّغ تلقائياً
                </Label>
                <Input
                  placeholder="امسح البطاقة أو أدخل رقم الطالب..."
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="text-lg h-14"
                  autoFocus
                  dir="ltr"
                  disabled={submitting}
                />
                <Button type="submit" disabled={!manualId.trim() || submitting} className="w-full h-12">
                  {submitting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                  تسجيل الحضور
                </Button>
              </form>

              {/* Student search */}
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground mb-1 block">أو ابحث عن طالب:</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم أو الرقم..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg divide-y">
                    {searchResults.map(s => (
                      <button
                        key={s.id}
                        className="w-full p-2 text-right hover:bg-muted/50 flex items-center justify-between"
                        onClick={() => { submitScan(s.id); setStudentSearch(''); setSearchResults([]); }}
                      >
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground num">{s.studentNumber || '—'} • {s.department?.name || '—'}</p>
                        </div>
                        <User className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={() => setMode('menu')}>
                <ArrowRight className="w-4 h-4 ml-1" /> القائمة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Last result */}
        {lastResult && (
          <Card className={`mt-4 border-2 ${lastResult.ok ? 'border-emerald-300' : lastResult.duplicate ? 'border-amber-300' : 'border-red-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {lastResult.ok ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                ) : lastResult.duplicate ? (
                  <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${lastResult.ok ? 'text-emerald-700' : lastResult.duplicate ? 'text-amber-700' : 'text-red-700'}`}>
                    {lastResult.message}
                  </p>
                  {lastResult.student && (
                    <div className="mt-2 p-2 bg-muted/30 rounded text-sm space-y-1">
                      <p><span className="text-muted-foreground">الاسم:</span> {lastResult.student.name}</p>
                      <p><span className="text-muted-foreground">الرقم:</span> <span className="num">{lastResult.student.studentNumber || '—'}</span></p>
                      <p><span className="text-muted-foreground">القسم:</span> {lastResult.student.department || '—'}</p>
                      {lastResult.student.level && (
                        <p><span className="text-muted-foreground">المستوى:</span> {lastResult.student.level}</p>
                      )}
                    </div>
                  )}
                  {mode !== 'camera' && (
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setLastResult(null)}>
                      مسح
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scan history (camera mode only) */}
        {mode === 'camera' && scanHistory.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" /> آخر المسحات
                </div>
                <Button size="sm" variant="ghost" onClick={() => setScanHistory([])}>
                  مسح القائمة
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-60 overflow-y-auto divide-y">
                {scanHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-2 text-sm hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      {h.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : h.duplicate ? (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium text-xs">{h.message}</p>
                        <p className="text-xs text-muted-foreground num">{new Date(h.timestamp).toLocaleTimeString('ar-DZ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's records */}
        {todayRecords.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5" /> سجلات اليوم ({todayRecords.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto divide-y">
                {todayRecords.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between p-3 text-sm hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="num">{i + 1}</Badge>
                      <div>
                        <p className="font-medium">{r.studentName}</p>
                        <p className="text-xs text-muted-foreground">{r.department || '—'}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs num text-muted-foreground">{r.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
