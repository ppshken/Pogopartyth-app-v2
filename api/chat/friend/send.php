<?php
// api/chat/friend/send.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors(); // ให้เหมือน raid/send.php

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

$friendshipId = (int)($input['friendship_id'] ?? 0);
$message      = trim((string)($input['message'] ?? ''));

if ($friendshipId <= 0 || $message === '') {
  jsonResponse(false, null, 'friendship_id หรือ message ไม่ถูกต้อง', 422);
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

  $messages = [];
  foreach ($tokens as $t) {
    $messages[] = [
      'to'       => $t,
      'sound'    => 'default',
      'title'    => $title,
      'body'     => $body,
      'data'     => $data,
      'priority' => 'high',
      'ttl'      => 60,
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

  // ✅ ตรวจว่า friendship มีจริงและผู้ใช้เป็นคู่สนทนาฝ่ายหนึ่ง
  // หมายเหตุ: ปรับชื่อคอลัมน์ให้ตรง DB คุณ (ตัวอย่างนี้ใช้ requester_id / addressee_id)
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

  // หา user ฝั่งตรงข้าม
  $otherId = ((int)$fr['requester_id'] === $userId) ? (int)$fr['addressee_id'] : (int)$fr['requester_id'];

  // ⛔️ Anti-spam: ข้อความล่าสุดใน friendship เดียวกัน ภายใน 1 วินาที
  $qLast = $db->prepare("
    SELECT created_at
    FROM chat_friends
    WHERE friendship_id = :f AND sender = :u
    ORDER BY id DESC
    LIMIT 1
  ");
  $qLast->execute([':f' => $friendshipId, ':u' => $userId]);
  $last = $qLast->fetchColumn();
  if ($last && (strtotime($last) >= time() - 1)) {
    $db->rollBack();
    jsonResponse(false, null, 'ส่งถี่เกินไป โปรดลองใหม่อีกครั้ง', 429);
  }

  // ⛔️ Anti-flood: ทั้งระบบ 60 วินาที ไม่เกิน 30 ข้อความ
  $qFlood = $db->prepare("
    SELECT COUNT(*) 
    FROM chat_friends
    WHERE sender = :u AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
  ");
  $qFlood->execute([':u' => $userId]);
  if ((int)$qFlood->fetchColumn() > 30) {
    $db->rollBack();
    jsonResponse(false, null, 'ส่งบ่อยเกินกำหนด (anti-spam)', 429);
  }

  // ✅ บันทึกข้อความ (status ให้ตรง schema คุณ: 'send' หรือ 'sent')
  $now = now();
  $ins = $db->prepare("
    INSERT INTO chat_friends (friendship_id, sender, message, status, created_at)
    VALUES (:f, :u, :m, 'send', :t)
  ");
  $ins->execute([':f' => $friendshipId, ':u' => $userId, ':m' => $message, ':t' => $now]);
  $msgId = (int)$db->lastInsertId();

  // ✅ ดึงข้อความที่เพิ่งสร้าง (รวมโปรไฟล์ผู้ส่ง)
  $qMsg = $db->prepare("
    SELECT 
      cf.id,
      cf.friendship_id,
      cf.sender     AS user_id,
      cf.message,
      cf.status,
      cf.created_at,
      u.username,
      u.avatar
    FROM chat_friends cf
    JOIN users u ON u.id = cf.sender
    WHERE cf.id = :id
    LIMIT 1
  ");
  $qMsg->execute([':id' => $msgId]);
  $row = $qMsg->fetch(PDO::FETCH_ASSOC);

  $db->commit();

  /** -------------------------------------
   *  🔔 NOTI: แจ้งเตือน “อีกฝั่ง” ของแชทเพื่อน
   *  ------------------------------------- */
  $qTok = $db->prepare("
    SELECT device_token
    FROM users
    WHERE id = :other
      AND noti_status = 'on'
      AND device_token IS NOT NULL
      AND device_token <> ''
  ");
  $qTok->execute([':other' => $otherId]);
  $tokens = array_column($qTok->fetchAll(), 'device_token');

  // title/body ของแจ้งเตือน
  $senderName = $row['username'] ?? 'เพื่อนของคุณ';
  // ตัดข้อความให้สวย
  if (function_exists('mb_strimwidth')) {
    $body = mb_strimwidth($senderName . ': ' . $row['message'], 0, 90, '…', 'UTF-8');
  } else {
    $body = (strlen($senderName . ': ' . $row['message']) > 90)
      ? substr($senderName . ': ' . $row['message'], 0, 87) . '…'
      : $senderName . ': ' . $row['message'];
  }

  $data = [
    'type'           => 'friend_chat_message',
    'friendship_id'  => (int)$row['friendship_id'],
    'message_id'     => (int)$row['id'],
    'from_user_id'   => (int)$row['user_id'],
    // ปรับ deep link ให้ตรงแอปคุณ
    'url'            => "pogopartyth://friends/chat?friendshipId=".$friendshipId,
  ];

  $notiResult = sendExpoPush($tokens, 'ข้อความใหม่', $body, $data);

  // ✅ รูปแบบตอบกลับ “ให้เหมือน raid/send.php”
  jsonResponse(true, [
    'message'  => $row,                 // NOTE: key = message (ไม่ใช่ item)
    'notified' => $notiResult['sent'],  // จำนวน token ที่พยายามส่ง
  ], 'ส่งข้อความสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  // error_log('[friend/send] '.$e->getMessage());
  jsonResponse(false, null, 'ส่งข้อความล้มเหลว', 500);
}
