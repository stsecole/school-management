'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * DataProtection — طبقة حماية شاملة للبيانات
 *
 * يمنع:
 * 1. النسخ (Ctrl+C, Ctrl+X)
 * 2. القائمة اليمنى (Right-click)
 * 3. تحديد النصوص (مع استثناء حقول الإدخال)
 * 4. حفظ الصفحة (Ctrl+S)
 * 5. الطباعة (Ctrl+P)
 * 6. أدوات المطور (F12, Ctrl+Shift+I, Ctrl+U)
 * 7. طمس المحتوى عند تبديل النافذة
 * 8. كشف PrintScreen
 * 9. علامة مائية باسم المستخدم
 */

interface DataProtectionProps {
  userName: string;
  enabled?: boolean;
}

export function DataProtection({ userName, enabled = true }: DataProtectionProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const watermarkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    // ===== 1. Disable right-click context menu =====
    const handleContextMenu = (e: MouseEvent) => {
      // Allow in input/textarea fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
    };

    // ===== 2. Disable keyboard shortcuts =====
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        showWarningToast();
        return;
      }

      // Block Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
        showWarningToast();
        return;
      }

      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        showWarningToast();
        return;
      }

      // Block Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        showWarningToast();
        return;
      }

      // Block Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        showWarningToast();
        return;
      }

      // Block Ctrl+C / Ctrl+X (Copy/Cut) — only outside input fields
      if (!isInputField && (e.ctrlKey || e.metaKey) && ['c', 'x'].includes(e.key.toLowerCase())) {
        // Allow copy in specific allowed areas
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          e.preventDefault();
          showWarningToast();
        }
        return;
      }

      // Block PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        // Clear clipboard
        try {
          navigator.clipboard.writeText('');
        } catch {}
        showWarningToast();
        // Blur content temporarily
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 2000);
        return;
      }
    };

    // ===== 3. Disable copy event =====
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      showWarningToast();
    };

    // ===== 4. Disable cut event =====
    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      showWarningToast();
    };

    // ===== 5. Disable paste (optional — only for non-input fields) =====
    const handlePaste = (e: ClipboardEvent) => {
      // Allow paste in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
    };

    // ===== 6. Disable drag (images, text) =====
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
      }
    };

    // ===== 7. Blur on window blur (anti screen capture) =====
    const handleBlur = () => {
      setIsBlurred(true);
    };
    const handleFocus = () => {
      setIsBlurred(false);
    };

    // ===== 8. Detect visibility change (tab switch) =====
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    // ===== 9. Detect screenshot via blur event on window =====
    const handleWindowBlur = () => {
      // Some screen capture tools trigger a blur event
      setIsBlurred(true);
      setTimeout(() => setIsBlurred(false), 1500);
    };

    // ===== 10. Disable text selection via CSS =====
    const style = document.createElement('style');
    style.id = 'data-protection-style';
    style.textContent = `
      body {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      img {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
        pointer-events: none;
      }
      /* Allow pointer events for images inside clickable containers */
      .allow-img-pointer img {
        pointer-events: auto;
      }
      /* Print protection */
      @media print {
        body { display: none !important; }
        body * { display: none !important; }
        body::after {
          content: "الطباعة غير مسموحة";
          display: block !important;
          font-size: 24px;
          text-align: center;
          padding: 100px;
        }
      }
    `;
    document.head.appendChild(style);

    // Warning toast helper
    let warningTimeout: NodeJS.Timeout | null = null;
    function showWarningToast() {
      setShowWarning(true);
      if (warningTimeout) clearTimeout(warningTimeout);
      warningTimeout = setTimeout(() => setShowWarning(false), 3000);
    }

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const styleEl = document.getElementById('data-protection-style');
      if (styleEl) styleEl.remove();
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Blur overlay when window loses focus or PrintScreen detected */}
      {isBlurred && (
        <div className="fixed inset-0 z-[9999] bg-background backdrop-blur-3xl flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            <p className="text-lg font-bold text-muted-foreground">المحتوى محمي</p>
            <p className="text-sm text-muted-foreground mt-1">عُودة إلى التطبيق لعرض البيانات</p>
          </div>
        </div>
      )}

      {/* Warning toast */}
      {showWarning && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium">هذه العملية محظورة — البيانات محمية</span>
        </div>
      )}

      {/* Watermark overlay — deters screen capture */}
      <div
        ref={watermarkRef}
        className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-12 opacity-[0.03]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="text-sm font-medium whitespace-nowrap transform"
              style={{
                transform: `rotate(-30deg)`,
                fontSize: '14px',
              }}
            >
              {userName} — {new Date().toLocaleDateString('en-GB')}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
