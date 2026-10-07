<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
$pageTitle = 'لوحة التحكم';
$activeMenu = 'dashboard';
$user = current_user();
$isDirector = $user['role'] === 'director';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');

// Helper
function build_sql($base, $extraWhere = '', $extraParams = []) {
    global $brClause, $brParams;
    $sql = $base;
    $params = [];
    $hasWhere = stripos($base, 'WHERE') !== false;
    if ($brClause) {
        $sql .= ($hasWhere ? " AND $brClause" : " WHERE $brClause");
        $params = array_merge($params, $brParams);
    }
    if ($extraWhere) {
        $sql .= ($hasWhere || $brClause ? " AND $extraWhere" : " WHERE $extraWhere");
        $params = array_merge($params, $extraParams);
    }
    return [$sql, $params];
}

[$sql, $p] = build_sql("SELECT COUNT(*) FROM students");
$studentsCount = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM teachers");
$teachersCount = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COALESCE(SUM(amount), 0) FROM student_payments", "is_cancelled = 0");
$totalIncome = $database->sum($sql, $p);
$totalExpense = 0;
$totalExpense += $database->sum("SELECT COALESCE(SUM(tp.amount), 0) FROM teacher_payments tp LEFT JOIN teachers t ON tp.teacher_id = t.id WHERE tp.is_cancelled = 0" . ($brClause ? " AND $brClause" : ""), $brParams);
$totalExpense += $database->sum("SELECT COALESCE(SUM(amount), 0) FROM staff_payments WHERE is_cancelled = 0");
[$sql, $p] = build_sql("SELECT COALESCE(SUM(amount), 0) FROM expenses", "is_cancelled = 0");
$totalExpense += $database->sum($sql, $p);
$balance = $totalIncome - $totalExpense;

// 🌳 Branch name for employees (display in dashboard header)
$currentBranchName = null;
if (!$isDirector && !empty($_SESSION['branch_id'])) {
    $br = $database->fetchOne("SELECT name, code FROM branches WHERE id = ? LIMIT 1", [$_SESSION['branch_id']]);
    if ($br) {
        $currentBranchName = $br['name'] . ($br['code'] ? ' (' . $br['code'] . ')' : '');
    }
}
include 'includes/layout.php';
?>
<?php if ($currentBranchName): ?>
<div class="alert alert-info" style="margin-bottom:15px">
    🏢 أنت متصل بفرع: <strong><?= htmlspecialchars($currentBranchName) ?></strong>
    — كل البيانات المعروضة تخص هذا الفرع فقط.
</div>
<?php elseif (!$isDirector): ?>
<div class="alert alert-info" style="margin-bottom:15px">
    🏢 أنت متصل بـ: <strong>المقر الرئيسي</strong>
    — كل البيانات المعروضة تخص المقر الرئيسي فقط.
</div>
<?php endif; ?>

<div class="stats-grid">
    <div class="stat-card students"><div class="label">👥 الطلاب</div><div class="value"><?= $studentsCount ?></div></div>
    <div class="stat-card teachers"><div class="label">🎓 الأساتذة</div><div class="value"><?= $teachersCount ?></div></div>
    <div class="stat-card income"><div class="label">💰 المداخيل</div><div class="value"><?= number_format($totalIncome,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 المصاريف</div><div class="value"><?= number_format($totalExpense,0) ?> دج</div></div>
    <div class="stat-card balance"><div class="label">📊 الرصيد</div><div class="value" style="color:<?= $balance>=0?'#7c3aed':'#ef4444' ?>"><?= number_format($balance,0) ?> دج</div></div>
</div>

<div class="section-title">📋 الأقسام الرئيسية</div>
<div class="menu-grid">
    <a href="students.php" class="menu-item"><div class="icon">👥</div><div class="title">الطلاب</div></a>
    <a href="teachers.php" class="menu-item"><div class="icon">🎓</div><div class="title">الأساتذة</div></a>
    <a href="departments.php" class="menu-item"><div class="icon">📚</div><div class="title">الأقسام</div></a>
    <a href="finance.php" class="menu-item"><div class="icon">💰</div><div class="title">القسم المالي</div></a>
    <a href="attendance.php" class="menu-item"><div class="icon">📋</div><div class="title">الحضور</div></a>
    <a href="exams.php" class="menu-item"><div class="icon">📝</div><div class="title">الامتحانات</div></a>
    <a href="weekly-schedule.php" class="menu-item"><div class="icon">📅</div><div class="title">الجدول الأسبوعي</div></a>
</div>

<div class="section-title">📊 الإدارة والمتابعة</div>
<div class="menu-grid">
    <a href="tasks.php" class="menu-item"><div class="icon">✅</div><div class="title">المهام</div></a>
    <a href="notifications.php" class="menu-item"><div class="icon">🔔</div><div class="title">الإشعارات</div></a>
    <a href="messages.php" class="menu-item"><div class="icon">✉️</div><div class="title">الرسائل</div></a>
    <a href="crm.php" class="menu-item"><div class="icon">🎯</div><div class="title">العملاء المحتملون</div></a>
    <a href="job-applications.php" class="menu-item"><div class="icon">💼</div><div class="title">طلبات العمل</div></a>
    <a href="certificates.php" class="menu-item"><div class="icon">🏅</div><div class="title">سجل الشهادات</div></a>
    <a href="archive.php" class="menu-item"><div class="icon">📁</div><div class="title">الأرشيف</div></a>
    <a href="calendar.php" class="menu-item"><div class="icon">🗓️</div><div class="title">التقويم</div></a>
    <a href="student-cards.php" class="menu-item"><div class="icon">🪪</div><div class="title">بطاقات الهوية</div></a>
    <a href="timesheet.php" class="menu-item"><div class="icon">⏰</div><div class="title">حضور الموظفين</div></a>
    <a href="reports.php" class="menu-item"><div class="icon">📊</div><div class="title">التقارير + Excel</div></a>
    <a href="import-data.php" class="menu-item"><div class="icon">📥</div><div class="title">استيراد البيانات</div></a>
    <a href="print-receipt.php" class="menu-item"><div class="icon">🖨️</div><div class="title">طباعة الوصولات</div></a>
    <a href="whatsapp.php" class="menu-item"><div class="icon">💬</div><div class="title">واتساب</div></a>
    <a href="ai-assistant.php" class="menu-item"><div class="icon">🤖</div><div class="title">المساعد الذكي</div></a>
</div>

<?php if ($isDirector): ?>
<div class="section-title">⚙️ الإعدادات والإدارة</div>
<div class="menu-grid">
    <a href="users.php" class="menu-item"><div class="icon">👤</div><div class="title">إدارة الحسابات</div></a>
    <a href="branches.php" class="menu-item"><div class="icon">🏢</div><div class="title">الفروع</div></a>
    <a href="central-system.php" class="menu-item"><div class="icon">🌐</div><div class="title">النظام المركزي</div></a>
    <a href="backup.php" class="menu-item"><div class="icon">💾</div><div class="title">النسخ الاحتياطي</div></a>
    <a href="settings.php" class="menu-item"><div class="icon">⚙️</div><div class="title">الإعدادات</div></a>
    <a href="activity-log.php" class="menu-item"><div class="icon">📜</div><div class="title">سجل التغييرات</div></a>
</div>
<?php endif; ?>
<?php include 'includes/footer.php'; ?>
