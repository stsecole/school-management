'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// واجهة الحدث beforeinstallprompt غير معرّفة في الأنواع الافتراضية
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// تسجيل Service Worker ومراقبة حالة الاتصال والحدث beforeinstallprompt
export function PWARegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // تسجيل Service Worker في الإنتاج فقط لتجنّب تعارض HMR في التطوير
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => {
            // تجاهل أخطاء التسجيل بشكل صامت في التطوير
            console.warn('فشل تسجيل Service Worker:', err);
          });
      });
    }

    // مراقبة حالة الاتصال بالإنترنت
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // التقاط الحدث beforeinstallprompt لتثبيت التطبيق
    const handleBeforeInstallPrompt = (e: Event) => {
      // منع ظهور الـ mini-infobar الافتراضي
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setInstallEvent(evt);
      // تخزين الحدث على window ليتمكن زر التثبيت من الوصول إليه
      (window as any).__beforeInstallPromptEvent = evt;
      // إطلاق حدث مخصص ليستمع له زر التثبيت
      window.dispatchEvent(new CustomEvent('pwa-install-available'));
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // إعادة الضبط عند اكتمال التثبيت
    const handleAppInstalled = () => {
      (window as any).__beforeInstallPromptEvent = null;
      setInstallEvent(null);
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // شريط أحمر في أسفل الشاشة عند فقدان الاتصال
  if (!isOffline) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[100] bg-red-600 text-white py-2 px-4 text-center text-sm font-medium shadow-lg animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>أنت غير متصل بالإنترنت - بعض الميزات قد لا تعمل</span>
      </div>
    </div>
  );
}
