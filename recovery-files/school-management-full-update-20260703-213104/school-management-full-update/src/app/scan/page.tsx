'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Camera, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setScanning(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanFrame();
      }
    } catch (e: any) {
      setError('تعذر الوصول للكاميرا: ' + e.message);
      setScanning(false);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const scanFrame = () => {
    if (!scanning || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Simple QR detection using canvas - looks for contrast changes
        // This is a basic implementation; for production, use a library like jsQR
        try {
          // Try to decode using browser's BarcodeDetector API if available
          if ('BarcodeDetector' in window) {
            const barcodeDetector = new (window as any).BarcodeDetector({
              formats: ['qr_code']
            });
            barcodeDetector.detect(canvas).then((codes: any[]) => {
              if (codes.length > 0) {
                handleScanResult(codes[0].rawValue);
                return;
              }
            }).catch(() => {});
          }
        } catch {}
      }
    }
    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  };

  const handleScanResult = (data: string) => {
    stopCamera();
    try {
      const parsed = JSON.parse(data);
      setResult(parsed);
    } catch {
      setResult({ raw: data });
    }
  };

  const handleManualInput = () => {
    const input = prompt('أدخل رقم الوصل أو بيانات QR:');
    if (input) {
      try {
        const parsed = JSON.parse(input);
        setResult(parsed);
      } catch {
        setResult({ raw: input });
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-50">
              <QrCode className="w-7 h-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مسح QR Code</h1>
              <p className="text-muted-foreground text-sm">التحقق من الوصول أو بطاقات الطلاب</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>
            <ArrowRight className="w-4 h-4 ml-1" /> رجوع
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {!scanning && !result && (
              <div className="text-center space-y-4">
                <div className="p-8 bg-muted/30 rounded-lg">
                  <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">اضغط لبدء المسح بالكاميرا</p>
                </div>
                <Button onClick={startCamera} size="lg" className="w-full">
                  <Camera className="w-5 h-5 ml-2" /> بدء المسح
                </Button>
                <Button variant="outline" onClick={handleManualInput} className="w-full">
                  إدخال يدوي
                </Button>
              </div>
            )}

            {scanning && (
              <div className="text-center space-y-4">
                <div className="relative inline-block">
                  <video
                    ref={videoRef}
                    className="rounded-lg"
                    style={{ maxWidth: '100%', maxHeight: '400px' }}
                    playsInline
                  />
                  <div className="absolute inset-0 border-4 border-purple-500 rounded-lg pointer-events-none" style={{ margin: '20%' }} />
                </div>
                <p className="text-sm text-muted-foreground">وجّه الكاميرا نحو QR Code...</p>
                <Button variant="outline" onClick={stopCamera}>إيقاف</Button>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="font-bold">تم المسح بنجاح</span>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                  {result.n && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">رقم الوصل:</span>
                      <span className="font-bold num">{result.n}</span>
                    </div>
                  )}
                  {result.a && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المبلغ:</span>
                      <span className="font-bold num">{result.a} دج</span>
                    </div>
                  )}
                  {result.d && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">التاريخ:</span>
                      <span className="font-bold num">{result.d}</span>
                    </div>
                  )}
                  {result.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الطالب:</span>
                      <span className="font-bold">{result.name}</span>
                    </div>
                  )}
                  {result.raw && (
                    <div className="text-center">
                      <p className="text-sm">{result.raw}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setResult(null); }}>
                    مسح آخر
                  </Button>
                  {result.n && (
                    <Button className="flex-1" onClick={() => window.open(`/api/finance/receipt/${result.n}`, '_blank')}>
                      عرض الوصل
                    </Button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-red-600">
                  <AlertCircle className="w-6 h-6" />
                  <span>{error}</span>
                </div>
                <Button variant="outline" onClick={handleManualInput}>إدخال يدوي</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
