<?php
require_once __DIR__ . '/includes/helpers.php';
if (!is_logged_in()) { header('Location: index.php'); exit; }
require_section_access('students');
$pageTitle = 'الطلاب'; $activeMenu = 'students';
$database = db();

// 🌳 branch scope
[$brClause, $brParams] = branch_filter('s.branch_id');
[$brClauseRaw, $brParamsRaw] = branch_filter('branch_id');

if (isset($_GET['delete']) && $_SESSION['role'] === 'director') {
    // مدير فقط، ولا يمكن حذف طالب من فرع آخر بدون صلاحية (نتحقق)
    $target = $database->fetchOne("SELECT id FROM students WHERE id = ?", [$_GET['delete']]);
    if (!$target) { header('Location: students.php?deleted=1'); exit; }
    $database->execute("DELETE FROM students WHERE id = ?", [$_GET['delete']]);
    header('Location: students.php?deleted=1'); exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = $_POST;
    if (!empty($data['name'])) {
        $boolFields = ['doc_photos','doc_birth_cert','doc_id_card','doc_ts_photos','doc_ts_birth_certs','doc_ts_id_cards','doc_school_cert','doc_medical_cert','doc_practical_training','doc_certificate_received'];
        foreach ($boolFields as $bf) { $data[$bf] = isset($data[$bf]) ? 1 : 0; }
        $photoUrl = $data['photo_url_existing'] ?? null;
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
                $fn = 'student_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                if (!is_dir(UPLOAD_PATH)) mkdir(UPLOAD_PATH, 0777, true);
                if (move_uploaded_file($_FILES['photo']['tmp_name'], UPLOAD_PATH . $fn)) $photoUrl = 'uploads/' . $fn;
            }
        }
        // 🌳 خذ branch_id: الموظف يأخذ فرعه تلقائياً؛ المدير يستخدم ما يحدده في الفورم
        $branchId = ($_SESSION['role'] === 'director')
            ? ($data['branch_id'] ?? null)
            : branch_for_new_record();

        $v = [
            $data['student_number']??null, $data['name'], $data['email']??null, $data['phone']??null,
            $data['gender']??null, $data['birth_date']??null, $data['address']??null,
            $data['department_id']??null, $data['level_id']??null, $data['specialization_id']??null,
            $data['section']??null, $data['college']??null, $data['specialty']??null,
            $data['course_start_date']??null, $data['total_amount']??null, $data['initial_payment']??0,
            $data['status']??'registered', $data['doc_photos'], $data['doc_birth_cert'], $data['doc_id_card'],
            $data['doc_ts_photos'], $data['doc_ts_birth_certs'], $data['doc_ts_id_cards'],
            $data['doc_school_cert'], $data['doc_medical_cert'], $data['doc_practical_training'],
            $data['practical_start_date']??null, $data['practical_end_date']??null,
            $data['doc_certificate_received'], $data['certificate_received_date']??null,
            $data['school_name']??null, $data['education_level']??null, $data['school_stream']??null,
            $data['school_year']??null, $data['notes']??null, $photoUrl, $branchId
        ];
        if (!empty($data['id'])) {
            // 🌳 تحقق أن المستخدم يملك صلاحية تعديل هذا الطالب (نفس فرعه أو مدير)
            $existing = $database->fetchOne("SELECT branch_id FROM students WHERE id = ?", [$data['id']]);
            $canModify = $existing && ($_SESSION['role'] === 'director' || $existing['branch_id'] == ($_SESSION['branch_id'] ?? null));
            if (!$canModify) {
                header('Location: students.php?forbidden=1'); exit;
            }
            $v[] = $data['id'];
            $database->execute("UPDATE students SET student_number=?,name=?,email=?,phone=?,gender=?,birth_date=?,address=?,department_id=?,level_id=?,specialization_id=?,section=?,college=?,specialty=?,course_start_date=?,total_amount=?,initial_payment=?,status=?,doc_photos=?,doc_birth_cert=?,doc_id_card=?,doc_ts_photos=?,doc_ts_birth_certs=?,doc_ts_id_cards=?,doc_school_cert=?,doc_medical_cert=?,doc_practical_training=?,practical_start_date=?,practical_end_date=?,doc_certificate_received=?,certificate_received_date=?,school_name=?,education_level=?,school_stream=?,school_year=?,notes=?,photo_url=?,branch_id=? WHERE id=?", $v);
        } else {
            // Count within scope (branch-aware)
            $countSql = "SELECT COUNT(*) FROM students WHERE 1=1";
            $countParams = [];
            if ($brClauseRaw) { $countSql .= " AND $brClauseRaw"; $countParams = $brParamsRaw; }
            $count = $database->count($countSql, $countParams);
            $sn = $data['student_number'] ?? ('STU-' . date('Y') . '-' . str_pad($count+1, 3, '0', STR_PAD_LEFT));
            $v[0] = $sn;
            $v2 = array_merge([generate_id()], $v);
            $database->execute("INSERT INTO students (id,student_number,name,email,phone,gender,birth_date,address,department_id,level_id,specialization_id,section,college,specialty,course_start_date,total_amount,initial_payment,registration_date,status,doc_photos,doc_birth_cert,doc_id_card,doc_ts_photos,doc_ts_birth_certs,doc_ts_id_cards,doc_school_cert,doc_medical_cert,doc_practical_training,practical_start_date,practical_end_date,doc_certificate_received,certificate_received_date,school_name,education_level,school_stream,school_year,notes,photo_url,branch_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())", $v2);
        }
        header('Location: students.php?saved=1'); exit;
    }
}

$departments = $database->fetchAll("SELECT * FROM departments ORDER BY name");
$levels = $database->fetchAll("SELECT * FROM levels ORDER BY order_num");
$specializations = $database->fetchAll("SELECT * FROM specializations ORDER BY name");
$specsByDept = [];
foreach ($specializations as $sp) { $specsByDept[$sp['department_id']][] = ['id'=>$sp['id'],'name'=>$sp['name']]; }
$editStudent = null;
if (isset($_GET['edit'])) {
    $editStudent = $database->fetchOne("SELECT * FROM students WHERE id = ?", [$_GET['edit']]);
    // 🌳 تحقق من الصلاحية قبل السماح بالتعديل
    if ($editStudent && $_SESSION['role'] !== 'director' && $editStudent['branch_id'] != ($_SESSION['branch_id'] ?? null)) {
        $editStudent = null;
    }
}
$search = $_GET['search'] ?? ''; $deptFilter = $_GET['department_id'] ?? ''; $statusFilter = $_GET['status'] ?? ''; $specFilter = $_GET['specialization_id'] ?? '';
$sql = "SELECT s.*, d.name as department_name, d.has_installments, l.name as level_name FROM students s LEFT JOIN departments d ON s.department_id = d.id LEFT JOIN levels l ON s.level_id = l.id WHERE 1=1";
$params = [];
// 🌳 branch filter
if ($brClause) { $sql .= " AND $brClause"; $params = array_merge($params, $brParams); }
if ($search) { $sql .= " AND (s.name LIKE ? OR s.student_number LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)"; $sp="%$search%"; $params=array_merge($params, [$sp,$sp,$sp,$sp]); }
if ($deptFilter) { $sql .= " AND s.department_id = ?"; $params[] = $deptFilter; }
if ($specFilter) { $sql .= " AND s.specialization_id = ?"; $params[] = $specFilter; }
if ($statusFilter) { $sql .= " AND s.status = ?"; $params[] = $statusFilter; }
$sql .= " ORDER BY s.created_at DESC LIMIT 500";
$students = $database->fetchAll($sql, $params);

// 🌳 Branch list for director's create form
$branches = ($_SESSION['role'] === 'director') ? $database->fetchAll("SELECT * FROM branches WHERE is_active = 1 ORDER BY name") : [];

include 'includes/layout.php';
?>

<?php if (isset($_GET['saved'])): ?><div class="alert alert-success">✅ تم حفظ الطالب</div><?php endif; ?>
<?php if (isset($_GET['deleted'])): ?><div class="alert alert-success">✅ تم حذف الطالب</div><?php endif; ?>
<?php if (isset($_GET['forbidden'])): ?><div class="alert alert-error">⛔ لا تملك صلاحية الوصول لهذا الطالب (فرع آخر)</div><?php endif; ?>

<div class="card">
    <div class="card-header"><h2>👥 الطلاب (<?= count($students) ?>)</h2>
        <button class="btn" onclick="document.getElementById('addModal').style.display='flex'">➕ إضافة طالب</button>
    </div>
    <form method="get" style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <input type="text" name="search" value="<?= htmlspecialchars($search) ?>" placeholder="🔍 بحث" class="form-control" style="flex:1;min-width:200px">
        <select name="department_id" id="filterDept" class="form-control" style="max-width:200px" onchange="updateFilterSpecs()">
            <option value="">كل الأقسام</option>
            <?php foreach ($departments as $d): ?><option value="<?= $d['id'] ?>" <?= $deptFilter===$d['id']?'selected':'' ?>><?= htmlspecialchars($d['name']) ?></option><?php endforeach; ?>
        </select>
        <select name="specialization_id" id="filterSpec" class="form-control" style="max-width:200px"><option value="">كل التخصصات</option></select>
        <select name="status" class="form-control" style="max-width:150px">
            <option value="">كل الحالات</option>
            <option value="registered" <?= $statusFilter==='registered'?'selected':'' ?>>مسجل</option>
            <option value="continuing" <?= $statusFilter==='continuing'?'selected':'' ?>>مستمر</option>
            <option value="graduated" <?= $statusFilter==='graduated'?'selected':'' ?>>متخرج</option>
            <option value="abandoned" <?= $statusFilter==='abandoned'?'selected':'' ?>>منقطع</option>
            <option value="postponed" <?= $statusFilter==='postponed'?'selected':'' ?>>مؤجل</option>
        </select>
        <button type="submit" class="btn">بحث</button>
    </form>
    <div style="overflow-x:auto"><table>
        <thead><tr><th>#</th><th>رقم الطالب</th><th>الاسم</th><th>الهاتف</th><th>القسم</th><th>المستوى</th><th>المبلغ</th><th>الدفعة</th><th>المستندات</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
        <?php if (empty($students)): ?>
            <tr><td colspan="11" style="text-align:center;color:#999;padding:30px">لا يوجد طلاب</td></tr>
        <?php else: foreach ($students as $i => $s):
            $sL=['registered'=>'مسجل','continuing'=>'مستمر','graduated'=>'متخرج','abandoned'=>'منقطع','postponed'=>'مؤجل'];
            $sC=['registered'=>'info','continuing'=>'success','graduated'=>'warning','abandoned'=>'danger','postponed'=>'warning'];
            $st=$s['status']??'registered';
            $dc=($s['doc_photos']??0)+($s['doc_birth_cert']??0)+($s['doc_id_card']??0)+($s['doc_ts_photos']??0)+($s['doc_ts_birth_certs']??0)+($s['doc_ts_id_cards']??0)+($s['doc_school_cert']??0)+($s['doc_medical_cert']??0)+($s['doc_practical_training']??0)+($s['doc_certificate_received']??0);
        ?>
            <tr>
                <td><?= $i+1 ?></td>
                <td><code><?= htmlspecialchars($s['student_number']??'-') ?></code></td>
                <td style="font-weight:bold;display:flex;align-items:center;gap:8px">
                    <?php if (!empty($s['photo_url'])): ?><img src="<?= htmlspecialchars($s['photo_url']) ?>" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb"><?php else: ?><div style="width:30px;height:30px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:14px">👤</div><?php endif; ?>
                    <?= htmlspecialchars($s['name']) ?>
                </td>
                <td><?= htmlspecialchars($s['phone']??'-') ?></td>
                <td><?= htmlspecialchars($s['department_name']??'-') ?></td>
                <td><?= htmlspecialchars($s['level_name']??'-') ?></td>
                <td><?= $s['total_amount']?number_format($s['total_amount'],0).' دج':'-' ?></td>
                <td><?= $s['initial_payment']?number_format($s['initial_payment'],0).' دج':'-' ?></td>
                <td><span class="badge badge-<?= $dc>0?'success':'danger' ?>"><?= $dc ?> ملف</span></td>
                <td><span class="badge badge-<?= $sC[$st]??'info' ?>"><?= $sL[$st]??$st ?></span></td>
                <td style="white-space:nowrap">
                    <a href="student-stats.php?id=<?= $s['id'] ?>" class="btn btn-sm" title="إحصائيات" target="_blank">📊</a>
                    <?php if (!empty($s['has_installments'])): ?><a href="student-installments.php?id=<?= $s['id'] ?>" class="btn btn-sm" title="الأقساط" target="_blank">📅</a><?php endif; ?>
                    <a href="students.php?edit=<?= $s['id'] ?>" class="btn btn-sm btn-secondary" title="تعديل">✏️</a>
                    <?php if ($_SESSION['role']==='director'): ?><a href="students.php?delete=<?= $s['id'] ?>" class="btn btn-sm btn-danger" onclick="return confirm('حذف؟')" title="حذف">🗑️</a><?php endif; ?>
                </td>
            </tr>
        <?php endforeach; endif; ?>
        </tbody>
    </table></div>
</div>

<div id="addModal" class="modal"><div class="modal-content" style="max-width:800px">
    <h2 style="margin-bottom:20px"><?= $editStudent?'✏️ تعديل طالب':'➕ إضافة طالب' ?></h2>
    <form method="post" action="students.php" enctype="multipart/form-data">
        <?php if ($editStudent): ?><input type="hidden" name="id" value="<?= $editStudent['id'] ?>"><?php endif; ?>
        <input type="hidden" name="photo_url_existing" value="<?= htmlspecialchars($editStudent['photo_url']??'') ?>">
        
        <!-- 📷 صورة الطالب -->
        <div class="form-group">
            <label>📷 صورة الطالب</label>
            <div style="display:flex;align-items:flex-start;gap:15px;padding:15px;border:2px dashed #d1d5db;border-radius:10px;background:#f9fafb">
                <div style="flex-shrink:0">
                    <?php $pU=$editStudent['photo_url']??''; ?>
                    <?php if ($pU): ?>
                    <div style="position:relative"><img src="<?= htmlspecialchars($pU) ?>" alt="" style="width:80px;height:80px;border-radius:8px;object-fit:cover;border:2px solid #7c3aed" id="photoPreview"><button type="button" onclick="removePhoto()" style="position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button></div>
                    <?php else: ?>
                    <div style="width:80px;height:80px;border-radius:8px;background:#e5e7eb;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:32px" id="photoPlaceholder">👤</div>
                    <?php endif; ?>
                </div>
                <div style="flex:1"><input type="file" name="photo" id="photoInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="display:none" onchange="previewPhoto(this)"><button type="button" class="btn btn-secondary" onclick="document.getElementById('photoInput').click()"><?= $pU?'📤 تغيير الصورة':'📤 رفع صورة' ?></button><p style="font-size:11px;color:#999;margin-top:5px">JPG, PNG, WEBP, GIF - حد أقصى 5 ميجا</p></div>
            </div>
        </div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">📋 البيانات الأساسية</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px">
            <div class="form-group"><label>الاسم *</label><input type="text" name="name" class="form-control" required value="<?= htmlspecialchars($editStudent['name']??'') ?>"></div>
            <div class="form-group"><label>رقم الطالب</label><input type="text" name="student_number" class="form-control" value="<?= htmlspecialchars($editStudent['student_number']??'') ?>"></div>
            <div class="form-group"><label>الحالة</label><select name="status" class="form-control"><option value="registered" <?= ($editStudent['status']??'registered')==='registered'?'selected':'' ?>>مسجل</option><option value="continuing" <?= ($editStudent['status']??'')==='continuing'?'selected':'' ?>>مستمر</option><option value="graduated" <?= ($editStudent['status']??'')==='graduated'?'selected':'' ?>>متخرج</option><option value="abandoned" <?= ($editStudent['status']??'')==='abandoned'?'selected':'' ?>>منقطع</option><option value="postponed" <?= ($editStudent['status']??'')==='postponed'?'selected':'' ?>>مؤجل</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px">
            <div class="form-group"><label>الهاتف</label><input type="tel" name="phone" class="form-control" value="<?= htmlspecialchars($editStudent['phone']??'') ?>"></div>
            <div class="form-group"><label>البريد</label><input type="email" name="email" class="form-control" value="<?= htmlspecialchars($editStudent['email']??'') ?>"></div>
            <div class="form-group"><label>الجنس</label><select name="gender" class="form-control"><option value="">—</option><option value="male" <?= ($editStudent['gender']??'')==='male'?'selected':'' ?>>ذكر</option><option value="female" <?= ($editStudent['gender']??'')==='female'?'selected':'' ?>>أنثى</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
            <div class="form-group"><label>تاريخ الميلاد</label><input type="date" name="birth_date" class="form-control" value="<?= htmlspecialchars($editStudent['birth_date']??'') ?>"></div>
            <div class="form-group"><label>العنوان</label><input type="text" name="address" class="form-control" value="<?= htmlspecialchars($editStudent['address']??'') ?>"></div>
        </div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">🎓 البيانات الأكاديمية</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px">
            <div class="form-group"><label>القسم</label><select name="department_id" id="formDept" class="form-control" onchange="updateFormSpecs();checkInstallments()"><option value="">— اختر القسم أولاً —</option><?php foreach ($departments as $d): ?><option value="<?= $d['id'] ?>" <?= ($editStudent['department_id']??'')===$d['id']?'selected':'' ?>><?= htmlspecialchars($d['name']) ?></option><?php endforeach; ?></select></div>
            <div class="form-group"><label>المستوى</label><select name="level_id" class="form-control"><option value="">—</option><?php foreach ($levels as $l): ?><option value="<?= $l['id'] ?>" <?= ($editStudent['level_id']??'')===$l['id']?'selected':'' ?>><?= htmlspecialchars($l['name']) ?></option><?php endforeach; ?></select></div>
            <div class="form-group"><label>التخصص</label><select name="specialization_id" id="formSpec" class="form-control" <?= empty($editStudent['department_id']??'')?'disabled':'' ?>><option value=""><?= empty($editStudent['department_id']??'')?'اختر القسم أولاً':'—' ?></option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
            <div class="form-group"><label>الشعبة</label><input type="text" name="section" class="form-control" value="<?= htmlspecialchars($editStudent['section']??'') ?>"></div>
            <div class="form-group"><label>الكلية/الجامعة</label><input type="text" name="college" class="form-control" value="<?= htmlspecialchars($editStudent['college']??'') ?>"></div>
        </div>
        <div class="form-group"><label>التخصص (نص حر)</label><input type="text" name="specialty" class="form-control" value="<?= htmlspecialchars($editStudent['specialty']??'') ?>"></div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">💰 المالية</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px">
            <div class="form-group"><label>تاريخ بداية الدورة</label><input type="date" name="course_start_date" class="form-control" value="<?= htmlspecialchars($editStudent['course_start_date']??'') ?>"></div>
            <div class="form-group"><label>المبلغ الإجمالي (دج)</label><input type="number" step="0.01" name="total_amount" class="form-control" value="<?= htmlspecialchars($editStudent['total_amount']??'') ?>"></div>
            <div class="form-group"><label>الدفعة الأولى (دج)</label><input type="number" step="0.01" name="initial_payment" class="form-control" value="<?= htmlspecialchars($editStudent['initial_payment']??'0') ?>"></div>
        </div>
        <div id="installmentInfo" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:15px;margin-top:10px"><strong>📅 معلومات الأقساط:</strong> <span id="instMonths">30</span> شهر × <span id="instMonthly">0</span> دج/شهر = <span id="instTotal">0</span> دج<br><small style="color:#92400e">سيتم توليد جدول الأقساط تلقائياً (للأقسام التقني سامي)</small></div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">📄 مستندات الملف</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="doc_photos" value="1" <?= !empty($editStudent['doc_photos'])?'checked':'' ?>> 02 صور</label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="doc_birth_cert" value="1" <?= !empty($editStudent['doc_birth_cert'])?'checked':'' ?>> شهادة ميلاد</label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="doc_id_card" value="1" <?= !empty($editStudent['doc_id_card'])?'checked':'' ?>> بطاقة تعريف</label>
        </div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">📋 مستندات التقني سامي</h3>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
            <label style="font-size:12px"><input type="checkbox" name="doc_ts_photos" value="1" <?= !empty($editStudent['doc_ts_photos'])?'checked':'' ?>> 04 صور</label>
            <label style="font-size:12px"><input type="checkbox" name="doc_ts_birth_certs" value="1" <?= !empty($editStudent['doc_ts_birth_certs'])?'checked':'' ?>> 03 شهادات ميلاد</label>
            <label style="font-size:12px"><input type="checkbox" name="doc_ts_id_cards" value="1" <?= !empty($editStudent['doc_ts_id_cards'])?'checked':'' ?>> 03 بطاقات تعريف</label>
            <label style="font-size:12px"><input type="checkbox" name="doc_school_cert" value="1" <?= !empty($editStudent['doc_school_cert'])?'checked':'' ?>> شهادة مدرسية</label>
            <label style="font-size:12px"><input type="checkbox" name="doc_medical_cert" value="1" <?= !empty($editStudent['doc_medical_cert'])?'checked':'' ?>> شهادة طبية</label>
        </div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">🏥 الدورات الطبية</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="doc_practical_training" value="1" <?= !empty($editStudent['doc_practical_training'])?'checked':'' ?>> التربص التطبيقي</label>
            <div class="form-group"><label>بداية التربص</label><input type="date" name="practical_start_date" class="form-control" value="<?= htmlspecialchars($editStudent['practical_start_date']??'') ?>"></div>
            <div class="form-group"><label>نهاية التربص</label><input type="date" name="practical_end_date" class="form-control" value="<?= htmlspecialchars($editStudent['practical_end_date']??'') ?>"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" name="doc_certificate_received" value="1" <?= !empty($editStudent['doc_certificate_received'])?'checked':'' ?>> استلم الشهادة</label>
            <div class="form-group"><label>تاريخ الاستلام</label><input type="date" name="certificate_received_date" class="form-control" value="<?= htmlspecialchars($editStudent['certificate_received_date']??'') ?>"></div>
        </div>
        
        <h3 style="font-size:14px;color:#7c3aed;margin:15px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:5px">🎒 الدعم المدرسي</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
            <div class="form-group"><label>المؤسسة</label><input type="text" name="school_name" class="form-control" value="<?= htmlspecialchars($editStudent['school_name']??'') ?>"></div>
            <div class="form-group"><label>الطور</label><select name="education_level" class="form-control"><option value="">—</option><option value="ابتدائي" <?= ($editStudent['education_level']??'')==='ابتدائي'?'selected':'' ?>>ابتدائي</option><option value="متوسط" <?= ($editStudent['education_level']??'')==='متوسط'?'selected':'' ?>>متوسط</option><option value="ثانوي" <?= ($editStudent['education_level']??'')==='ثانوي'?'selected':'' ?>>ثانوي</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
            <div class="form-group"><label>الشعبة</label><select name="school_stream" class="form-control"><option value="">—</option><option value="علوم تجريبية" <?= ($editStudent['school_stream']??'')==='علوم تجريبية'?'selected':'' ?>>علوم تجريبية</option><option value="رياضيات" <?= ($editStudent['school_stream']??'')==='رياضيات'?'selected':'' ?>>رياضيات</option><option value="تقني رياضي" <?= ($editStudent['school_stream']??'')==='تقني رياضي'?'selected':'' ?>>تقني رياضي</option><option value="تسيير واقتصاد" <?= ($editStudent['school_stream']??'')==='تسيير واقتصاد'?'selected':'' ?>>تسيير واقتصاد</option><option value="لغات" <?= ($editStudent['school_stream']??'')==='لغات'?'selected':'' ?>>لغات</option><option value="آداب وفلسفة" <?= ($editStudent['school_stream']??'')==='آداب وفلسفة'?'selected':'' ?>>آداب وفلسفة</option></select></div>
            <div class="form-group"><label>السنة</label><select name="school_year" class="form-control"><option value="">—</option><option value="الأولى" <?= ($editStudent['school_year']??'')==='الأولى'?'selected':'' ?>>الأولى</option><option value="الثانية" <?= ($editStudent['school_year']??'')==='الثانية'?'selected':'' ?>>الثانية</option><option value="الثالثة" <?= ($editStudent['school_year']??'')==='الثالثة'?'selected':'' ?>>الثالثة</option><option value="الرابعة" <?= ($editStudent['school_year']??'')==='الرابعة'?'selected':'' ?>>الرابعة</option><option value="الخامسة" <?= ($editStudent['school_year']??'')==='الخامسة'?'selected':'' ?>>الخامسة</option><option value="السادسة" <?= ($editStudent['school_year']??'')==='السادسة'?'selected':'' ?>>السادسة</option></select></div>
        </div>
        
        <div class="form-group" style="margin-top:15px"><label>ملاحظات</label><textarea name="notes" class="form-control" rows="3"><?= htmlspecialchars($editStudent['notes']??'') ?></textarea></div>

        <?php if ($_SESSION['role'] === 'director' && !empty($branches)): ?>
        <!-- 🌳 Branch selector — director only -->
        <div class="form-group">
            <label>🏢 الفرع</label>
            <select name="branch_id" class="form-control">
                <option value="">— المقر الرئيسي —</option>
                <?php foreach ($branches as $b): ?>
                    <option value="<?= htmlspecialchars($b['id']) ?>" <?= ($editStudent['branch_id'] ?? '')===$b['id']?'selected':'' ?>><?= htmlspecialchars($b['name']) ?><?= !empty($b['code']) ? ' ('.htmlspecialchars($b['code']).')' : '' ?></option>
                <?php endforeach; ?>
            </select>
            <small style="color:#6b7280">يحدّد الفرع الذي ينتمي إليه الطالب — الموظفون من فروع أخرى لن يروه</small>
        </div>
        <?php endif; ?>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><a href="students.php" class="btn btn-secondary">إلغاء</a><button type="submit" class="btn">💾 حفظ</button></div>
    </form>
</div></div>

<script>
const specsByDept = <?= json_encode($specsByDept, JSON_UNESCAPED_UNICODE) ?>;
const deptsInfo = <?= json_encode(array_column($departments, null, 'id'), JSON_UNESCAPED_UNICODE) ?>;
function updateFilterSpecs(){const d=document.getElementById('filterDept').value,s=document.getElementById('filterSpec');s.innerHTML='<option value="">كل التخصصات</option>';if(d&&specsByDept[d])specsByDept[d].forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;s.appendChild(o)});const sv='<?= htmlspecialchars($specFilter??'') ?>';if(sv)s.value=sv}
function updateFormSpecs(){const d=document.getElementById('formDept').value,s=document.getElementById('formSpec');s.innerHTML='';if(!d){s.disabled=true;s.innerHTML='<option value="">اختر القسم أولاً</option>';return}s.disabled=false;s.innerHTML='<option value="">— اختر التخصص —</option>';if(specsByDept[d])specsByDept[d].forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;s.appendChild(o)});const sv='<?= htmlspecialchars($editStudent['specialization_id']??'') ?>';if(sv)s.value=sv}
function checkInstallments(){const d=document.getElementById('formDept').value,i=document.getElementById('installmentInfo');if(!d||!deptsInfo[d]||!deptsInfo[d].has_installments){i.style.display='none';return}const m=deptsInfo[d].installment_months||30,t=parseFloat(document.querySelector('[name=total_amount]').value)||0,ip=parseFloat(document.querySelector('[name=initial_payment]').value)||0,mo=m>0?Math.round((t-ip)/m):0;document.getElementById('instMonths').textContent=m;document.getElementById('instMonthly').textContent=mo.toLocaleString();document.getElementById('instTotal').textContent=(t-ip).toLocaleString();i.style.display='block'}
function previewPhoto(i){if(i.files&&i.files[0]){const r=new FileReader();r.onload=e=>{const p=document.getElementById('photoPreview'),ph=document.getElementById('photoPlaceholder');if(p){p.src=e.target.result}else if(ph){ph.outerHTML='<img src="'+e.target.result+'" alt="" style="width:80px;height:80px;border-radius:8px;object-fit:cover;border:2px solid #7c3aed" id="photoPreview">'}};r.readAsDataURL(i.files[0])}}
function removePhoto(){const p=document.getElementById('photoPreview');if(p){p.outerHTML='<div style="width:80px;height:80px;border-radius:8px;background:#e5e7eb;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:32px" id="photoPlaceholder">👤</div>'}document.getElementById('photoInput').value='';document.querySelector('[name=photo_url_existing]').value=''}
updateFilterSpecs();updateFormSpecs();checkInstallments();
document.querySelector('[name=total_amount]').addEventListener('input',checkInstallments);
document.querySelector('[name=initial_payment]').addEventListener('input',checkInstallments);
<?= $editStudent?"document.getElementById('addModal').style.display='flex';":'' ?>
</script>
<?php include 'includes/footer.php'; ?>
