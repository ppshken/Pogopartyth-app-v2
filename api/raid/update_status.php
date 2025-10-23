<?php
// api/raid/update_status.php
declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

$roomId    = (int)($input['room_id'] ?? 0);
$newStatus = strtolower(trim($input['status'] ?? ''));   // invited|active|closed|canceled

$allowed = ['invited','active','closed','canceled'];
if ($roomId <= 0 || !in_array($newStatus, $allowed, true)) {
  jsonResponse(false, null, 'room_id หรือ status ไม่ถูกต้อง (invited|active|closed|canceled)', 422);
}

$db = pdo();

/** --------- helper: ส่ง Expo Push (batch) --------- */
function expoPush(array $tokens, string $title, string $body, array $data = []): array {
  // ทำความสะอาด token
  $tokens = array_values(array_unique(array_filter(array_map('trim', $tokens))));
  if (!$tokens) return ['attempted' => 0, 'sent' => 0, 'errors' => []];

  $sent = 0;
  $errors = [];

  // Expo จำกัด ~100 รายการต่อครั้ง
  foreach (array_chunk($tokens, 90) as $chunk) {
    $messages = [];
    foreach ($chunk as $t) {
      // ข้าม token ที่ไม่ใช่รูปแบบ ExponentPushToken
      if (strpos($t, 'ExponentPushToken') !== 0) continue;
      $messages[] = [
        'to'    => $t,
        'sound' => 'default',
        'title' => $title,
        'body'  => $body,
        'data'  => $data,
      ];
    }
    if (!$messages) continue;

    $payload = json_encode($messages, JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://exp.host/--/api/v2/push/send');
    curl_setopt_array($ch, [
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
      CURLOPT_POSTFIELDS     => $payload,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT        => 15,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300) {
      $errors[] = $err ?: ("HTTP ".$code." / ".$resp);
      continue;
    }

    // นับว่า “ส่งถึง Expo” สำเร็จแล้ว (delivery ไปเครื่องจริงอาจยัง pending)
    $sent += count($messages);
  }

  return ['attempted' => count($tokens), 'sent' => $sent, 'errors' => $errors];
}

try {
  $db->beginTransaction();

  $q = $db->prepare("
    SELECT id, owner_id, status, start_time, max_members
    FROM raid_rooms
    WHERE id = :id
    FOR UPDATE
  ");
  $q->execute([':id' => $roomId]);
  $room = $q->fetch(PDO::FETCH_ASSOC);
  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
  }

  // (ทางเลือก) บังคับให้เฉพาะหัวห้องเท่านั้นที่เปลี่ยนเป็น invited ได้
  if ($newStatus === 'invited' && (int)$room['owner_id'] !== $userId) {
    $db->rollBack();
    jsonResponse(false, null, 'เฉพาะหัวห้องเท่านั้นที่สามารถเชิญสมาชิกได้', 403);
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

  // อัปเดตสถานะ
  $u = $db->prepare("UPDATE raid_rooms SET status = :s WHERE id = :id");
  $u->execute([':s' => $newStatus, ':id' => $roomId]);

  // นับสมาชิกปัจจุบัน
  $cnt = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :r");
  $cnt->execute([':r' => $roomId]);
  $current = (int)$cnt->fetchColumn();

  $db->commit();

  $pushResult = null;

  // ถ้าหัวห้อง set เป็น invited → แจ้งเตือนทุกคนในห้อง
  if ($newStatus === 'invited') {
    // ดึงรายชื่อ token ของสมาชิกในห้อง (รวมเจ้าของด้วยก็ได้)
    $tokStmt = $db->prepare("
      SELECT u.device_token
      FROM user_raid_rooms urr
      JOIN users u ON u.id = urr.user_id
      WHERE urr.room_id = :r
        AND u.noti_status = 'on'
        AND u.device_token IS NOT NULL
        AND u.device_token <> ''
    ");
    $tokStmt->execute([':r' => $roomId]);
    $tokens = array_column($tokStmt->fetchAll(PDO::FETCH_ASSOC), 'device_token');

    // สร้างข้อความ
    $title = "หัวห้องส่งคำเชิญเข้าร่วมเรดแล้ว";
    $body  = "ห้อง #{$roomId} เชิญในเกมแล้ว กดเข้าได้เลย";

    // ข้อมูลเสริมสำหรับเปิดหน้าจอเฉพาะในแอป
    $data  = [
      'type'     => 'raid_invited',
      'room_id'  => (int)$room['id'],
      'status'   => $newStatus,
      'ts'       => time(),
      'url'      => "pogopartyth://rooms/".(int)$room['id'],
    ];

    // ส่ง push แบบ batch
    $pushResult = expoPush($tokens, $title, $body, $data);
  }

  jsonResponse(true, [
    'room_id'         => (int)$room['id'],
    'old_status'      => $room['status'],
    'new_status'      => $newStatus,
    'current_members' => $current,
    'push'            => $pushResult, // อาจเป็น null ถ้าไม่ได้ส่ง
  ], 'อัปเดตสถานะสำเร็จ');

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  // ไม่เปิดเผยรายละเอียด error ใน production
  jsonResponse(false, null, 'อัปเดตสถานะล้มเหลว', 500);
}
