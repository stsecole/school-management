-- ============================================
-- School Management System - MySQL Database
-- ============================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(255) PRIMARY KEY,
  `username` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) DEFAULT 'employee',
  `role_id` VARCHAR(255) NULL,
  `branch_id` VARCHAR(255) NULL,
  `can_manage_timetable` TINYINT(1) DEFAULT 0,
  `security_question` VARCHAR(255) NULL,
  `security_answer` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_users_role_id` (`role_id`),
  INDEX `idx_users_branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branches` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `code` VARCHAR(50) UNIQUE NULL,
  `receipt_prefix` VARCHAR(10) NULL,
  `address` TEXT NULL,
  `phone` VARCHAR(50) NULL,
  `manager_name` VARCHAR(255) NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `departments` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `code` VARCHAR(50) NULL,
  `description` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teachers` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `gender` VARCHAR(10) NULL,
  `specialty` VARCHAR(255) NULL,
  `department_id` VARCHAR(255) NULL,
  `salary` DECIMAL(10,2) DEFAULT 0,
  `hire_date` DATE NULL,
  `status` VARCHAR(50) DEFAULT 'active',
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `students` (
  `id` VARCHAR(255) PRIMARY KEY,
  `student_number` VARCHAR(100) NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `gender` VARCHAR(10) NULL,
  `birth_date` DATE NULL,
  `address` TEXT NULL,
  `department_id` VARCHAR(255) NULL,
  `specialty` VARCHAR(255) NULL,
  `total_amount` DECIMAL(10,2) NULL,
  `initial_payment` DECIMAL(10,2) DEFAULT 0,
  `registration_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) DEFAULT 'registered',
  `notes` TEXT NULL,
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `student_payments` (
  `id` VARCHAR(255) PRIMARY KEY,
  `receipt_number` VARCHAR(100) UNIQUE NOT NULL,
  `student_id` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_type` VARCHAR(50) DEFAULT 'installment',
  `payment_label` VARCHAR(100) NULL,
  `payment_date` DATETIME NOT NULL,
  `payment_method` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `branch_id` VARCHAR(255) NULL,
  `is_cancelled` TINYINT(1) DEFAULT 0,
  `cancelled_at` DATETIME NULL,
  `cancel_reason` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_payments` (
  `id` VARCHAR(255) PRIMARY KEY,
  `receipt_number` VARCHAR(100) UNIQUE NOT NULL,
  `teacher_id` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `month` VARCHAR(20) NOT NULL,
  `payment_date` DATETIME NOT NULL,
  `payment_type` VARCHAR(50) DEFAULT 'salary',
  `notes` TEXT NULL,
  `is_cancelled` TINYINT(1) DEFAULT 0,
  `cancelled_at` DATETIME NULL,
  `cancel_reason` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_payments` (
  `id` VARCHAR(255) PRIMARY KEY,
  `staff_name` VARCHAR(255) NOT NULL,
  `staff_role` VARCHAR(255) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `month` VARCHAR(20) NULL,
  `note` TEXT NULL,
  `receipt_number` VARCHAR(100) UNIQUE NULL,
  `is_cancelled` TINYINT(1) DEFAULT 0,
  `cancelled_at` DATETIME NULL,
  `cancel_reason` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(255) PRIMARY KEY,
  `date` DATETIME NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `branch_id` VARCHAR(255) NULL,
  `is_cancelled` TINYINT(1) DEFAULT 0,
  `cancelled_at` DATETIME NULL,
  `cancel_reason` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance` (
  `id` VARCHAR(255) PRIMARY KEY,
  `date` DATETIME NOT NULL,
  `course_name` VARCHAR(255) NOT NULL,
  `level` VARCHAR(100) NULL,
  `teacher_id` VARCHAR(255) NULL,
  `teacher_name` VARCHAR(255) NULL,
  `total_count` INT DEFAULT 0,
  `male_count` INT DEFAULT 0,
  `female_count` INT DEFAULT 0,
  `duration_minutes` INT DEFAULT 0,
  `notes` TEXT NULL,
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(255) PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `priority` VARCHAR(50) DEFAULT 'medium',
  `responsible` VARCHAR(255) NULL,
  `deadline` DATE NULL,
  `completed` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'pending',
  `notes` TEXT NULL,
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id` VARCHAR(255) PRIMARY KEY,
  `key_name` VARCHAR(255) UNIQUE NOT NULL,
  `value` TEXT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'info',
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `student_id` VARCHAR(255) NULL,
  `student_name` VARCHAR(255) NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size` INT NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `uploaded_by` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NULL,
  `user_name` VARCHAR(255) NULL,
  `action` VARCHAR(100) NOT NULL,
  `module` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `target_type` VARCHAR(100) NULL,
  `target_id` VARCHAR(255) NULL,
  `ip_address` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_applications` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `birth_date` DATE NULL,
  `phone` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `diploma` VARCHAR(255) NULL,
  `experience` TEXT NULL,
  `schedule` VARCHAR(20) DEFAULT 'full-time',
  `cv_url` VARCHAR(500) NULL,
  `diploma_url` VARCHAR(500) NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `applied_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificates` (
  `id` VARCHAR(255) PRIMARY KEY,
  `student_id` VARCHAR(255) NULL,
  `student_name` VARCHAR(255) NOT NULL,
  `specialization` VARCHAR(100) NOT NULL,
  `certificate_number` VARCHAR(100) NULL,
  `delivery_date` DATE NULL,
  `notes` TEXT NULL,
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leads` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `phone2` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `gender` VARCHAR(10) NULL,
  `source` VARCHAR(100) DEFAULT 'أخرى',
  `desired_course` VARCHAR(255) NULL,
  `status` VARCHAR(50) DEFAULT 'new',
  `interest_level` VARCHAR(20) DEFAULT 'medium',
  `notes` TEXT NULL,
  `first_contact_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `next_follow_up_date` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exams` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,
  `exam_date` DATETIME NOT NULL,
  `max_score` DECIMAL(5,2) DEFAULT 20,
  `passing_score` DECIMAL(5,2) DEFAULT 10,
  `term` VARCHAR(20) DEFAULT 'first',
  `status` VARCHAR(50) DEFAULT 'scheduled',
  `department_id` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grades` (
  `id` VARCHAR(255) PRIMARY KEY,
  `exam_id` VARCHAR(255) NOT NULL,
  `student_id` VARCHAR(255) NOT NULL,
  `score` DECIMAL(5,2) NULL,
  `is_absent` TINYINT(1) DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_exam_student` (`exam_id`, `student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `type` VARCHAR(50) DEFAULT 'event',
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NULL,
  `color` VARCHAR(20) DEFAULT '#0f766e',
  `location` VARCHAR(255) NULL,
  `created_by` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `employee_timesheets` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `date` DATE NOT NULL,
  `check_in1` VARCHAR(10) NULL,
  `check_out1` VARCHAR(10) NULL,
  `check_in2` VARCHAR(10) NULL,
  `check_out2` VARCHAR(10) NULL,
  `total_hours` DECIMAL(5,2) DEFAULT 0,
  `regular_hours` DECIMAL(5,2) DEFAULT 0,
  `overtime_hours` DECIMAL(5,2) DEFAULT 0,
  `sick_hours` DECIMAL(5,2) DEFAULT 0,
  `leave_hours` DECIMAL(5,2) DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'present',
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` VARCHAR(255) PRIMARY KEY,
  `sender_id` VARCHAR(255) NOT NULL,
  `sender_name` VARCHAR(255) NULL,
  `sender_role` VARCHAR(50) NULL,
  `receiver_id` VARCHAR(255) NULL,
  `receiver_name` VARCHAR(255) NULL,
  `subject` VARCHAR(500) NOT NULL,
  `content` TEXT NOT NULL,
  `priority` VARCHAR(20) DEFAULT 'normal',
  `is_read` TINYINT(1) DEFAULT 0,
  `read_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `timetable_sessions` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NULL,
  `day_of_week` INT NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `teacher_id` VARCHAR(255) NULL,
  `teacher_name` VARCHAR(255) NULL,
  `room_name` VARCHAR(255) NULL,
  `group_name` VARCHAR(255) NULL,
  `subject_name` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `color` VARCHAR(20) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` VARCHAR(255) PRIMARY KEY,
  `recipient_phone` VARCHAR(50) NOT NULL,
  `recipient_name` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `template_name` VARCHAR(100) NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `sent_at` DATETIME NULL,
  `sent_by` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whatsapp_templates` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `category` VARCHAR(100) DEFAULT 'general',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_chat_history` (
  `id` VARCHAR(255) PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL,
  `content` TEXT NOT NULL,
  `category` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branch_stats` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NOT NULL,
  `branch_name` VARCHAR(255) NOT NULL,
  `students_count` INT DEFAULT 0,
  `teachers_count` INT DEFAULT 0,
  `total_income` DECIMAL(10,2) DEFAULT 0,
  `total_expense` DECIMAL(10,2) DEFAULT 0,
  `balance` DECIMAL(10,2) DEFAULT 0,
  `last_sync_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_branch` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Default Admin (password: admin123)
-- ============================================
INSERT INTO `users` (`id`, `username`, `password`, `name`, `role`) VALUES
('admin_001', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'المدير العام', 'director')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- WhatsApp Templates
INSERT INTO `whatsapp_templates` (`id`, `name`, `content`, `category`) VALUES
('tpl_001', 'تذكير بدفعة', 'مرحباً {name}، نذكركم بأن دفعة هذا الشهر مستحقة بقيمة {amount} دج. يرجى الحضور لتسوية الوضع. شكراً.', 'payments'),
('tpl_002', 'إشعار غياب', 'مرحباً {name}، الطالب {student} تغيب اليوم عن الدورة. نرجو التواصل مع الإدارة.', 'attendance'),
('tpl_003', 'ترحيب طالب جديد', 'أهلاً وسهلاً بك {name} في مؤسستنا التعليمية. نتمنى لك مساراً موفقاً.', 'welcome')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- ============================================
-- Additional Tables (Phase 2)
-- ============================================

-- ===== Specializations =====
CREATE TABLE IF NOT EXISTS `specializations` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `department_id` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Levels =====
CREATE TABLE IF NOT EXISTS `levels` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `order_num` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Courses =====
CREATE TABLE IF NOT EXISTS `courses` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NULL,
  `department_id` VARCHAR(255) NULL,
  `level_id` VARCHAR(255) NULL,
  `teacher_id` VARCHAR(255) NULL,
  `price` DECIMAL(10,2) DEFAULT 0,
  `duration` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Installment Plans =====
CREATE TABLE IF NOT EXISTS `installment_plans` (
  `id` VARCHAR(255) PRIMARY KEY,
  `student_id` VARCHAR(255) NOT NULL,
  `month_number` INT NOT NULL,
  `expected_amount` DECIMAL(10,2) NOT NULL,
  `paid_amount` DECIMAL(10,2) DEFAULT 0,
  `expected_date` DATE NOT NULL,
  `paid_date` DATE NULL,
  `status` VARCHAR(50) DEFAULT 'pending',
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Registrations =====
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` VARCHAR(255) PRIMARY KEY,
  `student_id` VARCHAR(255) NOT NULL,
  `course_id` VARCHAR(255) NULL,
  `course_name` VARCHAR(255) NOT NULL,
  `level` VARCHAR(100) NULL,
  `specialty` VARCHAR(255) NULL,
  `date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `note` TEXT NULL,
  `photo_url` VARCHAR(500) NULL,
  `branch_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Rooms =====
CREATE TABLE IF NOT EXISTS `rooms` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `capacity` INT DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Groups =====
CREATE TABLE IF NOT EXISTS `groups` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `department_id` VARCHAR(255) NULL,
  `level_id` VARCHAR(255) NULL,
  `student_count` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Subjects =====
CREATE TABLE IF NOT EXISTS `subjects` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NULL,
  `department_id` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Time Slots =====
CREATE TABLE IF NOT EXISTS `time_slots` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `day_of_week` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Holidays =====
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NULL,
  `is_recurring` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Work Settings =====
CREATE TABLE IF NOT EXISTS `work_settings` (
  `id` VARCHAR(255) PRIMARY KEY,
  `work_days` VARCHAR(100) DEFAULT '0,1,2,3,4',
  `start_time` VARCHAR(10) DEFAULT '08:00',
  `end_time` VARCHAR(10) DEFAULT '18:00',
  `slot_duration` INT DEFAULT 120,
  `break_start` VARCHAR(10) DEFAULT '12:00',
  `break_end` VARCHAR(10) DEFAULT '14:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Lead Follow-ups =====
CREATE TABLE IF NOT EXISTS `lead_followups` (
  `id` VARCHAR(255) PRIMARY KEY,
  `lead_id` VARCHAR(255) NOT NULL,
  `follow_up_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `follow_up_type` VARCHAR(50) DEFAULT 'call',
  `notes` TEXT NULL,
  `next_follow_up_date` DATETIME NULL,
  `created_by` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Roles =====
CREATE TABLE IF NOT EXISTS `roles` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) UNIQUE NOT NULL,
  `description` TEXT NULL,
  `is_system` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Role Permissions =====
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

-- ===== WhatsApp Settings =====
CREATE TABLE IF NOT EXISTS `whatsapp_settings` (
  `id` VARCHAR(255) PRIMARY KEY,
  `api_url` VARCHAR(500) NULL,
  `api_token` VARCHAR(500) NULL,
  `phone_number` VARCHAR(50) NULL,
  `is_active` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Institution Settings =====
CREATE TABLE IF NOT EXISTS `institution_settings` (
  `id` VARCHAR(255) PRIMARY KEY,
  `key_name` VARCHAR(255) UNIQUE NOT NULL,
  `value` TEXT,
  `is_public` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Receipt Settings =====
CREATE TABLE IF NOT EXISTS `receipt_settings` (
  `id` VARCHAR(255) PRIMARY KEY,
  `header_text` VARCHAR(500) NULL,
  `footer_text` VARCHAR(500) NULL,
  `logo_url` VARCHAR(500) NULL,
  `stamp_url` VARCHAR(500) NULL,
  `paper_size` VARCHAR(10) DEFAULT 'A5',
  `show_signature` TINYINT(1) DEFAULT 1,
  `show_stamp` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Central Sync Log =====
CREATE TABLE IF NOT EXISTS `central_sync_log` (
  `id` VARCHAR(255) PRIMARY KEY,
  `branch_id` VARCHAR(255) NOT NULL,
  `branch_name` VARCHAR(255) NULL,
  `sync_type` VARCHAR(50) DEFAULT 'full',
  `records_count` INT DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'success',
  `error_message` TEXT NULL,
  `started_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Print Logs =====
CREATE TABLE IF NOT EXISTS `print_logs` (
  `id` VARCHAR(255) PRIMARY KEY,
  `receipt_type` VARCHAR(50) NOT NULL,
  `receipt_id` VARCHAR(255) NULL,
  `receipt_number` VARCHAR(100) NULL,
  `printed_by` VARCHAR(255) NULL,
  `print_count` INT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Import History =====
CREATE TABLE IF NOT EXISTS `import_history` (
  `id` VARCHAR(255) PRIMARY KEY,
  `import_type` VARCHAR(50) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `records_total` INT DEFAULT 0,
  `records_success` INT DEFAULT 0,
  `records_failed` INT DEFAULT 0,
  `error_details` TEXT NULL,
  `imported_by` VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Seed Data
-- ============================================

-- Departments
INSERT INTO `departments` (`id`, `name`, `code`, `description`, `has_installments`, `installment_months`, `default_monthly_amount`) VALUES
('dept_ts', 'تقني سامي - إعلام آلي', 'TS-INFO', 'تقني سامي في الإعلام الآلي', 1, 30, 5000),
('dept_med', 'تقني سامي - طبي', 'TS-MED', 'تقني سامي طبي - تمريض', 1, 30, 6000),
('dept_lang', 'لغات أجنبية', 'LANG', 'قسم اللغات', 0, NULL, NULL),
('dept_support', 'الدعم المدرسي', 'SUPPORT', 'دعم وتوجيه التلاميذ', 0, NULL, NULL)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Specializations
INSERT INTO `specializations` (`id`, `name`, `department_id`) VALUES
('spec_ts_info', 'إعلام آلي', 'dept_ts'),
('spec_ts_med', 'تمريض', 'dept_med'),
('spec_lang_en', 'لغة إنجليزية', 'dept_lang'),
('spec_lang_fr', 'لغة فرنسية', 'dept_lang'),
('spec_support_prim', 'ابتدائي', 'dept_support'),
('spec_support_mid', 'متوسط', 'dept_support')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Levels
INSERT INTO `levels` (`id`, `name`, `order_num`) VALUES
('lvl_1', 'المستوى الأول', 1),
('lvl_2', 'المستوى الثاني', 2),
('lvl_3', 'المستوى الثالث', 3)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Courses
INSERT INTO `courses` (`id`, `name`, `code`, `department_id`, `price`) VALUES
('course_1', 'أساسيات الإعلام الآلي', 'INFO-101', 'dept_ts', 5000),
('course_2', 'البرمجة بلغة C', 'INFO-102', 'dept_ts', 5000),
('course_3', 'قواعد البيانات', 'INFO-103', 'dept_ts', 5000),
('course_4', 'التمريض الأساسي', 'MED-101', 'dept_med', 6000),
('course_5', 'الإسعافات الأولية', 'MED-102', 'dept_med', 6000),
('course_6', 'اللغة الإنجليزية A1', 'ENG-A1', 'dept_lang', 3000),
('course_7', 'اللغة الفرنسية A1', 'FR-A1', 'dept_lang', 3000),
('course_8', 'دعم الرياضيات', 'MATH-P', 'dept_support', 2500)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Rooms
INSERT INTO `rooms` (`id`, `name`, `capacity`, `notes`) VALUES
('room_1', 'قاعة 1', 30, 'الطابق الأرضي'),
('room_2', 'قاعة 2', 25, 'الطابق الأول'),
('room_3', 'قاعة المعلوماتية', 20, 'مجهزة بحواسيب'),
('room_4', 'قاعة المحاضرات', 50, 'مجهزة بجهاز عرض')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Subjects
INSERT INTO `subjects` (`id`, `name`, `code`, `department_id`) VALUES
('subj_1', 'البرمجة بلغة C', 'PROG-C', 'dept_ts'),
('subj_2', 'قواعد البيانات', 'DB-101', 'dept_ts'),
('subj_3', 'علم التشريح', 'ANAT-101', 'dept_med'),
('subj_4', 'الإسعافات الأولية', 'FIRST-AID', 'dept_med'),
('subj_5', 'اللغة الإنجليزية', 'ENG', 'dept_lang'),
('subj_6', 'اللغة الفرنسية', 'FR', 'dept_lang'),
('subj_7', 'الرياضيات', 'MATH', 'dept_support')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Teachers (10)
INSERT INTO `teachers` (`id`, `name`, `email`, `phone`, `gender`, `specialty`, `department_id`, `salary`, `hire_date`, `status`) VALUES
('t1', 'أحمد بن علي', 'ahmed@school.dz', '0551234567', 'male', 'إعلام آلي', 'dept_ts', 45000, '2022-09-01', 'active'),
('t2', 'فاطمة الزهراء', 'fatima@school.dz', '0552345678', 'female', 'تمريض', 'dept_med', 50000, '2021-09-15', 'active'),
('t3', 'محمد الأمين', 'mohamed@school.dz', '0553456789', 'male', 'إنجليزية', 'dept_lang', 38000, '2023-01-10', 'active'),
('t4', 'سارة بوزيد', 'sara@school.dz', '0554567890', 'female', 'فرنسية', 'dept_lang', 38000, '2022-10-01', 'active'),
('t5', 'خالد مرابط', 'khaled@school.dz', '0555678901', 'male', 'رياضيات', 'dept_support', 35000, '2023-09-01', 'active')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Students (10)
INSERT INTO `students` (`id`, `student_number`, `name`, `email`, `phone`, `gender`, `birth_date`, `department_id`, `level_id`, `specialization_id`, `specialty`, `course_start_date`, `total_amount`, `initial_payment`, `status`, `doc_photos`, `doc_birth_cert`, `doc_id_card`) VALUES
('s1', 'STU-2026-001', 'أمين بوزيد', 'amine@email.dz', '0661234567', 'male', '2003-05-15', 'dept_ts', 'lvl_1', 'spec_ts_info', 'إعلام آلي', '2026-09-01', 150000, 30000, 'registered', 1, 1, 1),
('s2', 'STU-2026-002', 'سارة مرابط', 'sara@email.dz', '0662345678', 'female', '2002-08-20', 'dept_med', 'lvl_1', 'spec_ts_med', 'تمريض', '2026-09-01', 180000, 40000, 'registered', 1, 1, 1),
('s3', 'STU-2026-003', 'يوسف حمداني', 'yousef@email.dz', '0663456789', 'male', '2003-01-10', 'dept_ts', 'lvl_1', 'spec_ts_info', 'إعلام آلي', '2026-09-01', 150000, 25000, 'registered', 1, 1, 0),
('s4', 'STU-2026-004', 'فاطمة بن خالد', 'fatima@email.dz', '0664567890', 'female', '2004-03-22', 'dept_lang', 'lvl_1', 'spec_lang_en', 'إنجليزية', '2026-09-15', 36000, 12000, 'registered', 1, 0, 1),
('s5', 'STU-2026-005', 'محمد إسلام', 'mohamed@email.dz', '0665678901', 'male', '2003-11-05', 'dept_ts', 'lvl_2', 'spec_ts_info', 'إعلام آلي', '2025-09-01', 150000, 35000, 'continuing', 1, 1, 1),
('s6', 'STU-2026-006', 'خديجة لعروسي', 'khadija@email.dz', '0666789012', 'female', '2002-07-18', 'dept_med', 'lvl_2', 'spec_ts_med', 'تمريض', '2025-09-01', 180000, 50000, 'continuing', 1, 1, 1),
('s7', 'STU-2026-007', 'عبد الله قمري', 'abdallah@email.dz', '0667890123', 'male', '2003-09-30', 'dept_lang', 'lvl_1', 'spec_lang_fr', 'فرنسية', '2026-10-01', 36000, 6000, 'registered', 1, 1, 0),
('s8', 'STU-2026-008', 'نسرين بوعلام', 'nasrine@email.dz', '0668901234', 'female', '2004-02-14', 'dept_support', 'lvl_1', 'spec_support_prim', 'دعم ابتدائي', '2026-09-10', 30000, 10000, 'registered', 1, 1, 1),
('s9', 'STU-2026-009', 'مريم بلقاسم', 'meryem@email.dz', '0660123456', 'female', '2002-12-08', 'dept_med', 'lvl_1', 'spec_ts_med', 'تمريض', '2026-09-01', 180000, 45000, 'registered', 1, 1, 1),
('s10', 'STU-2026-010', 'وليد بوزيد', 'walid@email.dz', '0671234567', 'male', '2003-07-22', 'dept_ts', 'lvl_3', 'spec_ts_info', 'إعلام آلي', '2024-09-01', 150000, 50000, 'continuing', 1, 1, 1)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Student Payments
INSERT INTO `student_payments` (`id`, `receipt_number`, `student_id`, `amount`, `payment_type`, `payment_label`, `payment_date`, `payment_method`, `is_cancelled`) VALUES
('p1', 'W-2001', 's1', 30000, 'registration', 'تسجيل', '2026-09-01 10:30:00', 'cash', 0),
('p2', 'W-2002', 's2', 40000, 'registration', 'تسجيل', '2026-09-01 11:00:00', 'cash', 0),
('p3', 'W-2003', 's5', 5000, 'installment', 'قسط شهر 1', '2026-09-05 10:00:00', 'cash', 0),
('p4', 'W-2004', 's6', 6000, 'installment', 'قسط شهر 1', '2026-09-05 11:30:00', 'cash', 0),
('p5', 'W-2005', 's9', 45000, 'registration', 'تسجيل', '2026-09-01 15:00:00', 'card', 0)
ON DUPLICATE KEY UPDATE `receipt_number` = `receipt_number`;

-- Teacher Payments
INSERT INTO `teacher_payments` (`id`, `receipt_number`, `teacher_id`, `amount`, `month`, `payment_date`, `payment_type`, `is_cancelled`) VALUES
('tp1', 'T-2001', 't1', 45000, '2026-09', '2026-09-28 10:00:00', 'salary', 0),
('tp2', 'T-2002', 't2', 50000, '2026-09', '2026-09-28 10:30:00', 'salary', 0),
('tp3', 'T-2003', 't3', 38000, '2026-09', '2026-09-28 11:00:00', 'salary', 0)
ON DUPLICATE KEY UPDATE `receipt_number` = `receipt_number`;

-- Expenses
INSERT INTO `expenses` (`id`, `date`, `type`, `description`, `amount`, `is_cancelled`) VALUES
('e1', '2026-09-01 09:00:00', 'إيجار', 'إيجار محل شهر سبتمبر', 40000, 0),
('e2', '2026-09-05 10:00:00', 'كهرباء', 'فاتورة الكهرباء', 8500, 0),
('e3', '2026-09-10 14:00:00', 'قرطاسية', 'طباعة وقرطاسية', 5000, 0),
('e4', '2026-09-15 11:00:00', 'إنترنت', 'اشتراك الإنترنت', 6000, 0)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Leads
INSERT INTO `leads` (`id`, `full_name`, `phone`, `source`, `desired_course`, `status`, `interest_level`) VALUES
('l1', 'صهيب عماري', '0561112233', 'فيسبوك', 'إعلام آلي', 'interested', 'high'),
('l2', 'وفاء حمدي', '0562223344', 'إنستغرام', 'تمريض', 'new', 'medium'),
('l3', 'أنس بوعلام', '0563334455', 'موقع ويب', 'لغة إنجليزية', 'contacted', 'medium'),
('l4', 'روان شافع', '0564445566', 'إحالة', 'دعم مدرسي', 'converted', 'high')
ON DUPLICATE KEY UPDATE `full_name` = `full_name`;

-- Tasks
INSERT INTO `tasks` (`id`, `title`, `priority`, `responsible`, `deadline`, `completed`, `status`) VALUES
('task1', 'متابعة الوثائق الناقصة', 'high', 'المدير', '2026-09-30', 0, 'pending'),
('task2', 'تجهيز قاعة الامتحان', 'medium', 'الموظف', '2026-10-15', 0, 'pending'),
('task3', 'دفع الإيجار', 'low', 'المدير', '2026-10-01', 1, 'completed')
ON DUPLICATE KEY UPDATE `title` = `title`;

-- Calendar Events
INSERT INTO `calendar_events` (`id`, `title`, `description`, `type`, `start_date`, `color`, `location`) VALUES
('ev1', 'بداية السنة الدراسية', 'بداية الدروس 2026-2027', 'event', '2026-09-01 08:00:00', '#10b981', 'القاعة الرئيسية'),
('ev2', 'اجتماع أولياء الأمور', 'اجتماع تنسيقي', 'meeting', '2026-10-05 10:00:00', '#f59e0b', 'قاعة المحاضرات')
ON DUPLICATE KEY UPDATE `title` = `title`;

-- Notifications
INSERT INTO `notifications` (`id`, `title`, `message`, `type`, `is_read`) VALUES
('n1', 'مرحباً بك', 'تم تثبيت النظام بنجاح', 'success', 0),
('n2', 'تذكير: متابعة الوثائق', 'بعض الطلاب لم يكملوا ملفاتهم', 'warning', 0)
ON DUPLICATE KEY UPDATE `title` = `title`;

-- Roles (system + custom)
INSERT INTO `roles` (`id`, `name`, `description`, `is_system`) VALUES
('role_dir',    'مدير عام',       'صلاحيات كاملة على كل النظام', 1),
('role_rec',    'موظف استقبال',    'إدارة التسجيلات والعملاء المحتملين', 1),
('role_acc',    'محاسب',           'إدارة القسم المالي فقط', 1),
('role_tch',    'أستاذ',           'عرض الطلاب والحضور والمهام الخاصة به', 1),
('role_emp',    'موظف عادي',       'صلاحيات محدودة', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `is_system` = VALUES(`is_system`);

-- ===== Default Role Permissions =====
-- مدير عام: كل الصلاحيات (نتحقق منها في الكود أيضاً، لكن نضيفها للتوافق)
-- For brevity, we seed the matrix only for non-director roles; director bypasses checks in code.

-- موظف استقبال: dashboard, students, registrations, crm, whatsapp, notifications, calendar, attendance, tasks (view + create; edit only on students/registrations/crm; no delete)
INSERT INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_rec_01', 'role_rec', 'dashboard',      1, 1, 1, 0),
('rp_rec_02', 'role_rec', 'students',       1, 1, 1, 0),
('rp_rec_03', 'role_rec', 'registrations',  1, 1, 1, 0),
('rp_rec_04', 'role_rec', 'crm',            1, 1, 1, 0),
('rp_rec_05', 'role_rec', 'whatsapp',       1, 1, 0, 0),
('rp_rec_06', 'role_rec', 'notifications',  1, 1, 0, 0),
('rp_rec_07', 'role_rec', 'calendar',       1, 1, 0, 0),
('rp_rec_08', 'role_rec', 'attendance',     1, 1, 0, 0),
('rp_rec_09', 'role_rec', 'tasks',           1, 1, 0, 0)
ON DUPLICATE KEY UPDATE `can_view` = VALUES(`can_view`), `can_create` = VALUES(`can_create`), `can_edit` = VALUES(`can_edit`), `can_delete` = VALUES(`can_delete`);

-- محاسب: dashboard, finance, reports, students (view), notifications, calendar (view + create on finance/reports; edit on finance; delete on finance)
INSERT INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_acc_01', 'role_acc', 'dashboard',      1, 1, 1, 0),
('rp_acc_02', 'role_acc', 'finance',         1, 1, 1, 1),
('rp_acc_03', 'role_acc', 'reports',         1, 1, 0, 0),
('rp_acc_04', 'role_acc', 'students',        1, 0, 0, 0),
('rp_acc_05', 'role_acc', 'notifications',  1, 0, 0, 0),
('rp_acc_06', 'role_acc', 'calendar',        1, 0, 0, 0)
ON DUPLICATE KEY UPDATE `can_view` = VALUES(`can_view`), `can_create` = VALUES(`can_create`), `can_edit` = VALUES(`can_edit`), `can_delete` = VALUES(`can_delete`);

-- أستاذ: dashboard, students, attendance, tasks, exams, notifications, calendar (view + create on attendance/exams/tasks; edit on attendance/exams; no delete)
INSERT INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_tch_01', 'role_tch', 'dashboard',      1, 1, 1, 0),
('rp_tch_02', 'role_tch', 'students',        1, 0, 0, 0),
('rp_tch_03', 'role_tch', 'attendance',      1, 1, 1, 0),
('rp_tch_04', 'role_tch', 'tasks',           1, 1, 0, 0),
('rp_tch_05', 'role_tch', 'exams',           1, 1, 1, 0),
('rp_tch_06', 'role_tch', 'notifications',  1, 0, 0, 0),
('rp_tch_07', 'role_tch', 'calendar',        1, 0, 0, 0)
ON DUPLICATE KEY UPDATE `can_view` = VALUES(`can_view`), `can_create` = VALUES(`can_create`), `can_edit` = VALUES(`can_edit`), `can_delete` = VALUES(`can_delete`);

-- موظف عادي: dashboard, notifications, calendar (view only)
INSERT INTO `role_permissions` (`id`, `role_id`, `section`, `can_view`, `can_create`, `can_edit`, `can_delete`) VALUES
('rp_emp_01', 'role_emp', 'dashboard',      1, 0, 0, 0),
('rp_emp_02', 'role_emp', 'notifications',  1, 0, 0, 0),
('rp_emp_03', 'role_emp', 'calendar',        1, 0, 0, 0)
ON DUPLICATE KEY UPDATE `can_view` = VALUES(`can_view`), `can_create` = VALUES(`can_create`), `can_edit` = VALUES(`can_edit`), `can_delete` = VALUES(`can_delete`);

-- Work Settings
INSERT INTO `work_settings` (`id`, `work_days`, `start_time`, `end_time`, `slot_duration`) VALUES
('ws1', '0,1,2,3,4', '08:00', '18:00', 120)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Receipt Settings
INSERT INTO `receipt_settings` (`id`, `header_text`, `footer_text`, `paper_size`) VALUES
('rs1', 'مؤسسة السلامة التعليمية', 'شكراً لتعاملكم معنا', 'A5')
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Groups
INSERT INTO `groups` (`id`, `name`, `department_id`, `level_id`, `student_count`) VALUES
('g1', 'مجموعة TS-INFO-1', 'dept_ts', 'lvl_1', 5),
('g2', 'مجموعة TS-MED-1', 'dept_med', 'lvl_1', 3),
('g3', 'مجموعة LANG', 'dept_lang', 'lvl_1', 2)
ON DUPLICATE KEY UPDATE `name` = `name`;
