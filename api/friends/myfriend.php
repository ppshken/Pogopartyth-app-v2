<?php
// api/friend/list.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$me = authGuard();

$q      = trim((string)($_GET['q'] ?? ''));
$page   = max(1, (int)($_GET['page'] ?? 1));
$limit  = max(1, min(50, (int)($_GET['limit'] ?? 10)));
$offset = ($page - 1) * $limit;

$db = pdo();

$params = [':me' => $me];
$filter = '';

if ($q !== '') {
  // กรอง username เริ่มด้วย q และ friend_code ตรงบางส่วน (ตัดเว้นวรรค)
  $filter = " AND (u.username LIKE :q OR REPLACE(u.friend_code, ' ', '') LIKE :qexact) ";
  $params[':q']      = $q . '%';
  $params[':qexact'] = '%' . preg_replace('/\s+/', '', $q) . '%';
}

/**
 * รายชื่อเพื่อน:
 * - ต้องเป็นความสัมพันธ์ที่เกี่ยวกับฉัน (requester|addressee มี :me)
 * - สถานะ 'accepted'
 * - ฝั่ง "อีกคน" (ไม่ใช่ฉัน) ต้อง setup_status = 'yes'
 */
$sql = "
  SELECT
    u.id, u.username, u.avatar, u.team, u.level, u.plan,
    CAST(ru.avg_rating AS DECIMAL(10,2)) AS rating_owner,
    CASE
      WHEN u.friend_code IS NOT NULL AND u.friend_code <> ''
      THEN CONCAT(
          SUBSTRING(REPLACE(u.friend_code, ' ', ''), 1, 4), 
          '-', 
          SUBSTRING(REPLACE(u.friend_code, ' ', ''), 5, 4), 
          '-', 
          SUBSTRING(REPLACE(u.friend_code, ' ', ''), 9, 4)
      )
      ELSE NULL
    END AS friend_code_masked
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
    AND u.setup_status = 'yes'
    {$filter}
  ORDER BY rating_owner DESC, u.username ASC
  LIMIT {$limit} OFFSET {$offset}
";
$stmt = $db->prepare($sql);
$stmt->execute($params);
$list = $stmt->fetchAll(PDO::FETCH_ASSOC);

/**
 * นับรวมทั้งหมดสำหรับ pagination:
 * - ใช้เงื่อนไขเดียวกับหน้ารายการ (รวม filter และ setup_status = 'yes')
 */
$countSql = "
  SELECT COUNT(*)
  FROM friendships f
  JOIN users u
    ON u.id = CASE WHEN f.requester_id = :me THEN f.addressee_id ELSE f.requester_id END
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
    AND u.setup_status = 'yes'
    {$filter}
";
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

$countAll = "
  SELECT COUNT(*)
  FROM friendships f
  JOIN users u
    ON u.id = CASE WHEN f.requester_id = :me THEN f.addressee_id ELSE f.requester_id END
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
    AND u.setup_status = 'yes'
";
$countAllStmt = $db->prepare($countAll);
$countAllStmt->execute($params);
$user_all = (int)$countAllStmt->fetchColumn();

jsonResponse(true, [
  'list' => $list,
  'pagination' => [
    'page' => $page,
    'has_more' => ($offset + count($list)) < $total,
    'total' => $total,
    'user_all' => $user_all,
  ]
], 'โหลดรายการเพื่อนสำเร็จ');
