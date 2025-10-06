<?php
// api/raid/review.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

/**
 * อินพุต:
 * - room_id (int)      : ห้องที่จะรีวิว
 * - rating (1..5,int)  : คะแนน 1–5
 * - comment (string?)  : คอมเมนต์ (ออปชัน, ยาวไม่เกิน 1000 ตัวอักษร)
 */
$roomId  = (int)($input['room_id'] ?? 0);
$rating  = (int)($input['rating']  ?? 0);
$comment = trim($input['comment']   ?? '');

if ($roomId <= 0 || $rating < 1 || $rating > 5) {
  jsonResponse(false, null, 'room_id หรือ rating ไม่ถูกต้อง', 422);
}
if (mb_strlen($comment) > 1000) {
  jsonResponse(false, null, 'comment ยาวเกิน 1000 ตัวอักษร', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // 1) ตรวจสอบห้อง
  $qRoom = $db->prepare("
    SELECT id, owner_id, status, start_time, COALESCE(avg_rating, 0) AS avg_rating, review_count
    FROM raid_rooms
    WHERE id = :id
    FOR UPDATE
  ");
  $qRoom->execute([':id' => $roomId]);
  $room = $qRoom->fetch();
  if (!$room) {
    $db->rollBack();
    jsonResponse(false, null, 'ไม่พบห้อง', 404);
  }

  // 2) เงื่อนไข: ต้องเป็นสมาชิกปัจจุบัน หรือเป็นเจ้าของห้อง
  $isOwner = ((int)$room['owner_id'] === $userId);
  $qMem = $db->prepare("SELECT 1 FROM user_raid_rooms WHERE room_id = :r AND user_id = :u LIMIT 1");
  $qMem->execute([':r' => $roomId, ':u' => $userId]);
  $isMember = (bool)$qMem->fetchColumn();

  if (!$isOwner && !$isMember) {
    $db->rollBack();
    jsonResponse(false, null, 'ต้องเป็นสมาชิกห้องหรือเจ้าของห้องเท่านั้น', 403);
  }

  // 3) เงื่อนไขเวลา: อนุญาตให้รีวิวหลังถึงเวลาเริ่ม หรือห้องถูกปิด/ยกเลิก
  $startOk = (strtotime($room['start_time']) <= time());
  $statusOk = in_array($room['status'], ['closed','canceled','invited'], true);
  if (!$startOk && !$statusOk) {
    $db->rollBack();
    jsonResponse(false, null, 'ยังไม่ถึงเวลารีวิว (ยังไม่ถึงเวลาเริ่ม หรือห้องยัง active)', 409);
  }

  // 4) มีรีวิวเก่าไหม? (ล็อกแถว)
  $qOld = $db->prepare("
    SELECT id FROM raid_reviews
    WHERE room_id = :r AND user_id = :u
    FOR UPDATE
  ");
  $qOld->execute([':r' => $roomId, ':u' => $userId]);
  $old = $qOld->fetch();

  if ($old) {
    // อัปเดตรีวิว
    $u = $db->prepare("
      UPDATE raid_reviews
      SET rating = :rating,
          comment = :comment,
          updated_at = :ts
      WHERE id = :id
    ");
    $u->execute([
      ':rating'  => $rating,
      ':comment' => ($comment !== '' ? $comment : null),
      ':ts'      => now(),
      ':id'      => (int)$old['id'],
    ]);
    $reviewId = (int)$old['id'];
    $action = 'updated';
  } else {
    // สร้างรีวิวใหม่
    $i = $db->prepare("
      INSERT INTO raid_reviews (room_id, user_id, rating, comment, created_at)
      VALUES (:r, :u, :rating, :comment, :ts)
    ");
    $i->execute([
      ':r'       => $roomId,
      ':u'       => $userId,
      ':rating'  => $rating,
      ':comment' => ($comment !== '' ? $comment : null),
      ':ts'      => now(),
    ]);
    $reviewId = (int)$db->lastInsertId();
    $action = 'created';
  }

  // 5) คำนวณค่าเฉลี่ย/จำนวน แล้วอัปเดตลง raid_rooms
  $qAgg = $db->prepare("SELECT COUNT(*) AS cnt, AVG(rating) AS avg FROM raid_reviews WHERE room_id = :r");
  $qAgg->execute([':r' => $roomId]);
  $agg = $qAgg->fetch();
  $count = (int)$agg['cnt'];
  $avg   = $agg['avg'] !== null ? round((float)$agg['avg'], 2) : null;

  $uRoom = $db->prepare("UPDATE raid_rooms SET review_count = :c, avg_rating = :a WHERE id = :id");
  $uRoom->execute([':c' => $count, ':a' => $avg, ':id' => $roomId]);

  // [NEW] ตรวจว่าครบทุกคนที่เข้าร่วมห้องแล้วหรือยัง ถ้าครบให้ปิดห้อง (closed)
  // นับจำนวน "ผู้เข้าร่วมทั้งหมด"
  $qMembers = $db->prepare("SELECT DISTINCT user_id FROM user_raid_rooms WHERE room_id = :r FOR UPDATE");
  $qMembers->execute([':r' => $roomId]);
  $memberIds = $qMembers->fetchAll(PDO::FETCH_COLUMN, 0);

  // รวมเจ้าของห้องเข้าไปถ้ายังไม่มีในรายการสมาชิก
  $ownerId = (int)$room['owner_id'];
  $allParticipantIds = $memberIds ?: [];
  if (!in_array($ownerId, array_map('intval', $allParticipantIds), true)) {
    $allParticipantIds[] = $ownerId;
  }
  $totalParticipants = count(array_unique(array_map('intval', $allParticipantIds)));

  // นับจำนวน "ผู้ที่รีวิวแล้ว" (distinct user_id)
  $qReviewed = $db->prepare("SELECT COUNT(DISTINCT user_id) FROM raid_reviews WHERE room_id = :r");
  $qReviewed->execute([':r' => $roomId]);
  $totalReviewed = (int)$qReviewed->fetchColumn();

  $autoClosed = false;
  // ปิดห้องเฉพาะเมื่อยังไม่ถูกปิด/ยกเลิกมาก่อน และรีวิวครบทุกคนแล้ว
  if ($totalParticipants > 0 && $totalReviewed >= $totalParticipants && !in_array($room['status'], ['closed','canceled'], true)) {
    $uStatus = $db->prepare("UPDATE raid_rooms SET status = 'closed' WHERE id = :id");
    $uStatus->execute([':id' => $roomId]);
    $autoClosed = true;
    // อัปเดตค่าในตัวแปร $room เพื่อให้ response สะท้อนสถานะล่าสุด
    $room['status'] = 'closed';
  }

  $db->commit();

  jsonResponse(true, [
    'review' => [
      'id'       => $reviewId,
      'room_id'  => $roomId,
      'user_id'  => $userId,
      'rating'   => $rating,
      'comment'  => ($comment !== '' ? $comment : null),
      'status'   => $action, // created | updated
    ],
    'room_stats' => [
      'review_count' => $count,
      'avg_rating'   => $avg,
    ],
    // [NEW] ส่งสถานะห้องและธงบอกว่า auto-closed หรือไม่
    'room_status' => [
      'current'     => $room['status'],
      'auto_closed' => $autoClosed,
      'participants_total' => $totalParticipants,
      'reviewed_total'     => $totalReviewed,
    ],
  ], 'บันทึกรีวิวสำเร็จ');

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'บันทึกรีวิวล้มเหลว', 500);
}
