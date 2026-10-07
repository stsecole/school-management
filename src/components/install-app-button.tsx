'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, Apple, Monitor, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// واجهة الحدث beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

// كشف منصة المستخدم
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  // iOS Safari (لا يدعم beforeinstallprompt)
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

// التحقق مما إذا كان التطبيق يعمل في وضع standalone (مثبّت بالفعل)
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if ((window.navigator as any).standalone === true) return true;
  // Android/Chrome
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

interface InstallAppButtonProps {
  // فئة إضافية للتنسيق في الرأس
  className?: string;
}

// زر تثبيت التطبيق
// - إذا دعم المتصفح beforeinstallprompt: يطلق التثبيت الأصلي
// - إذا لم يدعم (iOS/Safari): يعرض تعليمات حسب المنصة
// - يختفي تلقائياً عند تثبيت التطبيق (وضع standalone)
export function InstallAppButton({ className }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // إذا كان التطبيق مثبّتاً بالفعل لا نعرض الزر
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    // قراءة الحدث المخزّن من PWARegister إن وُجد
    const existing = (window as any).__beforeInstallPromptEvent as BeforeInstallPromptEvent | undefined;
    if (existing) setDeferredPrompt(existing);

    const handleInstallAvailable = () => {
      const evt = (window as any).__beforeInstallPromptEvent as BeforeInstallPromptEvent | undefined;
      if (evt) setDeferredPrompt(evt);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  // لا نعرض الزر إذا كان التطبيق مثبّتاً
  if (installed) return null;

  // معالج النقر على زر التثبيت
  const handleClick = async () => {
    if (deferredPrompt) {
      // المتصفح يدعم beforeinstallprompt - أطلق التثبيت الأصلي
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          toast({
            title: 'تم التثبيت',
            description: 'تم تثبيت التطبيق بنجاح',
          });
          setInstalled(true);
        }
        // مهما كان الخيار، نظّف الحدث لأنه يُستهلك لمرة واحدة
        setDeferredPrompt(null);
        (window as any).__beforeInstallPromptEvent = null;
      } catch (err) {
        console.error('فشل التثبيت:', err);
        toast({
          title: 'تنبيه',
          description: 'تعذّر بدء التثبيت، جرّب التعليمات اليدوية',
          variant: 'destructive',
        });
        setShowInstructions(true);
      }
    } else {
      // لا يدعم beforeinstallprompt - اعرض التعليمات
      setShowInstructions(true);
    }
  };

  const platform = detectPlatform();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`gap-1.5 text-primary-foreground hover:bg-primary-foreground/10 ${className ?? ''}`}
        onClick={handleClick}
        aria-label="تثبيت التطبيق"
        title="تثبيت التطبيق"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">تثبيت التطبيق</span>
      </Button>

      {/* نافذة التعليمات حسب المنصة */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Download className="w-5 h-5 text-primary" />
              تثبيت التطبيق على جهازك
            </DialogTitle>
            <DialogDescription className="text-right">
              اتبع الخطوات التالية لتثبيت التطبيق وإضافته إلى شاشتك الرئيسية
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {platform === 'ios' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <Apple className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">الخطوات لأجهزة iPhone و iPad</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>
                        اضغط على زر المشاركة{' '}
                        <Share className="inline w-4 h-4 mx-0.5 align-middle" />{' '}
                        في شريط أدوات سفاري
                      </li>
                      <li>
                        اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>
                      </li>
                      <li>
                        اضغط <strong>«إضافة»</strong> في الأعلى
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {platform === 'android' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <Smartphone className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">الخطوات لأجهزة أندرويد</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>
                        اضغط على زر القائمة <strong>⋮</strong> في متصفح Chrome
                      </li>
                      <li>
                        اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>
                      </li>
                      <li>
                        اضغط <strong>«تثبيت»</strong>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {platform === 'desktop' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <Monitor className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">الخطوات للحاسوب</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                      <li>
                        ابحث عن أيقونة التثبيت{' '}
                        <Download className="inline w-4 h-4 mx-0.5 align-middle" />{' '}
                        في شريط العنوان
                      </li>
                      <li>
                        اضغط عليها ثم اختر <strong>«تثبيت»</strong>
                      </li>
                      <li>
                        أو من قائمة المتصفح: <strong>«تثبيت هذا الموقع كتطبيق»</strong>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex items-start gap-2">
              <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                يمكنك إغلاق هذه النافذة وإعادة المحاولة لاحقاً من زر «تثبيت التطبيق» في الرأس
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
