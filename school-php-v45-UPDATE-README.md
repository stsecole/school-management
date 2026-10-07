# تحديث نسخة PHP إلى v45 — فلترة الفروع (Branch Scoping)

## 🎯 الهدف

منع الموظفين من رؤية بيانات الفروع الأخرى. كل موظف يرى فقط بيانات فرعه.
المدير يرى كل الفروع تلقائياً.

## 📦 محتويات التحديث (v45)

| الملف | التغييرات |
|---|---|
| `includes/auth.php` | إضافة `branch_id` للجلسة عند تسجيل الدخول + دوال `current_user_branch_id()`, `branch_filter()`, `branch_for_new_record()` |
| `dashboard.php` | فلترة الإحصائيات + عرض بانر يُظهر الفرع الحالي |
| `students.php` | فلترة الطلاب + فحص صلاحية الوصول/التعديل + محدد فرع للمدير |
| `finance.php` | فلترة student_payments و expenses و teachers (عبر JOIN) + محدد فرع للمصروفات |
| `attendance.php` | فلترة سجلات الحضور + ضبط branch_id تلقائياً عند الإنشاء |
| `registrations.php` | فلترة التسجيلات + قائمة الطلاب المُصفّاة |
| `teachers.php` | فلترة الأساتذة + محدد فرع للمدير |
| `tasks.php` | فلترة المهام + ضبط branch_id تلقائياً |
| `crm.php` | فلترة leads + ضبط branch_id تلقائياً |
| `exams.php` | فلترة الامتحانات + ضبط branch_id تلقائياً |
| `certificates.php` | فلترة الشهادات + ضبط branch_id تلقائياً |
| `reports.php` | فلترة كل الإحصائيات المالية والأكاديمية |
| `database.sql` | إضافة `branch_id` لـ leads, exams, documents, calendar_events, timetable_sessions, job_applications |
| `update-database.sql` | ALTER TABLE لإضافة branch_id للجداول المذكورة (آمن — لا يحذف بيانات) |

## 🚀 طريقة التطبيق على تثبيت v44 موجود

### 1. خذ نسخة احتياطية (إلزامي!)
```bash
mysqldump -u USER -p DATABASE > backup-before-v45.sql
```

### 2. تطبيق التحديث على قاعدة البيانات
استورد `update-database.sql` على قاعدة البيانات. سيقوم بـ:
- إضافة عمود `branch_id` لـ 6 جداول جديدة (leads, exams, documents, calendar_events, timetable_sessions, job_applications)
- إضافة فهارس للأداء
- لا يحذف أي بيانات

ملاحظة: قد تظهر أخطاء "Duplicate column name" إذا كانت بعض الأعمدة موجودة مسبقاً — تجاهلها.

### 3. رفع ملفات PHP المحدّثة
انسخ هذه الملفات إلى الخادم (استبدل الموجود):
```
includes/auth.php        → /path/to/school-php/includes/auth.php
dashboard.php            → /path/to/school-php/dashboard.php
students.php             → /path/to/school-php/students.php
finance.php              → /path/to/school-php/finance.php
attendance.php           → /path/to/school-php/attendance.php
registrations.php        → /path/to/school-php/registrations.php
teachers.php             → /path/to/school-php/teachers.php
tasks.php                → /path/to/school-php/tasks.php
crm.php                  → /path/to/school-php/crm.php
exams.php                → /path/to/school-php/exams.php
certificates.php         → /path/to/school-php/certificates.php
reports.php              → /path/to/school-php/reports.php
database.sql             → /path/to/school-php/database.sql (للأرشفة فقط)
update-database.sql      → (للتشغيل مرة واحدة فقط)
```

### 4. ⚠️ إعادة تسجيل الدخول (إلزامي)
الكود الجديد يخزّن `branch_id` في الجلسة عند تسجيل الدخول.
**يجب على كل المستخدمين تسجيل الخروج وإعادة تسجيل الدخول** لكي يُلتقط `branch_id` في الجلسة.
أفضل طريقة: إعادة تشغيل خدمة PHP-FPM أو إفراغ جلسات PHP.

### 5. تعيين الفروع للموظفين الحاليين
من `users.php` (كمدير):
1. اضغط ✏️ بجانب كل موظف
2. اختر الفرع من القائمة المنسدلة «الفرع»
3. احفظ
4. اطلب من الموظف تسجيل الخروج وإعادة الدخول

### 6. اختبار التحديث
- سجّل دخول كمدير → كل البيانات مرئية
- سجّل دخول كموظف بدور فرع «الفرع A» → يرى فقط طلاب وأساتذة ومصاريف الفرع A
- سجّل دخول كموظف بدون فرع → يرى فقط بيانات المقر الرئيسي (branch_id = NULL)
- شاهد البانر في `dashboard.php` يُظهر اسم الفرع الحالي

## 🛠️ الدوال الجديدة (في `includes/auth.php`)

```php
// يُرجع branch_id للمستخدم الحالي (null للمدير)
$branchId = current_user_branch_id();

// يبني شرط WHERE للتصفية حسب الفرع
// - للمدير: [null, []] — لا فلترة
// - لموظف بفرع: ['branch_id = ?', [branchId]]
// - لموظف بدون فرع: ['(branch_id IS NULL OR branch_id = "")', []]
[$whereClause, $params] = branch_filter();          // افتراضي: branch_id
[$whereClause, $params] = branch_filter('s.branch_id');  // مع alias
[$whereClause, $params] = branch_filter('sp.branch_id');

// يُرجع branch_id الذي يجب وضعه على سجل جديد ينشئه المستخدم
$branchId = branch_for_new_record();
// - المدير: null (ما لم يحدده في الفورم)
// - الموظف: فرعه المسجّل في الجلسة
```

### مثال استخدام:
```php
[$brClause, $brParams] = branch_filter('s.branch_id');

$sql = "SELECT s.* FROM students s WHERE 1=1";
$params = [];
if ($brClause) {
    $sql .= " AND $brClause";
    $params = array_merge($params, $brParams);
}
$students = $database->fetchAll($sql, $params);

// عند إنشاء سجل جديد:
$branchId = branch_for_new_record();
$database->execute(
    "INSERT INTO students (..., branch_id, ...) VALUES (..., ?, ...)",
    [..., $branchId, ...]
);
```

## 🌳 منطق الفلترة

| المستخدم | branch_id في الجلسة | ماذا يرى؟ |
|---|---|---|
| مدير (`role=director`) | `null` | كل السجلات من كل الفروع (لا فلترة) |
| موظف بفرع | `"br_123"` | السجلات التي `branch_id = 'br_123'` فقط |
| موظف بدون فرع | `null` | السجلات التي `branch_id IS NULL` (المقر الرئيسي) فقط |

عند إنشاء سجل جديد:
- المدير: يستخدم ما يحدده في الفورم (مع محدد «الفرع» الظاهر للمدير فقط)
- الموظف: يُختم السجل تلقائياً بـ branch_id من الجلسة

## 🔒 الحماية

- ✅ فلترة على مستوى SQL (لا يمكن تجاوزها من الواجهة)
- ✅ التحقق من الصلاحية قبل التعديل/الحذف (`canModify` في students.php, teachers.php)
- ✅ الموظف لا يمكنه رؤية قائمة الفروع في الفورم (المحدد يظهر للمدير فقط)
- ✅ الجلسة تُخزّن branch_id عند تسجيل الدخول — لا يمكن تزويره من جانب العميل
- ✅ شارة بانر في dashboard تُذكّر الموظف بأي فرع هو متصل

## 📋 الجداول المُفلترة (16 صفحة)

| الصفحة | الجداول المُفلترة |
|---|---|
| dashboard.php | students, teachers, student_payments, teacher_payments, expenses |
| students.php | students |
| finance.php | student_payments, expenses, teachers (via JOIN), students (dropdown), teacher_payments (via JOIN) |
| attendance.php | attendance, teachers (dropdown) |
| registrations.php | registrations, students (dropdown) |
| teachers.php | teachers |
| tasks.php | tasks |
| crm.php | leads |
| exams.php | exams |
| certificates.php | certificates, students (dropdown) |
| reports.php | students, teachers, attendance, tasks, student_payments, teacher_payments, expenses, leads |

الجداول المشاركة (المستوى):
- ℹ️ `departments`, `levels`, `courses`, `rooms`, `subjects`, `specializations` — عامة لكل الفروع (لا تُفلتر)
- ℹ️ `staff_payments` — عامة (رواتب موظفي المؤسسة عامة)
- ℹ️ `notifications`, `messages` — تُفلتر بـ user_id (مسبقاً)
- ℹ️ `activity_log` — تُفلتر بـ user_id (مسبقاً)

## ❓ الأسئلة الشائعة

**س: هل سيتغير سلوك المستخدمين الحاليين؟**
ج: نعم، يجب عليهم إعادة تسجيل الدخول. بعد ذلك:
- المدير: يرى كل شيء كما كان
- الموظف بدون فرع: سيرى فقط سجلات المقر الرئيسي (NULL branch_id)
- الموظف بدور فرع: سيرى فقط سجلات فرعه

**س: كيف أُعيد توجيه موظف إلى فرع معيّن؟**
ج: `users.php` → ✏️ → اختر الفرع → احفظ → اطلب منه تسجيل الخروج وإعادة الدخول.

**س: هل السجلات القديمة بدون branch_id ستظهر للموظفين؟**
ج: فقط للموظفين بدون فرع (المقر الرئيسي). أما الموظفون المرتبطون بفروع فلن يروا السجلات القديمة بدون branch_id.

**س: كيف أُعيّن branch_id للسجلات القديمة؟**
ج: يمكن إضافة استعلام SQL لتحديث السجلات القديمة بناءً على فرع الطالب/الأستاذ المرتبط. مثلاً:
```sql
UPDATE student_payments sp
JOIN students s ON sp.student_id = s.id
SET sp.branch_id = s.branch_id
WHERE sp.branch_id IS NULL;
```

**س: ماذا لو أنشأ موظف طالباً جديداً — أي فرع سيُعطى له؟**
ج: سيأخذ branch_id من جلسة الموظف تلقائياً (لا يحتاج لاختياره). المدير وحده يرى قائمة الفرع في الفورم.

**س: ماذا عن `notifications.php` و `messages.php`؟**
ج: لا تحتاج لفلترة حسب branch_id لأنها مرتبطة بـ user_id مسبقاً — كل مستخدم يرى إشعاراته ورسائله فقط.
