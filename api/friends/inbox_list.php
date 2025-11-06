<?php
// api/chat/friend/inbox_list.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { jsonResponse(false, null, 'Method not allowed', 405); }

try {
  $meId = authGuard();
  if (!$meId) jsonResponse(false, null, 'Unauthorized', 401);

  $page       = (int)($_GET['page'] ?? 1);
  $limit      = (int)($_GET['limit'] ?? 50);
  $sinceId    = isset($_GET['since_id']) ? (int)$_GET['since_id'] : null;
  $friendship = isset($_GET['friendship_id']) ? (int)$_GET['friendship_id'] : null;

  if ($page < 1) $page = 1;
  if ($limit < 1) $limit = 1;
  if ($limit > 200) $limit = 200;
  $offset = ($page - 1) * $limit;

  $db = pdo();
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // -------- WHERE base --------
  $where = [
    "cf.status = 'send'",
    "cf.sender <> :me",                              // ต้องไม่ใช่เราส่งเอง
    "(f.requester_id = :me OR f.addressee_id = :me)" // ต้องเป็นเพื่อนกับเรา
  ];
  $params = [':me' => $meId];

  if ($sinceId !== null && $sinceId > 0) {
    // ดึงเฉพาะที่ใหม่กว่า id นี้ (มีผลต่อการเลือก "ล่าสุดต่อ sender" ด้วย)
    $where[] = "cf.id > :since_id";
    $params[':since_id'] = $sinceId;
  }
  if ($friendship !== null && $friendship > 0) {
    $where[] = "cf.friendship_id = :fid";
    $params[':fid'] = $friendship;
  }
  $whereSql = implode(' AND ', $where);

  // -------- Query หลัก: เลือก "แถวล่าสุดต่อ sender" --------
  // ใช้ window function เพื่อจัดอันดับภายในแต่ละ sender ตาม cf.id DESC แล้วเอา rn = 1
  $sql = "
    WITH latest_per_sender AS (
      SELECT
        cf.id,
        cf.friendship_id,
        cf.sender,
        cf.message,
        cf.status,
        cf.created_at,
        ROW_NUMBER() OVER (PARTITION BY cf.sender ORDER BY cf.id DESC) AS rn
      FROM chat_friends AS cf
      JOIN friendships AS f ON f.id = cf.friendship_id
      WHERE {$whereSql}
    )
    SELECT
      lps.id,
      lps.friendship_id,
      lps.sender,
      u.username,
      u.avatar,
      lps.message,
      lps.status,
      lps.created_at
    FROM latest_per_sender AS lps
    JOIN users AS u ON u.id = lps.sender
    WHERE lps.rn = 1
    ORDER BY lps.id DESC
    LIMIT :limit OFFSET :offset
  ";

  $stmt = $db->prepare($sql);
  foreach ($params as $k => $v) {
    $stmt->bindValue($k, $v, PDO::PARAM_INT);
  }
  $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();
  $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // -------- นับจำนวน sender ทั้งหมด (เพื่อ pagination แบบราย sender) --------
  // นับ distinct sender ภายใต้เงื่อนไขเดียวกัน
  $countSql = "
    SELECT COUNT(DISTINCT cf.sender) AS total_senders
    FROM chat_friends AS cf
    JOIN friendships AS f ON f.id = cf.friendship_id
    WHERE {$whereSql}
  ";
  $cStmt = $db->prepare($countSql);
  foreach ($params as $k => $v) {
    $cStmt->bindValue($k, $v, PDO::PARAM_INT);
  }
  $cStmt->execute();
  $total = (int)$cStmt->fetchColumn();

  $hasMore = ($offset + count($list)) < $total;

  jsonResponse(true, [
    'list' => $list, // ✅ 1 แถวต่อ sender (เป็นข้อความล่าสุดของ sender นั้น)
    'pagination' => [
      'page'     => $page,
      'limit'    => $limit,
      'total'    => $total,   // จำนวน sender ทั้งหมดที่เข้าเงื่อนไข
      'has_more' => $hasMore,
    ],
  ], 'โหลดกล่องขาเข้า (ล่าสุดต่อ sender) สำเร็จ', 200);

} catch (Throwable $e) {
  jsonResponse(false, null, 'server error: ' . $e->getMessage(), 500);
}
