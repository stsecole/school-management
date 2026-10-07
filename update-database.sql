-- ============================================================
-- update-database.sql — ترقية قاعدة البيانات الموجودة لدعم RBAC
-- ============================================================
-- هذا الملف يُشغَّل على قاعدة بيانات MySQL/MariaDB موجودة
-- لإضافة الحقول والجداول الجديدة المطلوبة لإصدار v44
--
-- كيفية التشغيل:
--   عبر phpMyAdmin: استورد هذا الملف في قاعدة البيانات الموجودة
--   أو عبر سطر الأوامر:
--     mysql -u USER -p DATABASE < update-database.sql
--
-- آمن: لا يحذف أي بيانات. كل الأعمدة الجديدة تكون NULL أو لها قيمة افتراضية.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ===== 1. إضافة أعمدة جديدة لجدول users =====
-- role_id: ربط المستخدم بدور مخصص (RBAC)
ALTER TABLE `users` ADD COLUMN `role_id` VARCHAR(255) NULL AFTER `role`;
-- can_manage_timetable: صلاحية إدارة الجدول الأسبوعي للموظف
ALTER TABLE `users` ADD COLUMN `can_manage_timetable` TINYINT(1) DEFAULT 0 AFTER `branch_id`;
-- security_question/answer: استرجاع كلمة المرور
ALTER TABLE `users` ADD COLUMN `security_question` VARCHAR(255) NULL AFTER `can_manage_timetable`;
ALTER TABLE `users` ADD COLUMN `security_answer` VARCHAR(255) NULL AFTER `security_question`;

-- فهارس للأداء
ALTER TABLE `users` ADD INDEX `idx_users_role_id` (`role_id`);
ALTER TABLE `users` ADD INDEX `idx_users_branch_id` (`branch_id`);

-- ===== 2. التأكد من وجود جدول roles و role_permissions =====
CREATE TABLE IF NOT EXISTS `roles` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `description` TEXT NULL,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` VARCHAR(255) PRIMARY KEY,
  `role_id` VARCHAR(255) NOT NULL,
  `section` VARCHAR(100) NOT NULL,
  `can_view` TINYINT(1) DEFAULT 0,
  `can_create` TINYINT(1) DEFAULT 0,
  `can_edit` TINYINT(1) DEFAULT 0,
  `can_delete` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_role_section` (`role_id`, `section`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 3. ترقية الأدوار الافتراضية القديمة إلى الأدوار الجديدة =====
-- (دور "مدير" → "مدير عام"، دور "موظف" → "موظف عادي")
UPDATE `roles` SET `name` = 'مدير عام', `description` = 'صلاحيات كاملة على كل النظام' WHERE `id` = 'role_dir' AND `name` = 'مدير';
UPDATE `roles` SET `name` = 'موظف عادي', `description` = 'صلاحيات محدودة' WHERE `id` = 'role_emp' AND `name` = 'موظف';

-- ===== 4. إضافة الأدوار الافتراضية الجديدة (إذا لم تكن موجودة) =====
INSERT INTO `roles` (`id`, `name`, `description`, `is_system`) VALUES
('role_dir', 'مدير عام',       'صلاحيات كاملة على كل النظام', 1),
('role_rec', 'موظف استقبال',    'إدارة التسجيلات والعملاء المحتملين', 1),
('role_acc', 'محاسب',           'إدارة القسم المالي فقط', 1),
('role_tch', 'أستاذ',           'عرض الطلاب والحضور والمهام الخاصة به', 1),
('role_emp', 'موظف عادي',       'صلاحيات محدودة', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `is_system` = VALUES(`is_system`);

-- ===== 5. إدراج صلاحيات افتراضية للأدوار الجديدة =====
-- (INSERT IGNORE حتى لا نكتب فوق تخصيصات المستخدم)

-- موظف استقبال
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_rec_01', 'role_rec', 'dashboard',      1, 1, 1, 0),
('rp_rec_02', 'role_rec', 'students',       1, 1, 1, 0),
('rp_rec_03', 'role_rec', 'registrations',  1, 1, 1, 0),
('rp_rec_04', 'role_rec', 'crm',            1, 1, 1, 0),
('rp_rec_05', 'role_rec', 'whatsapp',       1, 1, 0, 0),
('rp_rec_06', 'role_rec', 'notifications',  1, 1, 0, 0),
('rp_rec_07', 'role_rec', 'calendar',       1, 1, 0, 0),
('rp_rec_08', 'role_rec', 'attendance',     1, 1, 0, 0),
('rp_rec_09', 'role_rec', 'tasks',          1, 1, 0, 0);

-- محاسب
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_acc_01', 'role_acc', 'dashboard',      1, 1, 1, 0),
('rp_acc_02', 'role_acc', 'finance',         1, 1, 1, 1),
('rp_acc_03', 'role_acc', 'reports',         1, 1, 0, 0),
('rp_acc_04', 'role_acc', 'students',        1, 0, 0, 0),
('rp_acc_05', 'role_acc', 'notifications',  1, 0, 0, 0),
('rp_acc_06', 'role_acc', 'calendar',        1, 0, 0, 0);

-- أستاذ
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_tch_01', 'role_tch', 'dashboard',      1, 1, 1, 0),
('rp_tch_02', 'role_tch', 'students',        1, 0, 0, 0),
('rp_tch_03', 'role_tch', 'attendance',      1, 1, 1, 0),
('rp_tch_04', 'role_tch', 'tasks',           1, 1, 0, 0),
('rp_tch_05', 'role_tch', 'exams',           1, 1, 1, 0),
('rp_tch_06', 'role_tch', 'notifications',  1, 0, 0, 0),
('rp_tch_07', 'role_tch', 'calendar',        1, 0, 0, 0);

-- موظف عادي
INSERT IGNORE INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_emp_01', 'role_emp', 'dashboard',      1, 0, 0, 0),
('rp_emp_02', 'role_emp', 'notifications',  1, 0, 0, 0),
('rp_emp_03', 'role_emp', 'calendar',        1, 0, 0, 0);

SET FOREIGN_KEY_CHECKS = 1;

-- ===== 6. تحديث admin ليكون مدير =====
-- المستخدم admin_001 يبقى مدير، ونتأكد من أن role = 'director'
UPDATE `users` SET `role` = 'director' WHERE `username` = 'admin' OR `id` = 'admin_001';

-- ===== 7. إضافة branch_id للجداول التي لم تكن تملكه =====
-- هذه الجداول تحتاج تصفية حسب الفرع
--
-- ملاحظة: عبارات ALTER TABLE التالية قد تفشل إذا كان العمود موجوداً مسبقاً
-- (في الإصدارات الأقدم من v44). تجاهل أخطاء "Duplicate column name".

-- leads (العملاء المحتملون)
ALTER TABLE `leads` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `leads` ADD INDEX `idx_leads_branch_id` (`branch_id`);

-- exams (الامتحانات)
ALTER TABLE `exams` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `exams` ADD INDEX `idx_exams_branch_id` (`branch_id`);

-- documents (المستندات)
ALTER TABLE `documents` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `documents` ADD INDEX `idx_documents_branch_id` (`branch_id`);

-- calendar_events (أحداث التقويم)
ALTER TABLE `calendar_events` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `calendar_events` ADD INDEX `idx_calendar_events_branch_id` (`branch_id`);

-- timetable_sessions (حصص الجدول الأسبوعي)
ALTER TABLE `timetable_sessions` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `timetable_sessions` ADD INDEX `idx_timetable_sessions_branch_id` (`branch_id`);

-- job_applications (طلبات العمل)
ALTER TABLE `job_applications` ADD COLUMN `branch_id` VARCHAR(255) NULL AFTER `id`;
ALTER TABLE `job_applications` ADD INDEX `idx_job_applications_branch_id` (`branch_id`);

-- ===== 8. تفعيل الجلسة بـ branch_id عند تسجيل الدخول =====
-- هذا يتطلب تسجيل خروج وإعادة تسجيل دخول لكل المستخدمين الحاليين.
-- لا توجد عملية SQL مطلوبة — الكود في includes/auth.php يتكفّل بذلك.

SET FOREIGN_KEY_CHECKS = 1;
