<?php
// api/raid/list.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$db = pdo();

// ----- พารามิเตอร์ -----
$boss            = trim($_GET['boss'] ?? '');
$status          = trim($_GET['status'] ?? 'active'); // active|closed|canceled (default active)
$timeFrom        = trim($_GET['time_from'] ?? '');    // "YYYY-MM-DD HH:MM:SS"
$timeTo          = trim($_GET['time_to'] ?? '');
$excludeExpired  = (int)($_GET['exclude_expired'] ?? 1) === 1; // ✅ ซ่อนห้องหมดเวลา (default)
$excludeMine     = (int)($_GET['exclude_mine'] ?? 0) === 1;    // ✅ ไม่เอาห้องที่ฉันสร้าง
$isAll           = (int)($_GET['all'] ?? 0) === 1;             // ดึงทั้งหมด (ภายใต้ filter)
$HARD_CAP        = 5000;

// paginate ปกติ
[$page, $limit, $offset] = paginateParams();

// ----- auth: เอา meId ถ้ามี token (เพื่อคำนวณ is_joined) -----
$meId   = null;
$hdr    = readAuthHeader();
$token  = null;
if ($hdr && stripos($hdr, 'Bearer ') === 0) {
  $token = trim(substr($hdr, 7));
} elseif (!empty($_GET['token'])) { // fallback debug เท่านั้น
  $token = trim($_GET['token']);
}
$payload = $token ? verifyToken($token) : null;
if ($payload && !empty($payload['user_id'])) {
  $meId = (int)$payload['user_id'];
}

// ----- ถ้า exclude_mine=1 ต้องมี token -----
if ($excludeMine && $meId === null) {
  jsonResponse(false, null, 'Unauthorized (exclude_mine ต้องส่ง token)', 401);
}

// ----- เงื่อนไขค้นหา -----
$cond   = [];
$params = [];

if ($boss !== '') {
  $cond[] = 'r.boss LIKE :boss';
  $params[':boss'] = '%' . $boss . '%';
}
if ($status !== '') {
  $cond[] = 'r.status = :status';
  $params[':status'] = $status;
}
if ($timeFrom !== '' && strtotime($timeFrom) !== false) {
  $cond[] = 'r.start_time >= :from';
  $params[':from'] = $timeFrom;
}
if ($timeTo !== '' && strtotime($timeTo) !== false) {
  $cond[] = 'r.start_time <= :to';
  $params[':to'] = $timeTo;
}

// ✅ กรองเฉพาะห้องที่ "ยังไม่หมดเวลา"
if ($excludeExpired) {
  $cond[] = 'r.start_time > :now';
  $params[':now'] = now();
}

// ✅ ตัดห้องที่ฉันเป็นเจ้าของออก
if ($excludeMine && $meId !== null) {
  $cond[] = 'r.owner_id <> :me';
  $params[':me'] = $meId;
}

$where = $cond ? ('WHERE ' . implode(' AND ', $cond)) : '';

// ----- ส่วน JOIN/SELECT สำหรับ is_joined -----
$joinJoined     = '';
$selectIsJoined = '0 AS is_joined';
if ($meId !== null) {
  $joinJoined     = 'LEFT JOIN user_raid_rooms j ON j.room_id = r.id AND j.user_id = :me_id';
  $selectIsJoined = 'CASE WHEN j.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_joined';
}

// ----- นับทั้งหมด -----
$countSql = "SELECT COUNT(*) AS cnt FROM raid_rooms r $where";
$stmt = $db->prepare($countSql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->execute();
$total = (int)$stmt->fetchColumn();

// ----- ดึงรายการ -----
$sql = "
SELECT
  r.id,
  r.boss,
  r.raid_boss_id,
  r.pokemon_image,
  r.start_time,
  r.max_members,
  r.status,
  r.owner_id,
  r.note,
  r.min_level,
  r.vip_only,
  r.lock_room,
  r.password_room,
  r.created_at,
  u.username    AS owner_username,
  u.avatar      AS owner_avatar,
  u.friend_code AS owner_friend_code,
  rb.pokemon_tier AS pokemon_tier,
  (SELECT COUNT(*) FROM user_raid_rooms ur WHERE ur.room_id = r.id) AS current_members,
  $selectIsJoined
FROM raid_rooms r
LEFT JOIN users u ON u.id = r.owner_id
LEFT JOIN raid_boss rb ON rb.id = r.raid_boss_id
$joinJoined
$where
ORDER BY r.vip_only DESC, r.id ASC
";

// โหมด all=1
if ($isAll) {
  $fetchLimit = min($total, $HARD_CAP);
  $sql .= " LIMIT :limit_all";
  $stmt = $db->prepare($sql);
  foreach ($params as $k => $v) $stmt->bindValue($k, $v);
  if ($meId !== null) {
    $stmt->bindValue(':me_id', $meId, PDO::PARAM_INT);
  }
  $stmt->bindValue(':limit_all', $fetchLimit, PDO::PARAM_INT);
  $stmt->execute();
  $rows = $stmt->fetchAll();

  jsonResponse(true, [
    'items'        => $rows,
    'page'         => 1,
    'limit'        => count($rows),
    'total'        => $total,
    'total_pages'  => 1,
    'returned'     => count($rows),
    'truncated'    => $total > $HARD_CAP,
  ], 'ดึงรายการห้อง (all=1) สำเร็จ');
  exit;
}

// โหมดปกติ: LIMIT/OFFSET
$sql .= " LIMIT :limit OFFSET :offset";
$stmt = $db->prepare($sql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
if ($meId !== null) {
  $stmt->bindValue(':me_id', $meId, PDO::PARAM_INT);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$rows = $stmt->fetchAll();

jsonResponse(true, [
  'items'       => $rows,
  'page'        => $page,
  'limit'       => $limit,
  'total'       => $total,
  'total_pages' => (int)ceil($total / $limit),
], 'ดึงรายการห้องสำเร็จ');
