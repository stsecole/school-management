<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('reports');
$pageTitle = 'التقارير'; $activeMenu = 'reports';
$database = db();
$isDirector = $_SESSION['role'] === 'director';
$year = (int)($_GET['year'] ?? date('Y'));

// 🌳 branch scope (على الجداول ذات branch_id مباشرة)
[$brClause, $brParams] = branch_filter('branch_id');

// Helper لإنشاء SQL مع شرط الفرع
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

// Comprehensive stats (branch-aware)
[$sql, $p] = build_sql("SELECT COUNT(*) FROM students");
$studentsTotal = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM students", "status IN ('registered','continuing')");
$studentsActive = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM students", "status = 'graduated'");
$studentsGraduated = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM students", "status = 'abandoned'");
$studentsAbandoned = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM teachers", "status = 'active'");
$teachersTotal = $database->count($sql, $p);
$departmentsCount = $database->count("SELECT COUNT(*) FROM departments");
$specsCount = $database->count("SELECT COUNT(*) FROM specializations");
$coursesCount = $database->count("SELECT COUNT(*) FROM courses");
[$sql, $p] = build_sql("SELECT COUNT(*) FROM attendance", "YEAR(date) = ?", [$year]);
$attendanceTotal = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM tasks");
$tasksTotal = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM tasks", "completed = 1");
$tasksCompleted = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM tasks", "completed = 0");
$tasksPending = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM tasks", "completed = 0 AND deadline < CURDATE()");
$tasksOverdue = $database->count($sql, $p);

// Financial (branch-aware — student_payments and expenses have branch_id; teacher_payments via teachers JOIN)
[$sql, $p] = build_sql("SELECT COALESCE(SUM(amount), 0) FROM student_payments", "is_cancelled = 0 AND YEAR(payment_date) = ?", [$year]);
$totalIncome = $database->sum($sql, $p);

// teacher_payments: filter via JOIN to teachers
$tpFilter = "is_cancelled = 0 AND YEAR(payment_date) = ?";
[$brTp, $brTpParams] = branch_filter('t.branch_id');
if ($brTp) { $tpFilter .= " AND $brTp"; }
$totalTeacherPay = $database->sum("SELECT COALESCE(SUM(tp.amount), 0) FROM teacher_payments tp LEFT JOIN teachers t ON tp.teacher_id = t.id WHERE $tpFilter", array_merge([$year], $brTpParams));

$totalStaffPay = $database->sum("SELECT COALESCE(SUM(amount), 0) FROM staff_payments WHERE is_cancelled = 0 AND YEAR(payment_date) = ?", [$year]);
[$sql, $p] = build_sql("SELECT COALESCE(SUM(amount), 0) FROM expenses", "is_cancelled = 0 AND YEAR(date) = ?", [$year]);
$totalExpenses = $database->sum($sql, $p);
$totalExpense = $totalTeacherPay + $totalStaffPay + $totalExpenses;
$balance = $totalIncome - $totalExpense;
[$sql, $p] = build_sql("SELECT COUNT(*) FROM student_payments", "is_cancelled = 0 AND YEAR(payment_date) = ?", [$year]);
$paymentsCount = $database->count($sql, $p);

// Monthly income (branch-aware)
[$sql, $p] = build_sql("SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount) as total, COUNT(*) as count FROM student_payments", "is_cancelled = 0 AND YEAR(payment_date) = ? GROUP BY DATE_FORMAT(payment_date, '%Y-%m') ORDER BY month", [$year]);
$monthlyIncome = $database->fetchAll($sql, $p);

// Department stats — لا تتأثر بالفرع (الأقسام عامة)
$deptStats = $database->fetchAll("SELECT d.name, d.code, d.has_installments, d.installment_months, COUNT(DISTINCT s.id) as students_count, COUNT(DISTINCT t.id) as teachers_count FROM departments d LEFT JOIN students s ON s.department_id = d.id LEFT JOIN teachers t ON t.department_id = d.id GROUP BY d.id, d.name, d.code, d.has_installments, d.installment_months ORDER BY students_count DESC");

// Status distribution (branch-aware)
[$sql, $p] = build_sql("SELECT status, COUNT(*) as count FROM students GROUP BY status ORDER BY count DESC");
$statusStats = $database->fetchAll($sql, $p);
[$sql, $p] = build_sql("SELECT gender, COUNT(*) as count FROM students WHERE gender IS NOT NULL GROUP BY gender");
$genderStats = $database->fetchAll($sql, $p);

// Leads stats (branch-aware)
[$sql, $p] = build_sql("SELECT COUNT(*) FROM leads");
$leadsCount = $database->count($sql, $p);
[$sql, $p] = build_sql("SELECT COUNT(*) FROM leads", "status = 'converted'");
$leadsConverted = $database->count($sql, $p);

// Expenses by type (branch-aware)
[$sql, $p] = build_sql("SELECT type, SUM(amount) as total FROM expenses", "is_cancelled = 0 AND YEAR(date) = ? GROUP BY type ORDER BY total DESC", [$year]);
$expensesByType = $database->fetchAll($sql, $p);

include 'includes/layout.php';
?>

<!-- ===== النظرة العامة ===== -->
<div class="section-title">📊 النظرة العامة - سنة <?= $year ?></div>
<div style="margin-bottom:15px;display:flex;gap:10px;align-items:center">
    <form method="get" style="display:flex;gap:10px;align-items:center">
        <label>السنة:</label>
        <input type="number" name="year" value="<?= $year ?>" min="2020" max="2030" class="form-control" style="width:100px">
        <button type="submit" class="btn btn-sm">تحديث</button>
    </form>
    <a href="api/export/?type=students" class="btn btn-sm btn-success">📥 Excel - الطلاب</a>
    <a href="api/export/?type=teachers" class="btn btn-sm btn-success">📥 Excel - الأساتذة</a>
    <a href="api/export/?type=payments" class="btn btn-sm btn-success">📥 Excel - الوصولات</a>
</div>

<div class="stats-grid">
    <div class="stat-card students"><div class="label">👥 الطلاب</div><div class="value"><?= $studentsTotal ?></div></div>
    <div class="stat-card income"><div class="label">✅ النشطون</div><div class="value"><?= $studentsActive ?></div></div>
    <div class="stat-card balance"><div class="label">🏆 المتخرجون</div><div class="value"><?= $studentsGraduated ?></div></div>
    <div class="stat-card expense"><div class="label">❌ المنقطعون</div><div class="value"><?= $studentsAbandoned ?></div></div>
    <div class="stat-card teachers"><div class="label">🎓 الأساتذة</div><div class="value"><?= $teachersTotal ?></div></div>
    <div class="stat-card balance"><div class="label">📚 الأقسام</div><div class="value"><?= $departmentsCount ?></div></div>
    <div class="stat-card students"><div class="label">🎓 التخصصات</div><div class="value"><?= $specsCount ?></div></div>
    <div class="stat-card teachers"><div class="label">📖 الدورات</div><div class="value"><?= $coursesCount ?></div></div>
</div>

<?php if ($isDirector): ?>
<!-- ===== المالية ===== -->
<div class="section-title">💰 التقرير المالي - <?= $year ?></div>
<div class="stats-grid">
    <div class="stat-card income"><div class="label">💰 المداخيل</div><div class="value"><?= number_format($totalIncome,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 رواتب الأساتذة</div><div class="value"><?= number_format($totalTeacherPay,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 رواتب الموظفين</div><div class="value"><?= number_format($totalStaffPay,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 مصاريف أخرى</div><div class="value"><?= number_format($totalExpenses,0) ?> دج</div></div>
    <div class="stat-card balance"><div class="label">📊 الرصيد</div><div class="value" style="color:<?= $balance>=0?'#7c3aed':'#ef4444' ?>"><?= number_format($balance,0) ?> دج</div></div>
    <div class="stat-card teachers"><div class="label">📋 عدد الوصولات</div><div class="value"><?= $paymentsCount ?></div></div>
</div>

<!-- ===== المداخيل الشهرية ===== -->
<div class="card">
    <div class="card-header"><h2>📈 المداخيل الشهرية - <?= $year ?></h2></div>
    <?php if (empty($monthlyIncome)): ?>
        <p style="text-align:center;color:#999;padding:20px">لا توجد بيانات</p>
    <?php else: $maxInc = max(array_column($monthlyIncome, 'total') ?: [1]); ?>
    <div style="display:flex;align-items:flex-end;gap:5px;height:200px;padding:20px 0">
        <?php foreach ($monthlyIncome as $m): ?>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="font-size:10px;color:#666"><?= number_format($m['total']/1000, 0) ?>K</div>
            <div style="background:linear-gradient(180deg,#10b981,#059669);width:100%;height:<?= ($m['total']/$maxInc)*150 ?>px;border-radius:4px 4px 0 0;min-height:3px" title="<?= $m['month'] ?>: <?= number_format($m['total'],0) ?> دج (<?= $m['count'] ?> وصل)"></div>
            <div style="font-size:9px;color:#999"><?= substr($m['month'],5,2) ?></div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<!-- ===== المصاريف حسب النوع ===== -->
<div class="card">
    <div class="card-header"><h2>💸 المصاريف حسب النوع</h2></div>
    <?php if (empty($expensesByType)): ?>
        <p style="text-align:center;color:#999;padding:20px">لا توجد مصاريف</p>
    <?php else: $maxExp = max(array_column($expensesByType, 'total') ?: [1]); ?>
    <?php foreach ($expensesByType as $e): ?>
    <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-weight:600"><?= htmlspecialchars($e['type']) ?></span>
            <span><?= number_format($e['total'],0) ?> دج</span>
        </div>
        <div style="background:#e5e7eb;border-radius:6px;height:20px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#ef4444,#dc2626);height:100%;width:<?= ($e['total']/$maxExp)*100 ?>%;border-radius:6px"></div>
        </div>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>
</div>
<?php endif; ?>

<!-- ===== توزيع الطلاب حسب القسم ===== -->
<div class="card">
    <div class="card-header"><h2>📚 توزيع الطلاب والأساتذة حسب القسم</h2></div>
    <div style="overflow-x:auto"><table>
        <thead><tr><th>القسم</th><th>الكود</th><th>الطلاب</th><th>الأساتذة</th><th>أقساط</th><th>نسبة الطلاب</th></tr></thead>
        <tbody>
        <?php $totalStudents = array_sum(array_column($deptStats, 'students_count')); ?>
        <?php if (empty($deptStats)): ?>
            <tr><td colspan="6" style="text-align:center;color:#999;padding:20px">لا توجد بيانات</td></tr>
        <?php else: foreach ($deptStats as $d): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($d['name']) ?></td>
                <td><code><?= htmlspecialchars($d['code']??'-') ?></code></td>
                <td><span class="badge badge-info"><?= $d['students_count'] ?></span></td>
                <td><span class="badge badge-info"><?= $d['teachers_count'] ?></span></td>
                <td><?= !empty($d['has_installments']) ? '<span class="badge badge-success">'.$d['installment_months'].' شهر</span>' : '-' ?></td>
                <td>
                    <div style="background:#e5e7eb;border-radius:6px;height:18px;overflow:hidden;min-width:100px">
                        <div style="background:linear-gradient(90deg,#7c3aed,#5b21b6);height:100%;width:<?= $totalStudents>0?($d['students_count']/$totalStudents)*100:0 ?>%;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px">
                            <?= $totalStudents>0?round(($d['students_count']/$totalStudents)*100,1):0 ?>%
                        </div>
                    </div>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table></div>
</div>

<!-- ===== توزيع الطلاب حسب الحالة ===== -->
<div class="card">
    <div class="card-header"><h2>📊 توزيع الطلاب حسب الحالة</h2></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:20px">
        <div>
            <?php $statusLabels = ['registered'=>'مسجل','continuing'=>'مستمر','graduated'=>'متخرج','abandoned'=>'منقطع','postponed'=>'مؤجل'];
                  $statusColors = ['registered'=>'#3b82f6','continuing'=>'#10b981','graduated'=>'#f59e0b','abandoned'=>'#ef4444','postponed'=>'#a78bfa'];
                  $totalStatus = array_sum(array_column($statusStats, 'count')) ?: 1; ?>
            <?php foreach ($statusStats as $s): ?>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:12px;height:12px;border-radius:3px;background:<?= $statusColors[$s['status']]??'#999' ?>"></div>
                <span style="flex:1"><?= $statusLabels[$s['status']] ?? $s['status'] ?></span>
                <span style="font-weight:bold"><?= $s['count'] ?></span>
                <span style="color:#999;font-size:12px"><?= round(($s['count']/$totalStatus)*100,1) ?>%</span>
            </div>
            <?php endforeach; ?>
        </div>
        <div>
            <h3 style="font-size:14px;margin-bottom:15px">حسب الجنس</h3>
            <?php foreach ($genderStats as $g): ?>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6">
                <span><?= $g['gender']==='male'?'ذكر':'أنثى' ?></span>
                <span style="font-weight:bold"><?= $g['count'] ?></span>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>

<!-- ===== المهام ===== -->
<div class="card">
    <div class="card-header"><h2>✅ إحصائيات المهام</h2></div>
    <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card balance"><div class="label">📋 الإجمالي</div><div class="value"><?= $tasksTotal ?></div></div>
        <div class="stat-card income"><div class="label">✅ مكتملة</div><div class="value"><?= $tasksCompleted ?></div></div>
        <div class="stat-card teachers"><div class="label">⏳ معلقة</div><div class="value"><?= $tasksPending ?></div></div>
        <div class="stat-card expense"><div class="label">🔴 متأخرة</div><div class="value"><?= $tasksOverdue ?></div></div>
    </div>
</div>

<!-- ===== CRM ===== -->
<div class="card">
    <div class="card-header"><h2>🎯 إحصائيات العملاء المحتملين</h2></div>
    <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card students"><div class="label">🎯 الإجمالي</div><div class="value"><?= $leadsCount ?></div></div>
        <div class="stat-card income"><div class="label">✅ تم تحويلهم</div><div class="value"><?= $leadsConverted ?></div></div>
        <div class="stat-card balance"><div class="label">📊 معدل التحويل</div><div class="value"><?= $leadsCount>0?round(($leadsConverted/$leadsCount)*100,1):0 ?>%</div></div>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
