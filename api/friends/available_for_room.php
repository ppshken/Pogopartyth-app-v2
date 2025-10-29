<?php
// api/friends/available_for_room.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$me = authGuard();

$db = pdo();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// ===== รับพารามิเตอร์ =====
$roomId = (int)($_GET['room_id'] ?? 0);
if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}

$q      = trim((string)($_GET['q'] ?? ''));
$page   = max(1, (int)($_GET['page'] ?? 1));
$limit  = max(1, min(50, (int)($_GET['limit'] ?? 100)));
$offset = ($page - 1) * $limit;

// ===== เตรียม param พื้นฐาน =====
$params = [
  ':me'      => $me,
  ':room_id' => $roomId,
];

// ===== filter สำหรับค้นหาเพื่อนตามชื่อ / friend_code =====
$filter = '';
if ($q !== '') {
  // ตรงนี้เราจะค้น username และ friend_code (ตัดเว้นวรรค)
  $filter = " AND (
      u.username LIKE :q
    )";
  $params[':q'] = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
}

/**
 * logic:
 * 1) หาเพื่อนที่เป็น accepted กับเรา
 *    - ถ้าเราเป็น requester_id -> เพื่อนคือ addressee_id
 *    - ถ้าเราเป็น addressee_id -> เพื่อนคือ requester_id
 *
 * 2) join users u = ข้อมูลเพื่อน
 *
 * 3) u.setup_status = 'yes'
 *
 * 4) exclude คนที่อยู่ในห้องนี้แล้ว:
 *    u.id NOT IN (
 *      SELECT ur.user_id
 *      FROM user_raid_rooms ur
 *      WHERE ur.room_id = :room_id
 *    )
 */
$sql = "
  SELECT
    u.id,
    u.username,
    u.avatar,
    u.team,
    u.level,
    u.friend_code,
    u.device_token,
    CAST(ru.avg_rating AS DECIMAL(10,2)) AS rating_owner
  FROM friendships f
  JOIN users u
    ON u.id = CASE
      WHEN f.requester_id = :me THEN f.addressee_id
      ELSE f.requester_id
    END
  LEFT JOIN (
    SELECT rr.owner_id, AVG(r.rating) AS avg_rating
    FROM raid_reviews r
    JOIN raid_rooms rr ON rr.id = r.room_id
    WHERE r.rating IS NOT NULL
    GROUP BY rr.owner_id
  ) ru ON ru.owner_id = u.id
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
    AND COALESCE(u.setup_status,'no') = 'yes'
    AND u.id NOT IN (
      SELECT ur.user_id
      FROM user_raid_rooms ur
      WHERE ur.room_id = :room_id
    )
    {$filter}
  ORDER BY u.username
  LIMIT {$limit} OFFSET {$offset}
";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$list = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ====== total สำหรับ pagination ======
$countSql = "
  SELECT COUNT(*)
  FROM friendships f
  JOIN users u
    ON u.id = CASE
      WHEN f.requester_id = :me THEN f.addressee_id
      ELSE f.requester_id
    END
  WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
    AND COALESCE(u.setup_status,'no') = 'yes'
    AND u.id NOT IN (
      SELECT ur.user_id
      FROM user_raid_rooms ur
      WHERE ur.room_id = :room_id
    )
    {$filter}
";
$countStmt = $db->prepare($countSql);
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();

// ====== response ======
jsonResponse(true, [
  'list' => $list,
  'pagination' => [
    'page' => $page,
    'has_more' => ($offset + count($list)) < $total,
    'total' => $total,
  ],
], 'โหลดเพื่อนที่ยังไม่อยู่ในห้องสำเร็จ');
