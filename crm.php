<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('crm');
$pageTitle = 'العملاء المحتملون'; $activeMenu = 'crm';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('branch_id');

if (isset($_GET['delete'])) {
    $database->execute("DELETE FROM leads WHERE id = ?", [$_GET['delete']]);
    header('Location: crm.php'); exit;
}
if (isset($_GET['status'])) {
    $database->execute("UPDATE leads SET status = ? WHERE id = ?", [$_GET['status'], $_GET['id']]);
    header('Location: crm.php'); exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['full_name']) && !empty($data['phone'])) {
        $leadBranchId = branch_for_new_record();
        $database->execute("INSERT INTO leads (id, branch_id, full_name, phone, phone2, email, gender, source, desired_course, status, interest_level, notes, first_contact_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [generate_id(), $leadBranchId, $data['full_name'], $data['phone'], $data['phone2']??null, $data['email']??null, $data['gender']??null, $data['source']??'أخرى', $data['desired_course']??null, $data['status']??'new', $data['interest_level']??'medium', $data['notes']??null]);
        header('Location: crm.php'); exit;
    }
}
$search = $_GET['search'] ?? '';
$sql = "SELECT * FROM leads WHERE 1=1"; $params = [];
if ($brClause) { $sql .= " AND $brClause"; $params = array_merge($params, $brParams); }
if ($search) { $sql .= " AND (full_name LIKE ? OR phone LIKE ?)"; $sp="%$search%"; $params=array_merge($params, [$sp,$sp]); }
$sql .= " ORDER BY created_at DESC LIMIT 200";
$leads = $database->fetchAll($sql, $params);
include 'includes/layout.php';
?>
<div class="card">
    <div class="card-header"><h2>🎯 العملاء المحتملون (<?= count($leads) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة عميل</button>
    </div>
    <form method="get" style="margin-bottom:15px">
        <input type="text" name="search" value="<?= htmlspecialchars($search) ?>" placeholder="🔍 بحث" class="form-control" style="max-width:400px;display:inline-block">
        <button type="submit" class="btn">بحث</button>
    </form>
    <div style="overflow-x:auto">
    <table>
        <thead><tr><th>#</th><th>الاسم</th><th>الهاتف</th><th>المصدر</th><th>الدورة</th><th>الحالة</th><th>الإهتمام</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($leads)): ?>
            <tr><td colspan="8" style="text-align:center;color:#999;padding:20px">لا يوجد عملاء</td></tr>
        <?php else: foreach ($leads as $i => $l): 
            $sColors = ['new'=>'info','contacted'=>'warning','interested'=>'info','converted'=>'success','lost'=>'danger'];
            $sLabels = ['new'=>'جديد','contacted'=>'تم التواصل','interested'=>'مهتم','converted'=>'تم التحويل','lost'=>'فقد'];
            $iColors = ['high'=>'danger','medium'=>'warning','low'=>'info'];
            $iLabels = ['high'=>'عالي','medium'=>'متوسط','low'=>'منخفض'];
        ?>
            <tr>
                <td><?= $i+1 ?></td>
                <td style="font-weight:bold"><?= htmlspecialchars($l['full_name']) ?></td>
                <td><?= htmlspecialchars($l['phone']) ?></td>
                <td><?= htmlspecialchars($l['source'] ?? '-') ?></td>
                <td><?= htmlspecialchars($l['desired_course'] ?? '-') ?></td>
                <td><span class="badge badge-<?= $sColors[$l['status']] ?? 'info' ?>"><?= $sLabels[$l['status']] ?? $l['status'] ?></span></td>
                <td><span class="badge badge-<?= $iColors[$l['interest_level']] ?? 'info' ?>"><?= $iLabels[$l['interest_level']] ?? $l['interest_level'] ?></span></td>
                <td>
                    <select onchange="window.location='crm.php?status='+this.value+'&id=<?= $l['id'] ?>'" style="padding:4px;border-radius:4px;border:1px solid #ddd">
                        <option value="">تغيير الحالة</option>
                        <option value="contacted">تم التواصل</option>
                        <option value="interested">مهتم</option>
                        <option value="converted">تم التحويل</option>
                        <option value="lost">فقد</option>
                    </select>
                    <a href="crm.php?delete=<?= $l['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')">🗑️</a>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table>
    </div>
</div>
<div id="addModal" class="modal">
    <div class="modal-content">
        <h2 style="margin-bottom:20px">➕ إضافة عميل محتمل</h2>
        <form method="post">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>الاسم *</label><input type="text" name="full_name" class="form-control" required></div>
                <div class="form-group"><label>الهاتف *</label><input type="tel" name="phone" class="form-control" required></div>
                <div class="form-group"><label>هاتف 2</label><input type="tel" name="phone2" class="form-control"></div>
                <div class="form-group"><label>البريد</label><input type="email" name="email" class="form-control"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label>المصدر</label>
                    <select name="source" class="form-control">
                        <option value="أخرى">أخرى</option>
                        <option value="فيسبوك">فيسبوك</option>
                        <option value="إنستغرام">إنستغرام</option>
                        <option value="موقع ويب">موقع ويب</option>
                        <option value="إحالة">إحالة</option>
                        <option value="زيارة">زيارة</option>
                    </select>
                </div>
                <div class="form-group"><label>الدورة المطلوبة</label><input type="text" name="desired_course" class="form-control"></div>
            </div>
            <div class="form-group"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="3"></textarea></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('addModal').style.display='none'">إلغاء</button>
                <button type="submit" class="btn">💾 حفظ</button>
            </div>
        </form>
    </div>
</div>
<?php include 'includes/footer.php'; ?>
