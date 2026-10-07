# Task 2: Dark Mode, PWA, Custom Dashboard, PDF Export

## ملخص المهمة

تم إنشاء وتحديث الملفات المطلوبة لإضافة الوضع الداكن، ودعم PWA، وتخصيص لوحة التحكم، وتصدير تقارير الذكاء الاصطناعي إلى PDF.

## الملفات المنشأة

### 1. الوضع الداكن (Dark Mode)
- **`src/components/theme-provider.tsx`**:
  - موفّر سياق (Context-based) يوفّر 3 أوضاع: `light`, `dark`, `system`
  - يحفظ الاختيار في `localStorage` تحت مفتاح `theme`
  - يستمع لتغييرات تفضيل النظام عند ضبط الوضع على `system`
  - يطبّق/يزيل class الـ `dark` على `document.documentElement`
  - يحدّث وسم `meta[name="theme-color"]`
  - يصدّر: `ThemeProvider` و `useTheme` hook
- **`src/components/theme-toggle.tsx`**:
  - زر للتبديل بين الوضع الفاتح والداكن
  - يعرض أيقونة القمر في الوضع الفاتح والشمس في الداكن
  - مصمّم للاستخدام في الرأس (`text-primary-foreground`)

### 2. PWA (Progressive Web App)
- **`public/manifest.json`**: ملف manifest كامل بالعربية و RTL مع أيقونات SVG
- **`public/icon-192.svg`** و **`public/icon-512.svg`**: أيقونات بتدرج أزرق ورمز قبعة التخرج
- **`public/sw.js`**: Service Worker بثلاث استراتيجيات:
  - Cache-first للملفات الثابتة
  - Network-first للمحتوى الديناميكي والتنقل
  - Network-first لطلبات API مع منع تخزين طلبات الكتابة
  - صفحات احتياطية للوضع غير المتصل
- **`src/components/pwa-register.tsx`**: يسجّل Service Worker ويعرض شريطاً أحمر عند فقدان الاتصال ويلتقط حدث `beforeinstallprompt`
- **`src/components/install-app-button.tsx`**:
  - زر "تثبيت التطبيق" في الرأس
  - إذا دعم المتصفح `beforeinstallprompt`: يطلق التثبيت الأصلي
  - إذا لم يدعم (iOS/Safari): يعرض تعليمات حسب المنصة (iOS/Android/Desktop) في Dialog
  - يختفي تلقائياً عند تثبيت التطبيق (وضع standalone)

### 3. تخصيص لوحة التحكم
- **`src/components/sections/dashboard-stats.tsx`** (مُحدَّث):
  - يقبل props: `{ isDirector?, userName?, onNavigate? }`
  - بطاقة ترحيب باسم المستخدم ودوره والتاريخ والوقت
  - للمدير: بطاقات مالية + كل الإحصائيات + أزرار "إدارة المنصة" و"التقارير"
  - للموظف: بطاقات المهام والطلاب والحضور فقط (لا إحصائيات مالية)
  - قسم "مهامي" يجلب المهام المخصصة للموظف باسمه عبر `/api/tasks?search=...`
  - بطاقات الإحصائيات قابلة للنقر (تستدعي `onNavigate`)

### 4. تصدير تقارير PDF
- **`src/app/api/reports/ai-pdf/route.ts`**:
  - POST مع `{ analysis, year, analysisType, institutionName }`
  - يحوّل Markdown إلى HTML مع دعم RTL وتنسيق احترافي
  - يدعم: العناوين، القوائم، الجداول، الاقتباسات، كتل الشيفرة، الروابط، العريض/المائل
  - يستخدم Playwright + Chromium لتحويل HTML إلى PDF
  - يحفظ في `download/reports/`
  - محمي بـ `requireAuth`
  - يرجع `{ filePath, fileName, downloadUrl, size }`
- **`src/app/api/download/route.ts`**:
  - GET مع `?file=<relative-path>`
  - يخدم الملفات من مجلد `download/`
  - يحدد Content-Type من الامتداد (PDF، Excel، صور، إلخ)
  - يعرض PDF/الصور inline والباقي attachment
  - حماية كاملة ضد Path Traversal (`..`، المسارات المطلقة، `:`، null bytes)
  - محمي بـ `requireAuth`

## الملفات المُحدَّثة

- **`src/app/layout.tsx`**:
  - لفّ children بـ `<ThemeProvider>`
  - أضاف `<PWARegister>` بجانب `<Toaster>`
  - أضاف في `<head>`: رابط manifest، وسم theme-color، apple-touch-icon، وسوم apple-mobile-web-app
  - استخدم Next.js Metadata و Viewport API للنسخ الحديثة
- **`src/app/page.tsx`**:
  - أضاف قسمين جديدين للقائمة: `platform-management` و `reports`
  - أضاف رأس سطح المكتب (header) بارتفاع 14 مع: InstallAppButton, NotificationsBell, ThemeToggle
  - حدّث رأس الجوال ليشمل نفس الأزرار الثلاثة
  - مرّر `isDirector`, `userName`, `onNavigate` إلى `DashboardStats`
  - أضاف عرض `ReportsSection` و `PlatformManagementSection` حسب القسم النشط
  - رتّب المحتوى الرئيسي ليأخذ بعين الاعتبار الرأس العلوي الجديد (`lg:pt-14`)

## الحزم المثبّتة
- `playwright` - لتحويل HTML إلى PDF عبر Chromium
- Chromium المثبّت في `/home/z/.cache/ms-playwright/chromium-1228/`

## التحقق
- ESLint: نجح بدون أخطاء (exit code 0)
- Dev server: يعمل على المنفذ 3000 بدون أخطاء تجميع
- جميع الأكواد تستخدم `'use client'` للمكونات التفاعلية و `requireAuth` للـ APIs
- تعليقات عربية متوافقة مع نمط الكود القائم
