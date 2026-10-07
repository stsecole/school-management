<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('certificates');
$pageTitle = 'سجل الشهادات'; $activeMenu = 'certificates';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');
[$brClauseS, $brParamsS] = branch_filter('s.branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') {
    $database->execute("DELETE FROM certificates WHERE id = ?", [$_GET['delete']]);
    header('Location: certificates.php'); exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['student_name']) && !empty($data['specialization'])) {
        $certBranchId = branch_for_new_record();
        $database->execute("INSERT INTO certificates (id, student_id, student_name, specialization, certificate_number, delivery_date, notes, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [generate_id(), $data['student_id']??null, $data['student_name'], $data['specialization'], $data['certificate_number']??null, $data['delivery_date']??null, $data['notes']??null, $certBranchId]);
        header('Location: certificates.php'); exit;
    }
}

// 🌳 students filtered by branch
$studentsSql = "SELECT id, name FROM students WHERE 1=1";
$studentsParams = [];
if ($brClauseS) { $studentsSql .= " AND $brClauseS"; $studentsParams = $brParamsS; }
$studentsSql .= " ORDER BY name";
$students = $database->fetchAll($studentsSql, $studentsParams);

// 🌳 certificates filtered by branch
$certsSql = "SELECT * FROM certificates WHERE 1=1";
$certsParams = [];
if ($brClause) { $certsSql .= " AND $brClause"; $certsParams = $brParams; }
$certsSql .= " ORDER BY created_at DESC LIMIT 200";
$certs = $database->fetchAll($certsSql, $certsParams);
include 'includes/layout.php';
?>
<div class="card">
    <div class="card-header"><h2>🏅 سجل الشهادات (<?= count($certs) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة شهادة</button>
    </div>
    <div style="overflow-x:auto">
    <table>
        <thead><tr><th>الطالب</th><th>التخصص</th><th>رقم الشهادة</th><th>تاريخ التسليم</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($certs)): ?>
            <tr><td colspan="5" style="text-align:center;color:#999;padding:20px">لا توجد شهادات</td></tr>
        <?php else: foreach ($certs as $c): ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($c['student_name']) ?></td>
                <td><?= htmlspecialchars($c['specialization']) ?></td>
                <td><code><?= htmlspecialchars($c['certificate_number'] ?? '-') ?></code></td>
                <td><?= format_date($c['delivery_date']) ?></td>
                <td>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="certificates.php?delete=<?= $c['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    </div>
</div>
<div id="addModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">➕ إضافة شهادة</h2>
        <form method="post">
            <div class="form-group"><label>الطالب</label>
                <select name="student_id" class="form-control" onchange="this.form.student_name.value = this.options[this.selectedIndex].text">
                    <option value="">— اختر —</option>
                    <?php foreach ($students as $s): ?>
                    <option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <input type="hidden" name="student_name">
            <div class="form-group"><label>اسم الطالب *</label><input type="text" name="student_name" class="form-control" required></div>
            <div class="form-group"><label>التخصص *</label>
                <select name="specialization" class="form-control" required>
                    <option value="">— اختر —</option>
                    <option value="طبية">طبية</option>
                    <option value="تأهيلية">تأهيلية</option>
                    <option value="تقني سامي">تقني سامي</option>
                    <option value="أخرى">أخرى</option>
                </select>
            </div>
            <div class="form-group"><label>رقم الشهادة</label><input type="text" name="certificate_number" class="form-control"></div>
            <div class="form-group"><label>تاريخ التسليم</label><input type="date" name="delivery_date" class="form-control"></div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
