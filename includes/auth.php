<?php
// ============================================
// Authentication System
// ============================================

require_once __DIR__ . '/../config/database.php';

if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_start();
}

function is_logged_in() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

function current_user() {
    if (!is_logged_in()) return null;
    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'name' => $_SESSION['name'],
        'role' => $_SESSION['role'],
        'branch_id' => $_SESSION['branch_id'] ?? null,
    ];
}

/**
 * يُرجع معرّف الفرع للمستخدم الحالي.
 * - المدير: يُرجع null (يرى كل الفروع)
 * - الموظف: يُرجع branch_id المخزّن في الجلسة (قد يكون null = المقر الرئيسي)
 *
 * @return string|null
 */
function current_user_branch_id() {
    if (!is_logged_in()) return null;
    if (($_SESSION['role'] ?? '') === 'director') return null;
    return $_SESSION['branch_id'] ?? null;
}

/**
 * يبني شرط WHERE لتصفية الاستعلامات حسب فرع المستخدم الحالي.
 *
 * الاستخدام:
 *   [$whereClause, $params] = branch_filter();
 *   $sql = "SELECT * FROM students WHERE 1=1";
 *   if ($whereClause) {
 *       $sql .= " AND $whereClause";
 *       // $params يحوي branch_id أو فارغ
 *   }
 *   $rows = db()->fetchAll($sql, array_merge($existingParams, $params));
 *
 * أو أبطأ: استخدم '?' في النهاية:
 *   $sql = "SELECT * FROM students WHERE 1=1";
 *   $bindParams = [];
 *   [$w, $wp] = branch_filter();
 *   if ($w) { $sql .= " AND $w"; $bindParams = array_merge($bindParams, $wp); }
 *   $sql .= " ORDER BY created_at DESC";
 *   $rows = db()->fetchAll($sql, $bindParams);
 *
 * @param string $column اسم عمود branch_id في الاستعلام (يمكن أن يكون مع alias مثل 's.branch_id')
 * @return array [string|null whereClause, array params]
 *   - إذا كان المستخدم مدير: [null, []]
 *   - إذا كان موظف بدور فرع: ["branch_id = ?", [branchId]]
 *   - إذا كان موظف بدون فرع (مقر رئيسي): ["(branch_id IS NULL OR branch_id = '')", []]
 */
function branch_filter($column = 'branch_id') {
    if (!is_logged_in()) return [null, []];
    if (($_SESSION['role'] ?? '') === 'director') return [null, []];

    $branchId = $_SESSION['branch_id'] ?? null;
    if (!$branchId) {
        // موظف المقر الرئيسي: يرى السجلات بدون branch_id
        return ["($column IS NULL OR $column = '')", []];
    }
    return ["$column = ?", [$branchId]];
}

/**
 * يُرجع معرّف الفرع الذي يجب أن يُسجَّل على سجل جديد ينشئه المستخدم الحالي.
 * - المدير: null (ما لم يحدد فرعاً في الفورم)
 * - الموظف: فرعه المسجّل في الجلسة
 *
 * @return string|null
 */
function branch_for_new_record() {
    if (!is_logged_in()) return null;
    if (($_SESSION['role'] ?? '') === 'director') return null;
    return $_SESSION['branch_id'] ?? null;
}

function require_auth() {
    if (!is_logged_in()) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['error' => 'غير مصرح', 'code' => 'UNAUTHORIZED']);
        exit;
    }
}

function require_director() {
    require_auth();
    if ($_SESSION['role'] !== 'director') {
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['error' => 'هذه العملية متاحة للمدير فقط', 'code' => 'FORBIDDEN']);
        exit;
    }
}

function attempt_login($username, $password) {
    $user = db()->fetchOne("SELECT * FROM users WHERE username = ? LIMIT 1", [$username]);
    if (!$user) return ['success' => false, 'error' => 'اسم المستخدم غير موجود'];
    if (!password_verify($password, $user['password'])) {
        return ['success' => false, 'error' => 'كلمة المرور غير صحيحة'];
    }
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['name'] = $user['name'];
    $_SESSION['role'] = $user['role'];
    // 🌳 branch_id — حتى لو كان للموظف فرع مسجّل، المدير يرى كل الفروع (null)
    $_SESSION['branch_id'] = ($user['role'] === 'director') ? null : ($user['branch_id'] ?? null);
    log_activity($user['id'], $user['name'], 'login', 'auth', 'تسجيل الدخول');
    return ['success' => true, 'user' => $user];
}

function logout() {
    if (is_logged_in()) {
        log_activity($_SESSION['user_id'], $_SESSION['name'], 'logout', 'auth', 'تسجيل الخروج');
    }
    session_unset();
    session_destroy();
}

function log_activity($userId, $userName, $action, $module, $description, $targetType = null, $targetId = null) {
    try {
        db()->execute(
            "INSERT INTO activity_log (id, user_id, user_name, action, module, description, target_type, target_id, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
            [generate_id(), $userId, $userName, $action, $module, $description, $targetType, $targetId, $_SERVER['REMOTE_ADDR'] ?? 'unknown']
        );
    } catch (Exception $e) {}
}
