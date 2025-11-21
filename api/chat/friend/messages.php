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
  $beforeId      = (int)($_GET['before_id'] ?? 0); // <-- new: for loading older messages (id < before_id)
  $limit         = (int)($_GET['limit'] ?? 20); // เพิ่ม default เป็น 20

  if ($friendship_id <= 0) {
    jsonResponse(false, null, 'friendship_id ไม่ถูกต้อง', 422);
  }

  $db = pdo();

  // ตรวจสิทธิ์เป็นคู่สนทนาจริง
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

  // ----- ดึงข้อความ ตามกรณีต่างๆ -----
  $rows = [];

  if ($sinceId > 0) {
    // ดึงข้อความใหม่: id > sinceId (เรียง asc)
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
      LIMIT :lim
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':fs', $friendship_id, PDO::PARAM_INT);
    $stmt->bindValue(':sid', $sinceId, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  } elseif ($beforeId > 0) {
    // ดึงข้อความเก่า: id < beforeId (เอา newest ก่อนแล้ว reverse เพื่อส่งกลับเป็นเก่า->ใหม่)
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
        AND cf.id < :bid
      ORDER BY cf.id DESC
      LIMIT :lim
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':fs', $friendship_id, PDO::PARAM_INT);
    $stmt->bindValue(':bid', $beforeId, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC)); // กลับมาเป็นเก่า->ใหม่ (ASC)
  } else {
    // ครั้งแรก: ดึงล่าสุด N แถว (ORDER BY id DESC แล้ว reverse)
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
      LIMIT :lim
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':fs', $friendship_id, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC)); // กลับมาเป็นเก่า->ใหม่ (ASC)
  }

  // next_since_id (ใช้สำหรับการ poll ดึงของใหม่)
  $nextSinceId = $sinceId;
  foreach ($rows as $row) {
    $mid = (int)$row['id'];
    if ($mid > $nextSinceId) $nextSinceId = $mid;
  }

  // หา oldest_id (แถวที่เก่าที่สุดในผลลัพธ์) และตรวจ has_more (มีข้อความเก่าอีกไหม)
  $oldestId = null;
  if (count($rows) > 0) {
    $oldestId = (int)$rows[0]['id'];
    $checkMore = $db->prepare("
      SELECT 1 FROM chat_friends
      WHERE friendship_id = :fs AND id < :old
      LIMIT 1
    ");
    $checkMore->execute([':fs' => $friendship_id, ':old' => $oldestId]);
    $has_more = (bool)$checkMore->fetchColumn();
  } else {
    // ไม่มีแถวในผลลัพธ์ -> ตรวจว่า room มีข้อความหรือไม่
    $checkAny = $db->prepare("
      SELECT 1 FROM chat_friends
      WHERE friendship_id = :fs
      LIMIT 1
    ");
    $checkAny->execute([':fs' => $friendship_id]);
    $has_more = false;
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

  // ----- สร้าง groups ตามวันที่ (YYYY-MM-DD) -----
  $groupsMap = [];
  foreach ($rows as $r) {
    // created_at assumed in SQL datetime format
    $d = date('Y-m-d', strtotime($r['created_at']));
    if (!isset($groupsMap[$d])) $groupsMap[$d] = [];
    $groupsMap[$d][] = $r;
  }
  // เปลี่ยนเป็น array ที่เก็บวันที่เรียงจากเก่า->ใหม่
  $groups = [];
  if (!empty($groupsMap)) {
    ksort($groupsMap);
    foreach ($groupsMap as $date => $arr) {
      $groups[] = [
        'date' => $date,
        'items' => $arr,
      ];
    }
  }

  jsonResponse(true, [
    'items'         => $rows,              // flat list (oldest -> newest)
    'count'         => count($rows),
    'groups'        => $groups,            // grouped by date [{date, items:[...]}]
    'next_since_id' => $nextSinceId,
    'oldest_id'     => $oldestId,
    'has_more'      => $has_more,
    'server_time'   => now(),
    'chat_all'      => $chat_all,
  ], 'ดึงข้อความสำเร็จ');

} catch (Throwable $e) {
  error_log('[chat/messages] '.$e->getMessage());

  $isDev = getenv('APP_ENV') === 'dev';
  $msg = $isDev ? ('server error: '.$e->getMessage()) : 'ส่งไม่สำเร็จ (server error)';
  jsonResponse(false, null, $msg, 500);
}
