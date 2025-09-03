<?php
// api/raid/join.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input = getJsonInput();
$roomId = (int)($input['room_id'] ?? 0);
if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // ข้อมูลห้อง
  $stmt = $db->prepare("SELECT id, status, start_time, max_members FROM raid_rooms WHERE id = :id FOR UPDATE");
  $stmt->execute([':id' => $roomId]);
  $room = $stmt->fetch();

  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบบห้อง', 404);
  }

  if ($room['status'] !== 'active') {
    $db->rollBack();
    jsonResponse(false, null, 'หัวห้องทำการยกเลิกห้อง ไม่สามารถเข้าร่วมได้', 409);
  }

  if (strtotime($room['start_time']) <= time()) {
    $db->rollBack();
    jsonResponse(false, null, 'เลยเวลาเริ่มไปแล้ว', 409);
  }

  // เป็นสมาชิกอยู่แล้ว?
  $stmt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r AND user_id = :u");
  $stmt->execute([':r' => $roomId, ':u' => $userId]);
  if ((int)$stmt->fetchColumn() > 0) {
    $db->rollBack();
    jsonResponse(false, null, 'เข้าห้องนี้อยู่แล้ว', 409);
  }

  // นับสมาชิกปัจจุบัน
  $stmt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r");
  $stmt->execute([':r' => $roomId]);
  $current = (int)$stmt->fetchColumn();

  if ($current >= (int)$room['max_members']) {
    $db->rollBack();
    jsonResponse(false, null, 'ห้องเต็มแล้ว', 409);
  }

  // เข้าร่วม
  $stmt = $db->prepare("
    INSERT INTO user_raid_rooms (room_id, user_id, role, joined_at)
    VALUES (:r, :u, 'member', :t)
  ");
  $stmt->execute([':r' => $roomId, ':u' => $userId, ':t' => now()]);

  $db->commit();
  jsonResponse(true, ['room_id' => $roomId], 'เข้าร่วมห้องสำเร็จ', 201);
} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'เข้าร่วมห้องล้มเหลว', 500);
}
