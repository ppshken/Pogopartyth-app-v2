<?php
// api/raid/kick_member.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$currentUserId = authGuard();
$input = getJsonInput();

$roomId = (int)($input['room_id'] ?? 0);
$targetUserId = (int)($input['user_id'] ?? 0);

if ($roomId <= 0 || $targetUserId <= 0) {
  jsonResponse(false, null, 'room_id หรือ user_id ไม่ถูกต้อง', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // 1) ตรวจว่าห้องมีอยู่ และผู้เรียกคือเจ้าของห้อง
  $q = $db->prepare("SELECT id, owner_id FROM raid_rooms WHERE id = :id FOR UPDATE");
  $q->execute([':id' => $roomId]);
  $room = $q->fetch();

  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
  }

  if ((int)$room['owner_id'] !== $currentUserId) {
    $db->rollBack();
    jsonResponse(false, null, 'Forbidden: ต้องเป็นเจ้าของห้องเท่านั้น', 403);
  }

  // กันไม่ให้เตะเจ้าของห้องเอง
  if ($targetUserId === (int)$room['owner_id']) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่สามารถเตะเจ้าของห้องได้', 422);
  }

  // 2) ตรวจว่าสมาชิกคนนั้นอยู่ในห้องจริงไหม
  $m = $db->prepare("
    SELECT 1 
    FROM user_raid_rooms 
    WHERE room_id = :room_id AND user_id = :user_id
    FOR UPDATE
  ");
  $m->execute([':room_id' => $roomId, ':user_id' => $targetUserId]);
  if (!$m->fetch()) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบสมาชิกในห้องนี้', 404);
  }

  // 3) ลบความเป็นสมาชิกออก
  $del = $db->prepare("
    DELETE FROM user_raid_rooms
    WHERE room_id = :room_id AND user_id = :user_id
    LIMIT 1
  ");
  $ok = $del->execute([':room_id' => $roomId, ':user_id' => $targetUserId]);

  if (!$ok || $del->rowCount() === 0) {
    $db->rollBack();
    jsonResponse(false, null, 'ลบสมาชิกไม่สำเร็จ', 500);
  }

  // (ถ้าต้องการ: ลบ/soft-delete ข้อความแชทของ user นี้ในห้อง หรือบันทึก log การเตะ)
  // $db->prepare("INSERT INTO raid_logs (...) VALUES (...)")->execute([...]);

  $db->commit();
  jsonResponse(true, ['room_id' => $roomId, 'user_id' => $targetUserId], 'เตะสมาชิกออกจากห้องเรียบร้อยแล้ว');
} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  // ส่งรายละเอียดไว้ใน log ฝั่งเซิร์ฟเวอร์
  error_log('[kick_member] ' . $e->getMessage());
  jsonResponse(false, null, 'เกิดข้อผิดพลาดภายในระบบ', 500);
}
