<?php
// api/friend/add.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard(); // อ่านจาก token
$input  = getJsonInput();

$targetId = (int)($input['target_id'] ?? 0);
if ($targetId <= 0) {
  jsonResponse(false, null, 'target_id ไม่ถูกต้อง', 422);
}
if ($targetId === $userId) {
  jsonResponse(false, null, 'ห้ามขอเป็นเพื่อนกับตัวเอง', 422);
}

$db = pdo();

try {

  // 2) ตรวจว่ามีความสัมพันธ์อยู่แล้วไหม
  $q = $db->prepare("
    SELECT id, requester_id, addressee_id, status
    FROM friendships
    WHERE pair_min_id = LEAST(:me, :other)
      AND pair_max_id = GREATEST(:me, :other)
    LIMIT 1
  ");
  $q->execute([':me' => $userId, ':other' => $targetId]);
  $exist = $q->fetch();

  if ($exist) {
    // มีแถวอยู่แล้ว
    if ($exist['status'] === 'accepted') {
      jsonResponse(false, null, 'เป็นเพื่อนกันอยู่แล้ว', 409);
    } elseif ($exist['status'] === 'pending') {
      // ถ้าฉันเป็นคนส่งคำขอเอง
      if ((int)$exist['requester_id'] === $userId) {
        jsonResponse(false, null, 'คุณได้ส่งคำขอไปแล้ว', 409);
      } else {
        jsonResponse(false, null, 'อีกฝ่ายส่งคำขอมาแล้ว กรุณากดตอบรับ', 409);
      }
    } else {
      // declined → รีเซ็ตเป็น pending ใหม่ได้
      $upd = $db->prepare("
        UPDATE friendships
        SET requester_id = :me,
            addressee_id = :other,
            status = 'pending',
            created_at = CURRENT_TIMESTAMP,
            responded_at = NULL
        WHERE id = :id
      ");
      $upd->execute([':me' => $userId, ':other' => $targetId, ':id' => $exist['id']]);
      jsonResponse(true, null, 'ส่งคำขอเป็นเพื่อนใหม่อีกครั้ง');
    }
  }

  // 3) แทรกแถวใหม่
  $ins = $db->prepare("
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (:me, :other, 'pending')
  ");
  $ins->execute([':me' => $userId, ':other' => $targetId]);

  jsonResponse(true, null, 'ส่งคำขอเป็นเพื่อนเรียบร้อยแล้ว');
} catch (Throwable $e) {
  jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
}
