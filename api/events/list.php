<?php
// api/user/noti_status.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

// ต้องล็อกอินเท่านั้น
$userId = authGuard();
if (!$userId) {
  jsonResponse(false, null, 'Unauthorized', 401);
}

$db = pdo(); // ฟังก์ชันเชื่อมต่อฐานข้อมูล

// ----- พารามิเตอร์ -----
$search   = trim($_GET['search'] ?? ''); // ค้นหาหัวข้อ หรือ รายละเอียด
$sort     = trim($_GET['sort'] ?? 'desc'); // desc | asc
$isAll    = (int)($_GET['all'] ?? 0) === 1; // ดึงทั้งหมด (ไม่ paginate)
$HARD_CAP = 1000;

// paginate ปกติ (ถ้ามีฟังก์ชัน paginateParams ให้ใช้)
$page   = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
if ($page < 1) $page = 1;
if ($limit < 1) $limit = 10;
$offset = ($page - 1) * $limit;

// ----- เงื่อนไขค้นหา -----
$cond   = [];
$params = [];

// ค้นหาจาก Title หรือ Description
if ($search !== '') {
    $cond[] = '(e.title LIKE :search OR e.description LIKE :search)';
    $params[':search'] = '%' . $search . '%';
}

$where = $cond ? ('WHERE ' . implode(' AND ', $cond)) : '';

// Sort order
$orderBy = ($sort === 'asc') ? 'e.created_at ASC' : 'e.created_at DESC';

// ----- นับทั้งหมด -----
$countSql = "SELECT COUNT(*) AS cnt FROM events e $where";
$stmt = $db->prepare($countSql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->execute();
$total = (int)$stmt->fetchColumn();

// ----- ดึงรายการ -----
$sql = "
SELECT 
    e.id,
    e.title,
    e.description,
    e.image,
    e.created_at,
    e.created_by,
    u.username AS creator_name,
    u.avatar AS creator_avatar
FROM events e
LEFT JOIN users u ON u.id = e.created_by
$where
ORDER BY $orderBy, e.id DESC
";

// โหมด all=1
if ($isAll) {
    $fetchLimit = min($total, $HARD_CAP);
    $sql .= " LIMIT :limit_all";
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':limit_all', $fetchLimit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'message' => 'ดึงรายการกิจกรรม (all=1) สำเร็จ',
        'data' => [
            'items'       => $rows,
            'page'        => 1,
            'limit'       => count($rows),
            'total'       => $total,
            'total_pages' => 1,
        ]
    ]);
    exit;
}

// โหมดปกติ: LIMIT/OFFSET
$sql .= " LIMIT :limit OFFSET :offset";
$stmt = $db->prepare($sql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'message' => 'ดึงรายการกิจกรรมสำเร็จ',
    'data' => $rows, // Format ให้ตรงกับ Frontend ที่เขียนไว้ก่อนหน้า
    'pagination' => [
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => ceil($total / $limit),
    ]
]);
?>