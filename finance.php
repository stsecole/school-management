<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('finance');
$pageTitle = 'القسم المالي';
$activeMenu = 'finance';
$database = db();

// 🌳 branch scope (for direct tables)
[$brClause, $brParams] = branch_filter('branch_id');
// for student_payments aliased to sp:
[$brClauseSp, $brParamsSp] = branch_filter('sp.branch_id');
// for expenses aliased to e:
[$brClauseE, $brParamsE] = branch_filter('e.branch_id');
// for teacher_payments aliased to tp:
// doesn't have branch_id — filter via JOIN to teachers t
// for staff_payments: no branch_id (shared)

// Handle cancel (شطب)
if (isset($_GET['cancel']) && $_SESSION['role'] === 'director') {
    $type = $_GET['cancel'];
    $id = $_GET['id'];
    $tableMap = ['student'=>'student_payments','teacher'=>'teacher_payments','staff'=>'staff_payments','expense'=>'expenses'];
    if (isset($tableMap[$type])) {
        $database->execute("UPDATE `{$tableMap[$type]}` SET is_cancelled = 1, cancelled_at = NOW() WHERE id = ?", [$id]);
        header('Location: finance.php?cancelled=1');
        exit;
    }
}

// Handle add payments
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    $type = $data['type'] ?? '';

    if ($type === 'student' && !empty($data['student_id']) && !empty($data['amount'])) {
        // 🌳 تحقق أن الطالب ينتمي لفرع المستخدم
        $student = $database->fetchOne("SELECT branch_id FROM students WHERE id = ?", [$data['student_id']]);
        if ($student) {
            $studentBranch = $student['branch_id'] ?? null;
            $userBranch = current_user_branch_id();
            if ($_SESSION['role'] !== 'director' && $studentBranch != $userBranch) {
                header('Location: finance.php?forbidden=1'); exit;
            }
        }
        $receipt = generate_receipt_number();
        // 🌳 ضع branch_id = فرع الطالب (يلي المنطق: الدفعة تابعة لفرع الطالب)
        $paymentBranchId = $student ? ($student['branch_id'] ?? null) : branch_for_new_record();
        $database->execute("INSERT INTO student_payments (id, receipt_number, student_id, amount, payment_type, payment_label, payment_date, payment_method, notes, branch_id, is_cancelled, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 0, NOW())",
            [generate_id(), $receipt, $data['student_id'], $data['amount'], $data['payment_type']??'installment', $data['payment_label']??null, $data['payment_method']??'cash', $data['notes']??null, $paymentBranchId]);
        header('Location: finance.php?saved=1');
        exit;
    }
    if ($type === 'teacher' && !empty($data['teacher_id']) && !empty($data['amount']) && !empty($data['month'])) {
        $receipt = generate_receipt_number('T');
        $database->execute("INSERT INTO teacher_payments (id, receipt_number, teacher_id, amount, month, payment_date, payment_type, notes, is_cancelled, created_at) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, 0, NOW())",
            [generate_id(), $receipt, $data['teacher_id'], $data['amount'], $data['month'], $data['payment_type']??'salary', $data['notes']??null]);
        header('Location: finance.php?saved=1');
        exit;
    }
    if ($type === 'staff' && !empty($data['staff_name']) && !empty($data['amount'])) {
        $receipt = generate_receipt_number('S');
        $database->execute("INSERT INTO staff_payments (id, staff_name, staff_role, amount, payment_date, month, note, receipt_number, is_cancelled, created_at) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 0, NOW())",
            [generate_id(), $data['staff_name'], $data['staff_role']??null, $data['amount'], $data['month']??null, $data['note']??null, $receipt]);
        header('Location: finance.php?saved=1');
        exit;
    }
    if ($type === 'expense' && !empty($data['exp_type']) && !empty($data['amount'])) {
        // 🌳 ضع branch_id = فرع المستخدم الحالي (الموظف) أو ما يحدده المدير في الفورم
        $expenseBranchId = ($_SESSION['role'] === 'director')
            ? ($data['branch_id'] ?? null)
            : branch_for_new_record();
        $database->execute("INSERT INTO expenses (id, date, type, description, amount, branch_id, is_cancelled, created_at) VALUES (?, NOW(), ?, ?, ?, ?, 0, NOW())",
            [generate_id(), $data['exp_type'], $data['description']??null, $data['amount'], $expenseBranchId]);
        header('Location: finance.php?saved=1');
        exit;
    }
}

// Get summary (branch-aware)
$incomeSql = "SELECT COALESCE(SUM(amount), 0) FROM student_payments WHERE is_cancelled = 0";
$incomeParams = [];
if ($brClause) { $incomeSql .= " AND $brClause"; $incomeParams = $brParams; }
$totalIncome = $database->sum($incomeSql, $incomeParams);

// teacher_payments doesn't have branch_id — filter via teacher's branch
$teacherPaySql = "SELECT COALESCE(SUM(tp.amount), 0) FROM teacher_payments tp LEFT JOIN teachers t ON tp.teacher_id = t.id WHERE tp.is_cancelled = 0";
$teacherPayParams = [];
[$brTp, $brTpParams] = branch_filter('t.branch_id');
if ($brTp) { $teacherPaySql .= " AND $brTp"; $teacherPayParams = $brTpParams; }
$totalTeacherPay = $database->sum($teacherPaySql, $teacherPayParams);

$totalStaffPay = $database->sum("SELECT COALESCE(SUM(amount), 0) FROM staff_payments WHERE is_cancelled = 0");

$expensesSql = "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE is_cancelled = 0";
$expensesParams = [];
if ($brClause) { $expensesSql .= " AND $brClause"; $expensesParams = $brParams; }
$totalExpenses = $database->sum($expensesSql, $expensesParams);

$totalExpense = $totalTeacherPay + $totalStaffPay + $totalExpenses;
$balance = $totalIncome - $totalExpense;

// Get recent transactions (branch-aware)
$spSql = "SELECT sp.*, s.name as student_name FROM student_payments sp LEFT JOIN students s ON sp.student_id = s.id WHERE sp.is_cancelled = 0";
$spParams = [];
if ($brClauseSp) { $spSql .= " AND $brClauseSp"; $spParams = $brParamsSp; }
$spSql .= " ORDER BY sp.payment_date DESC LIMIT 10";
$studentPayments = $database->fetchAll($spSql, $spParams);

$tpSql = "SELECT tp.*, t.name as teacher_name FROM teacher_payments tp LEFT JOIN teachers t ON tp.teacher_id = t.id WHERE tp.is_cancelled = 0";
$tpParams = [];
if ($brTp) { $tpSql .= " AND $brTp"; $tpParams = $brTpParams; }
$tpSql .= " ORDER BY tp.payment_date DESC LIMIT 10";
$teacherPayments = $database->fetchAll($tpSql, $tpParams);

$staffPayments = $database->fetchAll("SELECT * FROM staff_payments WHERE is_cancelled = 0 ORDER BY payment_date DESC LIMIT 10");

$eSql = "SELECT * FROM expenses WHERE is_cancelled = 0";
$eParams = [];
if ($brClauseE) { $eSql .= " AND $brClauseE"; $eParams = $brParamsE; }
$eSql .= " ORDER BY date DESC LIMIT 10";
$expenses = $database->fetchAll($eSql, $eParams);

// Get students and teachers for dropdowns (branch-aware)
$studentsSql = "SELECT id, name, student_number FROM students WHERE 1=1";
$studentsParams = [];
if ($brClause) { $studentsSql .= " AND $brClause"; $studentsParams = $brParams; }
$studentsSql .= " ORDER BY name";
$students = $database->fetchAll($studentsSql, $studentsParams);

$teachersSql = "SELECT id, name FROM teachers WHERE 1=1";
$teachersParams = [];
[$brT, $brTParams] = branch_filter('teachers.branch_id');
if ($brT) { $teachersSql .= " AND $brT"; $teachersParams = $brTParams; }
$teachersSql .= " ORDER BY name";
$teachers = $database->fetchAll($teachersSql, $teachersParams);

// 🌳 Branch list for director's expense form
$branches = ($_SESSION['role'] === 'director') ? $database->fetchAll("SELECT * FROM branches WHERE is_active = 1 ORDER BY name") : [];

include 'includes/layout.php';
?>

<?php if (isset($_GET['saved'])): ?>
<div class="alert alert-success">✅ تم حفظ العملية بنجاح</div>
<?php elseif (isset($_GET['cancelled'])): ?>
<div class="alert alert-success">✅ تم شطب العملية بنجاح</div>
<?php elseif (isset($_GET['forbidden'])): ?>
<div class="alert alert-error">⛔ لا تملك صلاحية الوصول لهذا الطالب (فرع آخر)</div>
<?php endif; ?>

<div class="stats-grid">
    <div class="stat-card income"><div class="label">💰 المداخيل</div><div class="value"><?= number_format($totalIncome,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 مصاريف الأساتذة</div><div class="value"><?= number_format($totalTeacherPay,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 رواتب الموظفين</div><div class="value"><?= number_format($totalStaffPay,0) ?> دج</div></div>
    <div class="stat-card expense"><div class="label">💸 مصاريف أخرى</div><div class="value"><?= number_format($totalExpenses,0) ?> دج</div></div>
    <div class="stat-card balance"><div class="label">📊 الرصيد</div><div class="value" style="color:<?= $balance>=0?'#7c3aed':'#ef4444' ?>"><?= number_format($balance,0) ?> دج</div></div>
</div>

<div class="card">
    <div class="card-header">
        <h2>💰 العمليات المالية</h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-success" onclick="showModal('studentModal')">💵 دفعة طالب</button>
            <button class="btn" onclick="showModal('teacherModal')">🎓 راتب أستاذ</button>
            <button class="btn btn-secondary" onclick="showModal('staffModal')">👤 راتب موظف</button>
            <button class="btn btn-danger" onclick="showModal('expenseModal')">💸 مصروف</button>
        </div>
    </div>
    
    <h3 style="margin:20px 0 10px">💵 وصولات دفع الطلاب</h3>
    <table>
        <thead><tr><th>رقم الوصل</th><th>الطالب</th><th>المبلغ</th><th>النوع</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($studentPayments)): ?>
            <tr><td colspan="6" style="text-align:center;color:#999;padding:20px">لا توجد وصولات</td></tr>
        <?php else: foreach ($studentPayments as $p): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($p['receipt_number']) ?></td>
                <td><?= htmlspecialchars($p['student_name'] ?? '-') ?></td>
                <td style="color:#10b981;font-weight:bold"><?= number_format($p['amount'],0) ?> دج</td>
                <td><?= htmlspecialchars($p['payment_type'] ?? '-') ?></td>
                <td><?= format_datetime($p['payment_date']) ?></td>
                <td>
                    <a href="print-receipt-view.php?type=student&id=<?= $p['id'] ?>" target="_blank" class="btn btn-sm">🖨️</a>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="finance.php?cancel=student&id=<?= $p['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('شطب هذا الوصل؟')" title="شطب">✖️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    
    <h3 style="margin:20px 0 10px">🎓 رواتب الأساتذة</h3>
    <table>
        <thead><tr><th>رقم الوصل</th><th>الأستاذ</th><th>المبلغ</th><th>الشهر</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($teacherPayments)): ?>
            <tr><td colspan="6" style="text-align:center;color:#999;padding:20px">لا توجد رواتب</td></tr>
        <?php else: foreach ($teacherPayments as $p): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($p['receipt_number']) ?></td>
                <td><?= htmlspecialchars($p['teacher_name'] ?? '-') ?></td>
                <td style="color:#f59e0b;font-weight:bold"><?= number_format($p['amount'],0) ?> دج</td>
                <td><?= htmlspecialchars($p['month'] ?? '-') ?></td>
                <td><?= format_datetime($p['payment_date']) ?></td>
                <td>
                    <a href="print-receipt-view.php?type=teacher&id=<?= $p['id'] ?>" target="_blank" class="btn btn-sm">🖨️</a>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="finance.php?cancel=teacher&id=<?= $p['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('شطب؟')">✖️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    
    <h3 style="margin:20px 0 10px">👤 رواتب الموظفين</h3>
    <table>
        <thead><tr><th>رقم الوصل</th><th>الموظف</th><th>المبلغ</th><th>الشهر</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($staffPayments)): ?>
            <tr><td colspan="6" style="text-align:center;color:#999;padding:20px">لا توجد رواتب</td></tr>
        <?php else: foreach ($staffPayments as $p): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($p['receipt_number']) ?></td>
                <td><?= htmlspecialchars($p['staff_name']) ?></td>
                <td style="color:#f59e0b;font-weight:bold"><?= number_format($p['amount'],0) ?> دج</td>
                <td><?= htmlspecialchars($p['month'] ?? '-') ?></td>
                <td><?= format_datetime($p['payment_date']) ?></td>
                <td>
                    <a href="print-receipt-view.php?type=staff&id=<?= $p['id'] ?>" target="_blank" class="btn btn-sm">🖨️</a>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="finance.php?cancel=staff&id=<?= $p['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('شطب؟')">✖️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    
    <h3 style="margin:20px 0 10px">💸 المصاريف</h3>
    <table>
        <thead><tr><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($expenses)): ?>
            <tr><td colspan="5" style="text-align:center;color:#999;padding:20px">لا توجد مصاريف</td></tr>
        <?php else: foreach ($expenses as $e): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($e['type']) ?></td>
                <td><?= htmlspecialchars($e['description'] ?? '-') ?></td>
                <td style="color:#ef4444;font-weight:bold"><?= number_format($e['amount'],0) ?> دج</td>
                <td><?= format_datetime($e['date']) ?></td>
                <td>
                    <a href="print-receipt-view.php?type=expense&id=<?= $e['id'] ?>" target="_blank" class="btn btn-sm">🖨️</a>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="finance.php?cancel=expense&id=<?= $e['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('شطب؟')">✖️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
</div>

<!-- Modals -->
<div id="studentModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">💵 إضافة دفعة طالب</h2>
        <form method="post">
            <input type="hidden" name="type" value="student">
            <div class="form-group"><label>الطالب *</label>
                <select name="student_id" class="form-control" required>
                    <option value="">— اختر —</option>
                    <?php foreach ($students as $s): ?>
                    <option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?> (<?= $s['student_number'] ?? '' ?>)</option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group"><label>المبلغ (دج) *</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>نوع الدفع</label>
                    <select name="payment_type" class="form-control">
                        <option value="installment">قسط</option>
                        <option value="registration">تسجيل</option>
                        <option value="full">دفعة كاملة</option>
                    </select>
                </div>
                <div class="form-group"><label>طريقة الدفع</label>
                    <select name="payment_method" class="form-control">
                        <option value="cash">نقداً</option>
                        <option value="card">بطاقة</option>
                        <option value="transfer">تحويل</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="hideModal('studentModal')">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>

<div id="teacherModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">🎓 إضافة راتب أستاذ</h2>
        <form method="post">
            <input type="hidden" name="type" value="teacher">
            <div class="form-group"><label>الأستاذ *</label>
                <select name="teacher_id" class="form-control" required>
                    <option value="">— اختر —</option>
                    <?php foreach ($teachers as $t): ?>
                    <option value="<?= $t['id'] ?>"><?= htmlspecialchars($t['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>المبلغ (دج) *</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
                <div class="form-group"><label>الشهر *</label><input type="text" name="month" class="form-control" placeholder="2026-01" required></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="hideModal('teacherModal')">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>

<div id="staffModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">👤 إضافة راتب موظف</h2>
        <form method="post">
            <input type="hidden" name="type" value="staff">
            <div class="form-group"><label>اسم الموظف *</label><input type="text" name="staff_name" class="form-control" required></div>
            <div class="form-group"><label>الدور</label><input type="text" name="staff_role" class="form-control" placeholder="مثلاً: محاسب"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>المبلغ (دج) *</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
                <div class="form-group"><label>الشهر</label><input type="text" name="month" class="form-control" placeholder="2026-01"></div>
            </div>
            <div class="form-group"><label>ملاحظة</label><textarea name="note" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="hideModal('staffModal')">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>

<div id="expenseModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">💸 إضافة مصروف</h2>
        <form method="post">
            <input type="hidden" name="type" value="expense">
            <div class="form-group"><label>النوع *</label><input type="text" name="exp_type" class="form-control" required placeholder="مثلاً: كهرباء، إيجار، قرطاسية"></div>
            <div class="form-group"><label>المبلغ (دج) *</label><input type="number" step="0.01" name="amount" class="form-control" required></div>
            <div class="form-group"><label>الوصف</label><textarea name="description" class="form-control" rows="2"></textarea></div>
            <?php if ($_SESSION['role'] === 'director' && !empty($branches)): ?>
            <!-- 🌳 Branch selector — director only -->
            <div class="form-group">
                <label>🏢 الفرع</label>
                <select name="branch_id" class="form-control">
                    <option value="">— المقر الرئيسي —</option>
                    <?php foreach ($branches as $b): ?>
                        <option value="<?= htmlspecialchars($b['id']) ?>"><?= htmlspecialchars($b['name']) ?><?= !empty($b['code']) ? ' ('.htmlspecialchars($b['code']).')' : '' ?></option>
                    <?php endforeach; ?>
                </select>
                <small style="color:#6b7280">الموظفون من فروع أخرى لن يروا هذا المصروف</small>
            </div>
            <?php endif; ?>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="hideModal('expenseModal')">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>

<script>
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }
</script>
<?php include 'includes/footer.php'; ?>
