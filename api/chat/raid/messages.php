<?php
// api/chat/messages.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();

$roomId   = (int)($_GET['room_id'] ?? 0);
$sinceId  = (int)($_GET['since_id'] ?? 0);
$limit    = (int)($_GET['limit'] ?? 50);
$limit    = max(1, min(200, $limit)); // 1..200

if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}

$db = pdo();

// ตรวจห้อง + สิทธิ์สมาชิก
$qRoom = $db->prepare("SELECT id FROM raid_rooms WHERE id = :id");
$qRoom->execute([':id' => $roomId]);
if (!$qRoom->fetch()) {
  jsonResponse(false, null, 'ไม่พบห้อง', 404);
}

$qMem = $db->prepare("SELECT 1 FROM user_raid_rooms WHERE room_id = :r AND user_id = :u LIMIT 1");
$qMem->execute([':r' => $roomId, ':u' => $userId]);
if (!$qMem->fetchColumn()) {
  jsonResponse(false, null, 'จำเป็นต้องเป็นสมาชิกห้อง', 403);
}

// ดึงข้อความ
if ($sinceId > 0) {
  // ดึงต่อจาก since_id (id > since_id), เรียง ASC
  $stmt = $db->prepare("
    SELECT c.id, c.raid_rooms_id AS room_id, c.sender AS user_id, c.message, c.created_at,
           u.username, u.avatar
    FROM chat c
    JOIN users u ON u.id = c.sender
    WHERE c.raid_rooms_id = :r AND c.id > :sid
    ORDER BY c.id ASC
    LIMIT :limit
  ");
  $stmt->bindValue(':r', $roomId, PDO::PARAM_INT);
  $stmt->bindValue(':sid', $sinceId, PDO::PARAM_INT);
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->execute();
  $rows = $stmt->fetchAll();

} else {
  // ดึงล่าสุดตาม limit (เอา DESC มาก่อนแล้วค่อยกลับเป็น ASC เพื่อโชว์)
  $stmt = $db->prepare("
    SELECT c.id, c.raid_rooms_id AS room_id, c.sender AS user_id, c.message, c.created_at,
           u.username, u.avatar
    FROM chat c
    JOIN users u ON u.id = c.sender
    WHERE c.raid_rooms_id = :r
    ORDER BY c.id DESC
    LIMIT :limit
  ");
  $stmt->bindValue(':r', $roomId, PDO::PARAM_INT);
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->execute();
  $rows = array_reverse($stmt->fetchAll());
}

// คำนวณ next_since_id
$nextSinceId = $sinceId;
foreach ($rows as $row) {
  if ((int)$row['id'] > $nextSinceId) $nextSinceId = (int)$row['id'];
}

jsonResponse(true, [
  'items'         => $rows,
  'count'         => count($rows),
  'next_since_id' => $nextSinceId,
  'server_time'   => now(),
], 'ดึงข้อความสำเร็จ');
