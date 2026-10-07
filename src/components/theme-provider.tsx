'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

// أنماط السمة المدعومة: فاتح، داكن، أو تبع تفضيل النظام
export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  // النمط المختار من قبل المستخدم (light/dark/system)
  theme: Theme;
  // السمة الفعلية المطبّقة بعد الحل (light/dark فقط)
  resolvedTheme: 'light' | 'dark';
  // تحديد السمة بشكل صريح
  setTheme: (theme: Theme) => void;
  // التبديل السريع بين الفاتح والداكن
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// مفتاح التخزين المحلي للسمة
const STORAGE_KEY = 'theme';

// الحصول على السمة المحفوظة أو السمة الافتراضية (system)
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // تجاهل أي خطأ في القراءة (وضع التصفح الخاص مثلًا)
  }
  return 'system';
}

// حل السمة الفعلية بناءً على تفضيل النظام
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

// تطبيق السمة على عنصر الجذر html وإضافة/إزالة class الـ dark
function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  // تحديث لون السمة في الميتا ليتوافق لون شريط المتصفح مع الواجهة
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', resolved === 'dark' ? '#0a0f1f' : '#1e3a8a');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  // نبدأ بالقيمة الافتراضية لتجنّب عدم تطابق الإعداد أثناء SSR
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // التهيئة الأولية بعد التحميل في المتصفح
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // الاستماع لتغييرات تفضيل النظام عند ضبط الوضع على system
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const resolved: 'light' | 'dark' = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // ضبط السمة وحفظها في التخزين المحلي
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // تجاهل أي خطأ في الكتابة
    }
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // التبديل السريع بين الفاتح والداكن
  const toggleTheme = useCallback(() => {
    const next: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Hook للوصول إلى سياق السمة
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
