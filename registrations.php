<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('registrations');
$pageTitle = 'التسجيلات'; $activeMenu = 'registrations';
$database = db();

// 🌳 branch scope (registrations has branch_id; students has branch_id)
[$brClause, $brParams] = branch_filter('r.branch_id');
[$brClauseS, $brParamsS] = branch_filter('s.branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') { $database->execute("DELETE FROM registrations WHERE id = ?", [$_GET['delete']]); header('Location: registrations.php?deleted=1'); exit; }
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['student_id']) && !empty($data['course_name'])) {
        $regBranchId = branch_for_new_record();
        $database->execute("INSERT INTO registrations (id, student_id, course_id, course_name, level, specialty, date, note, branch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())", [generate_id(), $data['student_id'], $data['course_id']??null, $data['course_name'], $data['level']??null, $data['specialty']??null, $data['note']??null, $regBranchId]);
        header('Location: registrations.php?saved=1'); exit;
    }
}

// 🌳 students filtered by branch
$studentsSql = "SELECT id, name FROM students WHERE 1=1";
$studentsParams = [];
if ($brClauseS) { $studentsSql .= " AND $brClauseS"; $studentsParams = $brParamsS; }
$studentsSql .= " ORDER BY name";
$students = $database->fetchAll($studentsSql, $studentsParams);

$courses = $database->fetchAll("SELECT id, name FROM courses ORDER BY name");

// 🌳 registrations filtered by branch
$regsSql = "SELECT r.*, s.name as student_name FROM registrations r LEFT JOIN students s ON r.student_id = s.id WHERE 1=1";
$regsParams = [];
if ($brClause) { $regsSql .= " AND $brClause"; $regsParams = $brParams; }
$regsSql .= " ORDER BY r.date DESC LIMIT 500";
$regs = $database->fetchAll($regsSql, $regsParams);
include 'includes/layout.php';
?>
<?php if (isset($_GET['saved'])): ?><div class="alert alert-success">✅ تم حفظ التسجيل</div><?php endif; ?>
<?php if (isset($_GET['deleted'])): ?><div class="alert alert-success">✅ تم الحذف</div><?php endif; ?>
<div class="card">
    <div class="card-header"><h2>📋 التسجيلات (<?= count($regs) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ تسجيل جديد</button>
    </div>
    <div style="overflow-x:auto"><table>
        <thead><tr><th>التاريخ</th><th>الطالب</th><th>الدورة</th><th>المستوى</th><th>التخصص</th><th>ملاحظة</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($regs)): ?><tr><td colspan="7" style="text-align:center;color:#999;padding:20px">لا توجد تسجيلات</td></tr>
        <?php else: foreach ($regs as $r): ?>
            <tr><td><?= format_datetime($r['date']) ?></td><td style="font-weight:bold"><?= htmlspecialchars($r['student_name']??'-') ?></td><td><?= htmlspecialchars($r['course_name']) ?></td><td><?= htmlspecialchars($r['level']??'-') ?></td><td><?= htmlspecialchars($r['specialty']??'-') ?></td><td><?= htmlspecialchars(mb_substr($r['note']??'', 0, 40)) ?></td>
            <td><?php if ($_SESSION['role']==='director'): ?><a href="registrations.php?delete=<?= $r['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a><?php endif; ?></td></tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table></div>
</div>
<div id="addModal" class="modal"><div class="modal-content">
    <h2 style="margin-bottom:20px">➕ تسجيل جديد</h2>
    <form method="post">
        <div class="form-group"><label>الطالب *</label><select name="student_id" class="form-control" required><option value="">— اختر —</option><?php foreach ($students as $s): ?><option value="<?= $s['id'] ?>"><?= htmlspecialchars($s['name']) ?></option><?php endforeach; ?></select></div>
        <div class="form-group"><label>الدورة *</label><input type="text" name="course_name" class="form-control" required list="courses-list"></div>
        <datalist id="courses-list"><?php foreach ($courses as $c): ?><option value="<?= htmlspecialchars($c['name']) ?>"><?php endforeach; ?></datalist>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label>المستوى</label><input type="text" name="level" class="form-control"></div>
            <div class="form-group"><label>التخصص</label><input type="text" name="specialty" class="form-control"></div>
        </div>
        <div class="form-group"><label>ملاحظة</label><textarea name="note" class="form-control" rows="2"></textarea></div>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button><button type="submit" class="btn">💾 حفظ</button></div>
    </form>
</div></div>
<?php include 'includes/footer.php'; ?>
