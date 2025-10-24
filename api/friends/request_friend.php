<?php
// api/friends/request_friend.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard(); // id ของเราที่ล็อกอินอยู่

$db = pdo();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// optional pagination
$page  = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;

// optional search (เช่นค้นชื่อ)
$q = trim((string)($_GET['q'] ?? ''));
$params = [':me' => $userId];
$filter = '';

if ($q !== '') {
  $filter = " AND (u.username LIKE :q OR u.email LIKE :q)";
  $params[':q'] = "%{$q}%";
}

// ✅ ดึง “คำขอเป็นเพื่อน” ที่ส่งมาหาเรา
$sql = "
  SELECT
    f.id AS request_id,
    f.requester_id,
    u.username,
    u.avatar,
    u.team,
    u.level,
    u.friend_code,
    f.status,
    f.created_at
  FROM friendships f
  JOIN users u ON u.id = f.requester_id
  WHERE f.addressee_id = :me
    AND f.status = 'pending'
    {$filter}
  ORDER BY f.created_at DESC
  LIMIT {$limit} OFFSET {$offset}
";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$list = $stmt->fetchAll(PDO::FETCH_ASSOC);

// นับจำนวนทั้งหมด (ไว้ทำ pagination)
$countStmt = $db->prepare("
  SELECT COUNT(*)
  FROM friendships f
  WHERE f.addressee_id = :me
    AND f.status = 'pending'
");
$countStmt->execute([':me' => $userId]);
$total = (int)$countStmt->fetchColumn();

jsonResponse(true, [
  'list' => $list,
  'pagination' => [
    'page' => $page,
    'has_more' => ($offset + count($list)) < $total,
    'total' => $total
  ]
], 'โหลดคำขอเป็นเพื่อนสำเร็จ');
