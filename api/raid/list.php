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
$excludeMine     = (int)($_GET['exclude_mine'] ?? 0) === 1;    // ✅ ใหม่: ไม่เอาห้องที่ฉันสร้าง
$isAll           = (int)($_GET['all'] ?? 0) === 1;             // ดึงทั้งหมด (ภายใต้ filter)
$HARD_CAP        = 5000;

// paginate ปกติ
[$page, $limit, $offset] = paginateParams();

// ----- ถ้าขอ exclude_mine ต้องรู้ว่า "ฉัน" คือใคร (ต้องมี token) -----
$meId = null;
if ($excludeMine) {
  $hdr = readAuthHeader();
  $token = null;
  if ($hdr && stripos($hdr, 'Bearer ') === 0) {
    $token = trim(substr($hdr, 7));
  } elseif (!empty($_GET['token'])) { // fallback debug เท่านั้น
    $token = trim($_GET['token']);
  }
  $payload = $token ? verifyToken($token) : null;
  if (!$payload || empty($payload['user_id'])) {
    jsonResponse(false, null, 'Unauthorized (exclude_mine ต้องส่ง token)', 401);
  }
  $meId = (int)$payload['user_id'];
}

// ----- เงื่อนไขค้นหา -----
$cond = [];
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

// ✅ ใหม่: ตัดห้องที่ฉันเป็นเจ้าของออก
if ($excludeMine && $meId !== null) {
  $cond[] = 'r.owner_id <> :me';
  $params[':me'] = $meId;
}

$where = $cond ? ('WHERE ' . implode(' AND ', $cond)) : '';

// ----- นับทั้งหมด -----
$countSql = "SELECT COUNT(*) AS cnt FROM raid_rooms r $where";
$stmt = $db->prepare($countSql);
$stmt->execute($params);
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
  r.created_at,
  u.username   AS owner_username,
  u.avatar     AS owner_avatar,
  u.friend_code AS owner_friend_code,
  rb.pokemon_tier AS pokemon_tier,
  (SELECT COUNT(*) FROM user_raid_rooms ur WHERE ur.room_id = r.id) AS current_members
FROM raid_rooms r
LEFT JOIN users u ON u.id = r.owner_id
LEFT JOIN raid_boss rb ON rb.id = r.raid_boss_id
$where
ORDER BY current_members DESC, r.id ASC
";

// โหมด all=1
if ($isAll) {
  $fetchLimit = min($total, $HARD_CAP);
  $sql .= " LIMIT :limit_all";
  $stmt = $db->prepare($sql);
  foreach ($params as $k => $v) $stmt->bindValue($k, $v);
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
