<?php
// api/chat/friend/read_messages.php  (แนะนำเปลี่ยนชื่อจาก send.php ให้สื่อความหมาย)
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors(); // ให้เหมือน raid/*

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
if (!$userId) {
  jsonResponse(false, null, 'Unauthorized', 401);
}

$input        = getJsonInput();
$friendshipId = (int)($input['friendship_id'] ?? 0);
$sender = (int)($input['sender'] ?? 0);

if ($friendshipId <= 0) {
  jsonResponse(false, null, 'friendship_id ไม่ถูกต้อง', 422);
}
if ($sender <= 0) {
  jsonResponse(false, null, 'sender ไม่ถูกต้อง', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // ✅ ตรวจว่า user อยู่ใน friendship นี้จริง และหา "คู่สนทนา" อีกฝั่ง
  // ปรับชื่อคอลัมน์ให้ตรง schema ของคุณ (ตัวอย่างนี้ใช้ requester_id/addressee_id)
  $qFr = $db->prepare("
    SELECT id, requester_id, addressee_id
    FROM friendships
    WHERE id = :id
      AND (requester_id = :uid OR addressee_id = :uid)
    FOR UPDATE
  ");
  $qFr->execute([':id' => $friendshipId, ':uid' => $userId]);
  $fr = $qFr->fetch(PDO::FETCH_ASSOC);
  if (!$fr) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบความสัมพันธ์หรือไม่มีสิทธิ์เข้าถึง', 404);
  }

    $sql = "
    UPDATE chat_friends
    SET status = 'read'
    WHERE friendship_id = :fs
        AND sender = :sd
        AND status = 'send'
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([
    ':fs'    => $friendshipId,
    ':sd'    => $sender,
    ]);

  $affected = $stmt->rowCount();
  $db->commit();

  jsonResponse(true, [
    'updated'       => (int)$affected,
    'friendship_id' => $friendshipId,
    'sender'        => $sender,
    'read_up_to_id' => $upToId > 0 ? $upToId : null,
  ], 'อ่านข้อความสำเร็จ', 200);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  // error_log('[friend/read_messages] ' . $e->getMessage());
  jsonResponse(false, null, 'อ่านข้อความล้มเหลว', 500);
}
