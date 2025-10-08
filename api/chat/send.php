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

/** ------------------------------
 *  🔔 NOTI: Helper ส่ง Expo Push
 *  ------------------------------ */
function sendExpoPush(array $tokens, string $title, string $body, array $data = []): array {
  // กรอง & ไม่ซ้ำ & เฉพาะ Expo token
  $tokens = array_values(array_unique(array_filter($tokens, function ($t) {
    return is_string($t) && $t !== '' && str_starts_with($t, 'ExponentPushToken[');
  })));

  if (!$tokens) return ['sent' => 0, 'responses' => []];

  // เตรียมข้อความ (Expo รองรับส่งเป็น array ทีเดียว)
  $messages = [];
  foreach ($tokens as $t) {
    $messages[] = [
      'to'        => $t,
      'sound'     => 'default',
      'title'     => $title,
      'body'      => $body,
      'data'      => $data,
      'priority'  => 'high',
      'ttl'       => 60, // วินาที (พลาดแล้วไม่ต้อง retry นาน)
      'url'      => "pogopartyth://rooms/".$roomId."chat",
    ];
  }

  $responses = [];
  foreach (array_chunk($messages, 100) as $chunk) {
    $ch = curl_init('https://exp.host/--/api/v2/push/send');
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Accept: application/json',
      ],
      CURLOPT_POSTFIELDS     => json_encode($chunk, JSON_UNESCAPED_UNICODE),
      CURLOPT_TIMEOUT        => 12,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);

    $responses[] = $err ? ['error' => $err] : (json_decode($resp, true) ?? ['raw' => $resp]);
  }

  return ['sent' => count($messages), 'responses' => $responses];
}

$db = pdo();

try {
  $db->beginTransaction();

  // ห้องต้องมีและ active (ดึง boss มาด้วยเพื่อใส่ในแจ้งเตือน)
  $qRoom = $db->prepare("SELECT id, status, boss FROM raid_rooms WHERE id = :id FOR UPDATE");
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

  /** -------------------------------------
   *  🔔 NOTI: แจ้งเตือนสมาชิกในห้อง (ยกเว้นผู้ส่ง)
   *  ------------------------------------- */
  $qTok = $db->prepare("
    SELECT DISTINCT u.device_token
    FROM user_raid_rooms urr
    JOIN users u ON u.id = urr.user_id
    WHERE urr.room_id = :r
      AND u.id <> :u
      AND u.device_token IS NOT NULL
      AND u.device_token <> ''
  ");
  $qTok->execute([':r' => $roomId, ':u' => $userId]);
  $tokens = array_column($qTok->fetchAll(), 'device_token');

  // title/body ของแจ้งเตือน
  $boss  = $room['boss'] ?? null;
  $title = $boss ? "[$boss] #[$roomId] ข้อความใหม่" : "ข้อความใหม่ในห้อง #{$row['room_id']}";
  // ตัดข้อความให้สั้นสวย ๆ
  if (function_exists('mb_strimwidth')) {
    $body = mb_strimwidth($row['username'] . ': ' . $row['message'], 0, 90, '…', 'UTF-8');
  } else {
    $body = (strlen($row['username'] . ': ' . $row['message']) > 90)
      ? substr($row['username'] . ': ' . $row['message'], 0, 87) . '…'
      : $row['username'] . ': ' . $row['message'];
  }

  $data = [
    'type'         => 'chat_message',
    'room_id'      => (int)$row['room_id'],
    'message_id'   => (int)$row['id'],
    'from_user_id' => (int)$row['user_id'],
    'boss'         => $boss,
  ];

  $notiResult = sendExpoPush($tokens, $title, $body, $data);
  // ไม่ล็อกผลล้มเหลวให้กระทบการส่งแชท (fire-and-forget)
  // ถ้าอยาก debug: file_put_contents(__DIR__.'/../logs/push.log', json_encode([$tokens, $notiResult]).PHP_EOL, FILE_APPEND);

  jsonResponse(true, [
    'message'  => $row,
    'notified' => $notiResult['sent'], // จำนวนที่พยายามส่ง
  ], 'ส่งข้อความสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'ส่งข้อความล้มเหลว', 500);
}
