<?php
// api/chat/send.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

$roomId  = (int)($input['room_id'] ?? 0);
$message = trim((string)($input['message'] ?? ''));

if ($roomId <= 0 || $message === '') {
  jsonResponse(false, null, 'room_id หรือ message ไม่ถูกต้อง', 422);
}
if (mb_strlen($message) > 1000) {
  jsonResponse(false, null, 'message ยาวเกิน 1000 ตัวอักษร', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // ห้องต้องมีและ active
  $qRoom = $db->prepare("SELECT id, status FROM raid_rooms WHERE id = :id FOR UPDATE");
  $qRoom->execute([':id' => $roomId]);
  $room = $qRoom->fetch();
  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
  }
  if ($room['status'] !== 'active' && $room['status'] !== 'invited') {
    $db->rollBack();
    jsonResponse(false, null, 'ห้องไม่อยู่ในสถานะ active', 409);
  }

  // ต้องเป็นสมาชิกห้อง
  $qMem = $db->prepare("SELECT 1 FROM user_raid_rooms WHERE room_id = :r AND user_id = :u LIMIT 1");
  $qMem->execute([':r' => $roomId, ':u' => $userId]);
  if (!$qMem->fetchColumn()) {
    $db->rollBack();
    jsonResponse(false, null, 'จำเป็นต้องเป็นสมาชิกห้อง', 403);
  }

  // กันสแปม: 2 วินาที/ห้อง
  $qLast = $db->prepare("
    SELECT created_at FROM chat 
    WHERE raid_rooms_id = :r AND sender = :u 
    ORDER BY id DESC LIMIT 1
  ");
  $qLast->execute([':r' => $roomId, ':u' => $userId]);
  $last = $qLast->fetchColumn();
  if ($last && (strtotime($last) >= time() - 2)) {
    $db->rollBack();
    jsonResponse(false, null, 'ส่งถี่เกินไป โปรดลองใหม่อีกครั้ง', 429);
  }

  // กันสแปม: รวมทั้งระบบ 60 วินาทีไม่เกิน 30 ข้อความ
  $qFlood = $db->prepare("
    SELECT COUNT(*) FROM chat
    WHERE sender = :u AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
  ");
  $qFlood->execute([':u' => $userId]);
  if ((int)$qFlood->fetchColumn() > 30) {
    $db->rollBack();
    jsonResponse(false, null, 'ส่งบ่อยเกินกำหนด (anti-spam)', 429);
  }

  // บันทึกข้อความ
  $ins = $db->prepare("
    INSERT INTO chat (raid_rooms_id, sender, message, created_at)
    VALUES (:r, :u, :m, :t)
  ");
  $now = now();
  $ins->execute([':r' => $roomId, ':u' => $userId, ':m' => $message, ':t' => $now]);
  $msgId = (int)$db->lastInsertId();

  // ดึงข้อมูลส่งกลับ (พร้อมชื่อผู้ใช้/รูป)
  $qMsg = $db->prepare("
    SELECT c.id, c.raid_rooms_id AS room_id, c.sender AS user_id, c.message, c.created_at,
           u.username, u.avatar
    FROM chat c
    JOIN users u ON u.id = c.sender
    WHERE c.id = :id
    LIMIT 1
  ");
  $qMsg->execute([':id' => $msgId]);
  $row = $qMsg->fetch();

  $db->commit();

  jsonResponse(true, ['message' => $row], 'ส่งข้อความสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'ส่งข้อความล้มเหลว', 500);
}
