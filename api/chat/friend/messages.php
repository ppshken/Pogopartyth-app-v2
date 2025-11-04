<?php
// api/chat/messages.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

try {
  $userId = authGuard();
  if (!$userId) {
    jsonResponse(false, null, 'Unauthorized', 401);
  }

  $friendship_id = (int)($_GET['friendship_id'] ?? 0);
  $sinceId       = (int)($_GET['since_id'] ?? 0);
  $limit         = (int)($_GET['limit'] ?? 5);

  if ($friendship_id <= 0) {
    jsonResponse(false, null, 'friendship_id ไม่ถูกต้อง', 422);
  }

  $db = pdo();

  // ✅ ตรวจสิทธิ์เป็นคู่สนทนาจริง
  $qRoom = $db->prepare("
    SELECT id
    FROM friendships
    WHERE id = :id
      AND (requester_id = :uid OR addressee_id = :uid)
    LIMIT 1
  ");
  $qRoom->execute([':id' => $friendship_id, ':uid' => $userId]);
  if (!$qRoom->fetch(PDO::FETCH_ASSOC)) {
    jsonResponse(false, null, 'ไม่พบห้องหรือไม่มีสิทธิ์เข้าถึง', 404);
  }

  // ✅ ดึงข้อความ
  if ($sinceId > 0) {
    // id > since_id (เพิ่มมาใหม่ๆ)
    $sql = "
      SELECT
        cf.id,
        cf.friendship_id,
        cf.sender      AS user_id,
        cf.message,
        cf.status,
        cf.created_at,
        u.username,
        u.avatar
      FROM chat_friends cf
      JOIN users u ON u.id = cf.sender
      WHERE cf.friendship_id = :fs
        AND cf.id > :sid
      ORDER BY cf.id ASC
      LIMIT {$limit}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([
      ':fs'  => $friendship_id,
      ':sid' => $sinceId,
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  } else {
    // ล่าสุด N แถว แล้วค่อย reverse เพื่อแสดงเก่า->ใหม่
    $sql = "
      SELECT
        cf.id,
        cf.friendship_id,
        cf.sender      AS user_id,
        cf.message,
        cf.status,
        cf.created_at,
        u.username,
        u.avatar
      FROM chat_friends cf
      JOIN users u ON u.id = cf.sender
      WHERE cf.friendship_id = :fs
      ORDER BY cf.id DESC
      LIMIT {$limit}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':fs' => $friendship_id]);
    $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
  }

  // next_since_id
  $nextSinceId = $sinceId;
  foreach ($rows as $row) {
    $mid = (int)$row['id'];
    if ($mid > $nextSinceId) $nextSinceId = $mid;
  }

  // นับจำนวนทั้งหมด
  $count = "
      SELECT COUNT(*)
      FROM chat_friends cf
      WHERE cf.friendship_id = :fs
    ";
  $total = $db->prepare($count);
  $total->execute([':fs' => $friendship_id]);
  $chat_all = (int)$total->fetchColumn();

  jsonResponse(true, [
    'items'         => $rows,
    'count'         => count($rows),
    'next_since_id' => $nextSinceId,
    'server_time'   => now(),
    'chat_all'      => $chat_all,
  ], 'ดึงข้อความสำเร็จ');

} catch (Throwable $e) {
  // แนะนำให้เปิด log จริงในโปรดักชัน
  error_log('[chat/messages] '.$e->getMessage());

  // ถ้าอยากเห็น error detail เฉพาะตอน dev:
  $isDev = getenv('APP_ENV') === 'dev';
  $msg = $isDev ? ('server error: '.$e->getMessage()) : 'ส่งไม่สำเร็จ (server error)';
  jsonResponse(false, null, $msg, 500);
}
