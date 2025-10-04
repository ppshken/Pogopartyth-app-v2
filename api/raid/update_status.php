<?php
// api/raid/update_status.php
declare(strict_types=1);

// แก้บรรทัดนี้ให้เหลือแค่นี้ (ขึ้นจาก /raid ไป /api)
require_once dirname(__DIR__) . '/helpers.php';  // ✅ ถูกต้องทั้ง Windows/Unix
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

$roomId    = (int)($input['room_id'] ?? 0);
$newStatus = strtolower(trim($input['status'] ?? ''));   // active|closed|canceled

$allowed = ['invited','active','closed','canceled'];
if ($roomId <= 0 || !in_array($newStatus, $allowed, true)) {
  jsonResponse(false, null, 'room_id หรือ status ไม่ถูกต้อง (active|closed|canceled)', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  $q = $db->prepare("
    SELECT id, owner_id, status, start_time, max_members
    FROM raid_rooms
    WHERE id = :id
    FOR UPDATE
  ");
  $q->execute([':id' => $roomId]);
  $room = $q->fetch();
  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
  }

  if ($room['status'] === $newStatus) {
    $cnt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r");
    $cnt->execute([':r' => $roomId]);
    $current = (int)$cnt->fetchColumn();

    jsonResponse(true, [
      'room_id'         => (int)$room['id'],
      'old_status'      => $room['status'],
      'new_status'      => $newStatus,
      'current_members' => $current,
      'note'            => 'status ไม่ได้เปลี่ยน',
    ], 'อัปเดตสถานะสำเร็จ');
  }

  $u = $db->prepare("UPDATE raid_rooms SET status = :s WHERE id = :id");
  $u->execute([':s' => $newStatus, ':id' => $roomId]);

  $cnt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r");
  $cnt->execute([':r' => $roomId]);
  $current = (int)$cnt->fetchColumn();

  $db->commit();

  jsonResponse(true, [
    'room_id'         => (int)$room['id'],
    'old_status'      => $room['status'],
    'new_status'      => $newStatus,
    'current_members' => $current,
  ], 'อัปเดตสถานะสำเร็จ');
} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'อัปเดตสถานะล้มเหลว', 500);
}
