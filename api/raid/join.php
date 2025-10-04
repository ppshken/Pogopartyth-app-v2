<?php
// api/raid/join.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

/**
 * ส่ง Expo Push Notification แบบง่าย ๆ
 */
function sendExpoPush(string $to, string $title, string $body, array $data = []): bool
{
  if ($to === '') return false;

  $payload = json_encode([
    'to'    => $to,
    'title' => $title,
    'body'  => $body,
    'sound' => 'default',
    'data'  => $data,
  ], JSON_UNESCAPED_UNICODE);

  $ch = curl_init('https://exp.host/--/api/v2/push/send');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
      'Content-Type: application/json',
      'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_TIMEOUT        => 10,
  ]);

  $res  = curl_exec($ch);
  $err  = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($err || $code >= 400) return false;

  // ถ้าอยากเช็คสถานะละเอียดขึ้น สามารถ parse $res ได้
  // $json = json_decode((string)$res, true);
  // return ($json['data']['status'] ?? null) === 'ok';

  return true; // ถือว่าสำเร็จถ้า HTTP 2xx และไม่มี error
}

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

  // 🔒 ล็อคแถวของห้องไว้กันแข่งกันแทรก
  $stmt = $db->prepare("
    SELECT id, status, start_time, max_members, owner_id
    FROM raid_rooms
    WHERE id = :id
    FOR UPDATE
  ");
  $stmt->execute([':id' => $roomId]);
  $room = $stmt->fetch();

  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
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

  // ✅ ปิดธุรกรรมให้เรียบร้อยก่อน ค่อยยิง Push
  $db->commit();

  // ─────────────────────────────────────────────
  // 🔔 ส่ง Notification ไปหา "หัวห้อง"
  // ─────────────────────────────────────────────

  // ข้ามถ้าคนที่ join คือหัวห้องเอง (กันแจ้งเตือนตัวเอง)
  $ownerId = (int)$room['owner_id'];
  if ($ownerId > 0 && $ownerId !== (int)$userId) {
    try {
      // ดึง token ของหัวห้อง
      $stmt = $db->prepare("SELECT device_token, username FROM users WHERE id = :id LIMIT 1");
      $stmt->execute([':id' => $ownerId]);
      $owner = $stmt->fetch();

      // ดึงชื่อผู้เข้าร่วม
      $stmt = $db->prepare("SELECT username FROM users WHERE id = :id LIMIT 1");
      $stmt->execute([':id' => $userId]);
      $joiner = $stmt->fetch();

      // นับสมาชิกหลังเข้าร่วม (เพื่อแสดง x/y)
      $stmt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r");
      $stmt->execute([':r' => $roomId]);
      $countAfter = (int)$stmt->fetchColumn();

      $max = (int)$room['max_members'];
      $ownerToken = (string)($owner['device_token'] ?? '');
      $joinerName = (string)($joiner['username'] ?? 'สมาชิกใหม่');

      if ($ownerToken !== '') {
        $title = 'มีสมาชิกใหม่เข้าร่วมห้อง';
        $body  = "{$joinerName} เข้าร่วมแล้ว (สมาชิก {$countAfter}/{$max})";
        $data  = [
          'type'     => 'raid_member_join',
          'room_id'  => $roomId,
          'user_id'  => (int)$userId,
          'owner_id' => $ownerId,
          // ใส่เพิ่มได้ เช่น route ในแอพของคุณ
        ];

        // ยิง push (ไม่ทำให้ flow ล้มเหลวหากส่งไม่สำเร็จ)
        @sendExpoPush($ownerToken, $title, $body, $data);
      }
    } catch (\Throwable $e) {
      // เงียบไว้ ไม่ให้กระทบการตอบกลับหลัก
      // ถ้าต้องการ log ให้เพิ่มที่นี่ได้
    }
  }

  // ตอบกลับปกติ
  jsonResponse(true, ['room_id' => $roomId], 'เข้าร่วมห้องสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'เข้าร่วมห้องล้มเหลว', 500);
}
