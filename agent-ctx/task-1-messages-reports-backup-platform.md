# Task: Messages, Reports, Backup, and Platform Management Sections

## ملخص المهمة

تم إنشاء واجهات برمجة التطبيقات (APIs) والمكونات (Components) الأربعة المطلوبة لنظام إدارة المدرسة.

## الملفات المنشأة

### 1. وحدة الرسائل (Messages)
- **`src/app/api/messages/route.ts`**: 
  - `GET`: يجلب الرسائل (inbox أو sent) - الوارد = recipientId=user.id أو (recipientId=null AND senderRole='director')
  - `POST`: إرسال رسالة - المدير يرسل لأي شخص أو للجميع، الموظف يرسل للمدير فقط. ينشئ إشعاراً للمستلم.
- **`src/app/api/messages/read/route.ts`**:
  - `POST`: تعليم رسالة كمقروءة (مع readAt)
  - `DELETE`: حذف رسالة (المدير يحذف أي رسالة، الموظف يحذف رسائله فقط)
- **`src/components/sections/messages-section.tsx`**: واجهة كاملة بتبويبات (inbox/sent)، بحث، نافذة إنشاء، نافذة عرض، أزرار رد وحذف. RTL عربي.

### 2. وحدة التقارير (Reports)
- **`src/app/api/reports/comprehensive/route.ts`**: 
  - `GET` مع بارامتر year
  - يرجع: general stats, departments, financial (للمدير: income, expenses, monthly, year comparison, top paying students), attendance by month, tasks with employeeRanking, registrations by month, installments stats
  - يستخدم Promise.all للاستعلامات المتوازية
- **`src/app/api/reports/ai-analysis/route.ts`**:
  - `POST` مع year, analysisType (full|financial|tasks|attendance)
  - يستخدم z-ai-web-dev-sdk LLM مع system prompt عربي
  - يحتوي على دالة fallback تحليلية احتياطية في حال فشل النموذج
- **`src/components/sections/reports-section.tsx`**: 5 تبويبات (overview, financial, attendance, tasks, ai) مع رسوم بيانية بسيطة CSS، ترتيب موظفين، أزرار تصدير Markdown.

### 3. وحدة النسخ الاحتياطية (Backup)
- **`src/app/api/backup/run/route.ts`**: 
  - `POST` (director only): يضغط db/custom.db بصيغة gzip، يحفظ في download/backups/، يحتفظ بآخر 10 نسخ فقط، ينشئ ملف بيانات وصفية
- **`src/app/api/backup/list/route.ts`**: 
  - `GET` (director only): قائمة النسخ مع الحجم والإحصائيات
- **`src/components/sections/backup-section.tsx`**: بطاقات إحصائية، زر إنشاء نسخة، قائمة مع روابط تنزيل.

### 4. وحدة إدارة المنصة (Platform Management)
- **`src/components/sections/platform-management-section.tsx`**: شبكة بلاطات منظمة في 4 مجموعات (أكاديمية، متابعة، مالية، نظام) مع شارة "مدير" للأقسام الحساسة. Props: `{ isDirector, onNavigate }`.

## الاختبارات

### نتائج Lint
- `bun run lint` → EXIT_CODE=0 (نجاح)

### اختبارات API (مع curl)
تم اختبار جميع نقاط النهاية:

| Endpoint | Method | Status (no auth) | Status (with auth) |
|----------|--------|------------------|---------------------|
| /api/messages | GET | 401 | 200 |
| /api/messages | POST | 401 | 201 |
| /api/messages/read | POST | 401 | 200 |
| /api/messages/read | DELETE | 401 | 200 |
| /api/reports/comprehensive | GET | 401 | 200 |
| /api/reports/ai-analysis | POST | 401 | 200 (13.7s) |
| /api/backup/run | POST | 401 | 200 |
| /api/backup/list | GET | 401 | 200 |

### النسخ الاحتياطي
- تم إنشاء نسخة بنجاح بحجم 35,988 بايت (مضغوطة من 344,064 بايت - نسبة ضغط 90%)
- تم إنشاء ملف البيانات الوصفية بنجاح مع إحصائيات قاعدة البيانات

### تحليل الذكاء الاصطناعي
- نجح الاتصال بنموذج الذكاء الاصطناعي (z-ai-web-dev-sdk)
- تم توليد تحليل شامل بالعربية يتضمن: نظرة عامة، نقاط الضعف، أداء الموظفين، مقارنات، توصيات
- استغرق التحليل 13.7 ثانية

## القيود الفنية المطبقة

1. **requireAuth()**: جميع APIs تتطلب مصادقة
2. **requireDirector()**: APIs النسخ الاحتياطي والمالية تتطلب صلاحية المدير
3. **z-ai-web-dev-sdk**: مستخدم في الخادم فقط (server-side)
4. **DB**: استخدام `db` من `@/lib/db` (Prisma client)
5. **مسارات نسبية**: جميع الـ fetches تستخدم مسارات نسبية (`/api/...`)
6. **'use client'**: جميع المكونات تحتوي على هذا التوجيه
7. **RTL عربي**: كل المكونات بدعم العربية واتجاه RTL
8. **shadcn/ui**: استخدام المكونات الموجودة في `src/components/ui/`
9. **CSS bars**: رسوم بيانية بسيطة باستخدام CSS (no recharts)

## التاريخ
- أنشئ في: 2026-06-29
- الملفات: 10 ملفات جديدة
