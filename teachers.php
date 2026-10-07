<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('teachers');
$pageTitle = 'الأساتذة';
$activeMenu = 'teachers';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('t.branch_id');
[$brClauseRaw, $brParamsRaw] = branch_filter('branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') {
    $database->execute("DELETE FROM teachers WHERE id = ?", [$_GET['delete']]);
    header('Location: teachers.php?deleted=1');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['name'])) {
        // 🌳 branch_id (الموظف يأخذ فرعه تلقائياً، المدير يختار)
        $teacherBranchId = ($_SESSION['role'] === 'director')
            ? ($data['branch_id'] ?? null)
            : branch_for_new_record();
        if (!empty($data['id'])) {
            $database->execute("UPDATE teachers SET name=?, email=?, phone=?, gender=?, specialty=?, department_id=?, salary=?, hire_date=?, status=?, branch_id=? WHERE id=?",
                [$data['name'], $data['email']??null, $data['phone']??null, $data['gender']??null, $data['specialty']??null, $data['department_id']??null, $data['salary']??0, $data['hire_date']??null, $data['status']??'active', $teacherBranchId, $data['id']]);
        } else {
            $database->execute("INSERT INTO teachers (id, name, email, phone, gender, specialty, department_id, salary, hire_date, status, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                [generate_id(), $data['name'], $data['email']??null, $data['phone']??null, $data['gender']??null, $data['specialty']??null, $data['department_id']??null, $data['salary']??0, $data['hire_date']??null, $data['status']??'active', $teacherBranchId]);
        }
        header('Location: teachers.php?saved=1');
        exit;
    }
}

$departments = $database->fetchAll("SELECT * FROM departments ORDER BY name");
$branches = ($_SESSION['role'] === 'director') ? $database->fetchAll("SELECT * FROM branches WHERE is_active = 1 ORDER BY name") : [];
$editTeacher = null;
if (isset($_GET['edit'])) {
    $editTeacher = $database->fetchOne("SELECT * FROM teachers WHERE id = ?", [$_GET['edit']]);
    // 🌳 صلاحية الوصول للتعديل
    if ($editTeacher && $_SESSION['role'] !== 'director' && $editTeacher['branch_id'] != ($_SESSION['branch_id'] ?? null)) {
        $editTeacher = null;
    }
}

$search = $_GET['search'] ?? '';
$sql = "SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE 1=1";
$params = [];
// 🌳 branch filter
if ($brClause) { $sql .= " AND $brClause"; $params = array_merge($params, $brParams); }
if ($search) {
    $sql .= " AND (t.name LIKE ? OR t.phone LIKE ? OR t.email LIKE ? OR t.specialty LIKE ?)";
    $sp = "%$search%"; $params = array_merge($params, [$sp,$sp,$sp,$sp]);
}
$sql .= " ORDER BY t.name LIMIT 500";
$teachers = $database->fetchAll($sql, $params);

include 'includes/layout.php';
?>

<?php if (isset($_GET['saved'])): ?>
<div class="alert alert-success">✅ تم حفظ الأستاذ بنجاح</div>
<?php elseif (isset($_GET['deleted'])): ?>
<div class="alert alert-success">✅ تم حذف الأستاذ بنجاح</div>
<?php endif; ?>

<div class="card">
    <div class="card-header">
        <h2>🎓 الأساتذة (<?= count($teachers) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة أستاذ</button>
    </div>
    
    <form method="get" style="margin-bottom:20px">
        <input type="text" name="search" value="<?= htmlspecialchars($search) ?>" placeholder="🔍 بحث بالاسم أو الهاتف أو التخصص" class="form-control" style="max-width:400px;display:inline-block">
        <button type="submit" class="btn">بحث</button>
    </form>
    
    <div style="overflow-x:auto">
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>التخصص</th>
                <th>الهاتف</th>
                <th>البريد</th>
                <th>القسم</th>
                <th>الراتب</th>
                <th>تاريخ التوظيف</th>
                <th>الحالة</th>
                <th>إجراءات</th>
            </tr>
        </thead>
        <tbody>
        <?php if (empty($teachers)): ?>
            <tr><td colspan="10" style="text-align:center;color:#999;padding:30px">لا يوجد أساتذة.</td></tr>
        <?php else: foreach ($teachers as $i => $t): ?>
            <tr>
                <td><?= $i+1 ?></td>
                <td style="font-weight:bold"><?= htmlspecialchars($t['name']) ?></td>
                <td><?= htmlspecialchars($t['specialty'] ?? '-') ?></td>
                <td><?= htmlspecialchars($t['phone'] ?? '-') ?></td>
                <td><?= htmlspecialchars($t['email'] ?? '-') ?></td>
                <td><?= htmlspecialchars($t['department_name'] ?? '-') ?></td>
                <td><?= $t['salary'] ? number_format($t['salary'],0).' دج' : '-' ?></td>
                <td><?= format_date($t['hire_date']) ?></td>
                <td>
                    <?php $st = $t['status'] ?? 'active'; ?>
                    <span class="badge badge-<?= $st === 'active' ? 'success' : 'danger' ?>"><?= $st === 'active' ? 'نشط' : 'متوقف' ?></span>
                </td>
                <td>
                    <a href="teachers.php?edit=<?= $t['id'] ?>" class="btn btn-sm btn-secondary">✏️</a>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="teachers.php?delete=<?= $t['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('تأكيد الحذف؟')">🗑️</a>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    </div>
</div>

<div id="addModal" class="modal">
    <div class="modal-content" style="max-width:700px">
        <h2 style="margin-bottom:20px"><?= $editTeacher ? '✏️ تعديل أستاذ' : '➕ إضافة أستاذ جديد' ?></h2>
        <form method="post" action="teachers.php">
            <?php if ($editTeacher): ?>
            <input type="hidden" name="id" value="<?= $editTeacher['id'] ?>">
            <?php endif; ?>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
                <div class="form-group">
                    <label>الاسم *</label>
                    <input type="text" name="name" class="form-control" required value="<?= htmlspecialchars($editTeacher['name'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>التخصص</label>
                    <input type="text" name="specialty" class="form-control" value="<?= htmlspecialchars($editTeacher['specialty'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>الهاتف</label>
                    <input type="tel" name="phone" class="form-control" value="<?= htmlspecialchars($editTeacher['phone'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>البريد</label>
                    <input type="email" name="email" class="form-control" value="<?= htmlspecialchars($editTeacher['email'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>الجنس</label>
                    <select name="gender" class="form-control">
                        <option value="">—</option>
                        <option value="male" <?= ($editTeacher['gender'] ?? '') === 'male' ? 'selected' : '' ?>>ذكر</option>
                        <option value="female" <?= ($editTeacher['gender'] ?? '') === 'female' ? 'selected' : '' ?>>أنثى</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>القسم</label>
                    <select name="department_id" class="form-control">
                        <option value="">—</option>
                        <?php foreach ($departments as $d): ?>
                        <option value="<?= $d['id'] ?>" <?= ($editTeacher['department_id'] ?? '') === $d['id'] ? 'selected' : '' ?>><?= htmlspecialchars($d['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>الراتب (دج)</label>
                    <input type="number" step="0.01" name="salary" class="form-control" value="<?= htmlspecialchars($editTeacher['salary'] ?? '0') ?>">
                </div>
                <div class="form-group">
                    <label>تاريخ التوظيف</label>
                    <input type="date" name="hire_date" class="form-control" value="<?= htmlspecialchars($editTeacher['hire_date'] ?? '') ?>">
                </div>
                <div class="form-group">
                    <label>الحالة</label>
                    <select name="status" class="form-control">
                        <option value="active" <?= ($editTeacher['status'] ?? 'active') === 'active' ? 'selected' : '' ?>>نشط</option>
                        <option value="inactive" <?= ($editTeacher['status'] ?? '') === 'inactive' ? 'selected' : '' ?>>متوقف</option>
                    </select>
                </div>
            </div>

            <?php if ($_SESSION['role'] === 'director' && !empty($branches)): ?>
            <!-- 🌳 Branch selector — director only -->
            <div class="form-group">
                <label>🏢 الفرع</label>
                <select name="branch_id" class="form-control">
                    <option value="">— المقر الرئيسي —</option>
                    <?php foreach ($branches as $b): ?>
                        <option value="<?= htmlspecialchars($b['id']) ?>" <?= ($editTeacher['branch_id'] ?? '')===$b['id']?'selected':'' ?>><?= htmlspecialchars($b['name']) ?><?= !empty($b['code']) ? ' ('.htmlspecialchars($b['code']).')' : '' ?></option>
                    <?php endforeach; ?>
                </select>
                <small style="color:#6b7280">الموظفون من فروع أخرى لن يروا هذا الأستاذ</small>
            </div>
            <?php endif; ?>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:15px">
                <a href="teachers.php" class="btn btn-secondary">إلغاء</a>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>

<script>
<?php if ($editTeacher): ?>
document.getElementById('addModal').style.display = 'flex';
<?php endif; ?>
</script>
<?php include 'includes/footer.php'; ?>
