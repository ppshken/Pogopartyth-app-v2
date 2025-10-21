<?php
// api/friend/list.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$me = authGuard();

$q     = trim((string)($_GET['q'] ?? ''));
$page  = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;

$db = pdo();

// รายชื่อเพื่อน = ทุกแถวที่ status='accepted' ที่เกี่ยวกับฉัน
// จากนั้น join users เพื่อดึงข้อมูลโปรไฟล์
$params = [':me' => $me];
$filter = '';

if ($q !== '') {
  // กรองด้วย username หรือ friend_code (ตามที่คุณเก็บ)
  $filter = " AND (u.username LIKE :q OR u.friend_code LIKE :qexact) ";
  $params[':q'] = $q . '%';
  $params[':qexact'] = '%' . preg_replace('/\s+/', '', $q) . '%';
}

$sql = "
  SELECT u.id, u.username, u.avatar, u.team, u.level,
         -- (ออปชัน) rating เฉลี่ยของเจ้าของห้อง
         CAST(ru.avg_rating AS DECIMAL(10,2)) AS rating_owner,
         -- (ออปชัน) ปิดบัง friend code บางส่วน
         CASE WHEN u.friend_code IS NOT NULL AND u.friend_code <> ''
              THEN CONCAT(SUBSTRING(u.friend_code,1,4), '-****-****')
              ELSE NULL END AS friend_code_masked
  FROM friendships f
  JOIN users u
    ON u.id = CASE WHEN f.requester_id = :me THEN f.addressee_id ELSE f.requester_id END
  LEFT JOIN (
    SELECT rr.owner_id, AVG(r.rating) AS avg_rating
    FROM raid_reviews r
    JOIN raid_rooms rr ON rr.id = r.room_id
    WHERE r.rating IS NOT NULL
    GROUP BY rr.owner_id
  ) ru ON ru.owner_id = u.id
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
    {$filter}
  ORDER BY u.username
  LIMIT {$limit} OFFSET {$offset}
";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$list = $stmt->fetchAll();

$countStmt = $db->prepare("
  SELECT COUNT(*)
  FROM friendships f
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
");
$countStmt->execute([':me' => $me]);
$total = (int)$countStmt->fetchColumn();

jsonResponse(true, [
  'list' => $list,
  'pagination' => [
    'page' => $page,
    'has_more' => ($offset + count($list)) < $total,
  ]
], 'โหลดรายการเพื่อนสำเร็จ');
