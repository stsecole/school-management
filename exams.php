<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('exams');
$pageTitle = 'الامتحانات'; $activeMenu = 'exams';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') {
    $database->execute("DELETE FROM exams WHERE id = ?", [$_GET['delete']]);
    header('Location: exams.php?deleted=1'); exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['title']) && !empty($data['exam_date'])) {
        $examBranchId = branch_for_new_record();
        $database->execute("INSERT INTO exams (id, branch_id, title, exam_date, max_score, passing_score, term, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [generate_id(), $examBranchId, $data['title'], $data['exam_date'].':00', $data['max_score']??20, $data['passing_score']??10, $data['term']??'first', $data['status']??'scheduled', $data['notes']??null]);
        header('Location: exams.php?saved=1'); exit;
    }
}
$examsSql = "SELECT * FROM exams WHERE 1=1";
$examsParams = [];
if ($brClause) { $examsSql .= " AND $brClause"; $examsParams = $brParams; }
$examsSql .= " ORDER BY exam_date DESC LIMIT 200";
$exams = $database->fetchAll($examsSql, $examsParams);
include 'includes/layout.php';
?>
<?php if (isset($_GET['saved'])): ?><div class="alert alert-success">✅ تم حفظ الامتحان</div><?php endif; ?>
<?php if (isset($_GET['deleted'])): ?><div class="alert alert-success">✅ تم الحذف</div><?php endif; ?>
<div class="card">
    <div class="card-header"><h2>📝 الامتحانات (<?= count($exams) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة امتحان</button>
    </div>
    <div style="overflow-x:auto">
    <table>
        <thead><tr><th>العنوان</th><th>التاريخ</th><th>الحد الأقصى</th><th>نجاح</th><th>المدة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($exams)): ?>
            <tr><td colspan="7" style="text-align:center;color:#999;padding:20px">لا توجد امتحانات</td></tr>
        <?php else: foreach ($exams as $e): 
            $sLabels = ['scheduled'=>'مجدول','completed'=>'مكتمل','cancelled'=>'ملغى'];
            $sColors = ['scheduled'=>'info','completed'=>'success','cancelled'=>'danger'];
        ?>
            <tr>
                <td style="font-weight:bold"><?= htmlspecialchars($e['title']) ?></td>
                <td><?= format_datetime($e['exam_date']) ?></td>
                <td><?= $e['max_score'] ?></td>
                <td><?= $e['passing_score'] ?></td>
                <td><?= $e['term'] === 'first' ? 'الفصل الأول' : 'الفصل الثاني' ?></td>
                <td><span class="badge badge-<?= $sColors[$e['status']] ?? 'info' ?>"><?= $sLabels[$e['status']] ?? $e['status'] ?></span></td>
                <td>
                    <?php if ($_SESSION['role'] === 'director'): ?>
                    <a href="exams.php?delete=<?= $e['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a>
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
        <h2 style="margin-bottom:20px">➕ إضافة امتحان</h2>
        <form method="post">
            <div class="form-group"><label>العنوان *</label><input type="text" name="title" class="form-control" required></div>
            <div class="form-group"><label>تاريخ الامتحان *</label><input type="datetime-local" name="exam_date" class="form-control" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>الحد الأقصى</label><input type="number" step="0.01" name="max_score" class="form-control" value="20"></div>
                <div class="form-group"><label>درجة النجاح</label><input type="number" step="0.01" name="passing_score" class="form-control" value="10"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>الفصل</label>
                    <select name="term" class="form-control">
                        <option value="first">الفصل الأول</option>
                        <option value="second">الفصل الثاني</option>
                    </select>
                </div>
                <div class="form-group"><label>الحالة</label>
                    <select name="status" class="form-control">
                        <option value="scheduled">مجدول</option>
                        <option value="completed">مكتمل</option>
                        <option value="cancelled">ملغى</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
