<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('tasks');
$pageTitle = 'المهام'; $activeMenu = 'tasks';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');

if (isset($_GET['toggle'])) {
    $database->execute("UPDATE tasks SET completed = NOT completed WHERE id = ?", [$_GET['toggle']]);
    header('Location: tasks.php'); exit;
}
if (isset($_GET['delete'])) {
    $database->execute("DELETE FROM tasks WHERE id = ?", [$_GET['delete']]);
    header('Location: tasks.php'); exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['title'])) {
        $taskBranchId = branch_for_new_record();
        $database->execute("INSERT INTO tasks (id, title, priority, responsible, deadline, completed, status, notes, branch_id, created_at) VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?, NOW())",
            [generate_id(), $data['title'], $data['priority']??'medium', $data['responsible']??null, $data['deadline']??null, $data['notes']??null, $taskBranchId]);
        header('Location: tasks.php'); exit;
    }
}

$tasksSql = "SELECT * FROM tasks WHERE 1=1";
$tasksParams = [];
if ($brClause) { $tasksSql .= " AND $brClause"; $tasksParams = $brParams; }
$tasksSql .= " ORDER BY completed ASC, deadline ASC, created_at DESC LIMIT 200";
$tasks = $database->fetchAll($tasksSql, $tasksParams);
include 'includes/layout.php';
?>
<div class="card">
    <div class="card-header"><h2>✅ المهام (<?= count($tasks) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة مهمة</button>
    </div>
    <div style="overflow-x:auto">
    <table>
        <thead><tr><th>✓</th><th>المهمة</th><th>الأولوية</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($tasks)): ?>
            <tr><td colspan="7" style="text-align:center;color:#999;padding:20px">لا توجد مهام</td></tr>
        <?php else: foreach ($tasks as $t): 
            $pColors = ['high'=>'danger','medium'=>'warning','low'=>'info'];
            $pLabels = ['high'=>'عالية','medium'=>'متوسطة','low'=>'منخفضة'];
        ?>
            <tr style="<?= $t['completed'] ? 'opacity:.5' : '' ?>">
                <td><a href="tasks.php?toggle=<?= $t['id'] ?>" class="btn btn-sm <?= $t['completed'] ? 'btn-success' : 'btn-secondary' ?>"><?= $t['completed'] ? '✓' : '○' ?></a></td>
                <td style="font-weight:bold;<?= $t['completed'] ? 'text-decoration:line-through' : '' ?>"><?= htmlspecialchars($t['title']) ?></td>
                <td><span class="badge badge-<?= $pColors[$t['priority']] ?? 'info' ?>"><?= $pLabels[$t['priority']] ?? $t['priority'] ?></span></td>
                <td><?= htmlspecialchars($t['responsible'] ?? '-') ?></td>
                <td><?= format_date($t['deadline']) ?></td>
                <td><?= $t['completed'] ? '<span class="badge badge-success">مكتملة</span>' : '<span class="badge badge-warning">قيد التنفيذ</span>' ?></td>
                <td><a href="tasks.php?delete=<?= $t['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a></td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    </div>
</div>
<div id="addModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">➕ إضافة مهمة</h2>
        <form method="post">
            <div class="form-group"><label>المهمة *</label><input type="text" name="title" class="form-control" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>الأولوية</label>
                    <select name="priority" class="form-control">
                        <option value="medium">متوسطة</option>
                        <option value="high">عالية</option>
                        <option value="low">منخفضة</option>
                    </select>
                </div>
                <div class="form-group"><label>الموعد النهائي</label><input type="date" name="deadline" class="form-control"></div>
            </div>
            <div class="form-group"><label>المسؤول</label><input type="text" name="responsible" class="form-control"></div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="2"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
