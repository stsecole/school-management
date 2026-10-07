<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('attendance');
$pageTitle = 'الحضور';
$activeMenu = 'attendance';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');
[$brClauseT, $brParamsT] = branch_filter('teachers.branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') {
    $database->execute("DELETE FROM attendance WHERE id = ?", [$_GET['delete']]);
    header('Location: attendance.php?deleted=1');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['course_name'])) {
        $attBranchId = branch_for_new_record();
        $database->execute("INSERT INTO attendance (id, date, course_name, level, teacher_id, teacher_name, total_count, male_count, female_count, duration_minutes, notes, branch_id, created_at) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [generate_id(), $data['course_name'], $data['level']??null, $data['teacher_id']??null, $data['teacher_name']??null, $data['total_count']??0, $data['male_count']??0, $data['female_count']??0, $data['duration_minutes']??0, $data['notes']??null, $attBranchId]);
        header('Location: attendance.php?saved=1');
        exit;
    }
}

// 🌳 teachers filtered by branch
$teachersSql = "SELECT id, name FROM teachers WHERE 1=1";
$teachersParams = [];
if ($brClauseT) { $teachersSql .= " AND $brClauseT"; $teachersParams = $brParamsT; }
$teachersSql .= " ORDER BY name";
$teachers = $database->fetchAll($teachersSql, $teachersParams);

$search = $_GET['search'] ?? '';
$sql = "SELECT * FROM attendance WHERE 1=1";
$params = [];
// 🌳 branch filter
if ($brClause) { $sql .= " AND $brClause"; $params = array_merge($params, $brParams); }
if ($search) { $sql .= " AND (course_name LIKE ? OR teacher_name LIKE ?)"; $sp="%$search%"; $params=array_merge($params, [$sp,$sp]); }
$sql .= " ORDER BY date DESC LIMIT 200";
$records = $database->fetchAll($sql, $params);

include 'includes/layout.php';
?>

<?php if (isset($_GET['saved'])): ?>
<div class="alert alert-success">✅ تم حفظ سجل الحضور</div>
<?php elseif (isset($_GET['deleted'])): ?>
<div class="alert alert-success">✅ تم الحذف</div>
<?php endif; ?>

<div class="card">
    <div class="card-header">
        <h2>📋 سجل الحضور</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ تسجيل حصة</button>
    </div>
    <form method="get" style="margin-bottom:15px">
        <input type="text" name="search" value="<?= htmlspecialchars($search) ?>" placeholder="🔍 بحث" class="form-control" style="max-width:400px;display:inline-block">
        <button type="submit" class="btn">بحث</button>
    </form>
    <div style="overflow-x:auto">
    <table>
        <thead><tr><th>التاريخ</th><th>الدورة</th><th>المستوى</th><th>الأستاذ</th><th>العدد</th><th>ذكور</th><th>إناث</th><th>المدة(د)</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($records)): ?>
            <tr><td colspan="9" style="text-align:center;color:#999;padding:20px">لا توجد سجلات</td></tr>
        <?php else: foreach ($records as $r): ?>
            <tr>
                <td><?= format_datetime($r['date']) ?></td>
                <td style="font-weight:bold"><?= htmlspecialchars($r['course_name']) ?></td>
                <td><?= htmlspecialchars($r['level'] ?? '-') ?></td>
                <td><?= htmlspecialchars($r['teacher_name'] ?? '-') ?></td>
                <td><span class="badge badge-info"><?= $r['total_count'] ?></span></td>
                <td><?= $r['male_count'] ?></td>
                <td><?= $r['female_count'] ?></td>
                <td><?= $r['duration_minutes'] ?></td>
                <td>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="attendance.php?delete=<?= $r['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a>
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
        <h2 style="margin-bottom:20px">➕ تسجيل حصة حضور</h2>
        <form method="post">
            <div class="form-group"><label>اسم الدورة *</label><input type="text" name="course_name" class="form-control" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>المستوى</label><input type="text" name="level" class="form-control"></div>
                <div class="form-group"><label>الأستاذ</label>
                    <select name="teacher_id" class="form-control" onchange="this.form.teacher_name.value = this.options[this.selectedIndex].text">
                        <option value="">—</option>
                        <?php foreach ($teachers as $t): ?>
                        <option value="<?= $t['id'] ?>"><?= htmlspecialchars($t['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <input type="hidden" name="teacher_name" value="">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="form-group"><label>العدد الإجمالي</label><input type="number" name="total_count" class="form-control" value="0"></div>
                <div class="form-group"><label>ذكور</label><input type="number" name="male_count" class="form-control" value="0"></div>
                <div class="form-group"><label>إناث</label><input type="number" name="female_count" class="form-control" value="0"></div>
            </div>
            <div class="form-group"><label>المدة (دقيقة)</label><input type="number" name="duration_minutes" class="form-control" value="0"></div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
