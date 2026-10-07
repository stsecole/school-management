'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Smartphone, Chrome, Apple, X } from 'lucide-react';

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    const installed = () => { setDeferredPrompt(null); setIsStandalone(true); };
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', installed); };
  }, []);

  if (isStandalone) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setIsStandalone(true);
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <button onClick={handleInstall} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-primary-foreground/80 text-xs">
        <Download className="w-4 h-4" /> تثبيت التطبيق
      </button>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> كيفية تثبيت التطبيق
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {platform === 'ios' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded"><Apple className="w-5 h-5 text-blue-600" /><p className="text-sm font-medium">iPhone / iPad (Safari)</p></div>
                <ol className="list-decimal pr-5 space-y-1 text-sm">
                  <li>اضغط زر <strong>مشاركة</strong> (مربع بسهم)</li>
                  <li>اختر <strong>«Add to Home Screen»</strong></li>
                  <li>اضغط <strong>«Add»</strong></li>
                </ol>
              </div>
            )}
            {platform === 'android' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded"><Chrome className="w-5 h-5 text-emerald-600" /><p className="text-sm font-medium">Android (Chrome)</p></div>
                <ol className="list-decimal pr-5 space-y-1 text-sm">
                  <li>اضغط <strong>القائمة (⋮)</strong></li>
                  <li>اختر <strong>«Install app»</strong> أو <strong>«Add to Home screen»</strong></li>
                  <li>اضغط <strong>«Install»</strong></li>
                </ol>
              </div>
            )}
            {platform === 'desktop' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-purple-50 rounded"><Chrome className="w-5 h-5 text-purple-600" /><p className="text-sm font-medium">كمبيوتر (Chrome / Edge)</p></div>
                <ol className="list-decimal pr-5 space-y-1 text-sm">
                  <li>ابحث عن أيقونة <strong>التثبيت</strong> (⊕) في شريط العنوان</li>
                  <li>أو اضغط <strong>القائمة (⋮)</strong> → <strong>«Install»</strong></li>
                  <li>اضغط <strong>«Install»</strong></li>
                </ol>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowInstructions(false)}><X className="w-4 h-4 ml-1" /> إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
