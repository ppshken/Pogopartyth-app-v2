<?php
// api/raid/cancel-reason.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();  // ต้องล็อกอิน
$input  = getJsonInput();

$roomId = (int)($input['room_id'] ?? 0);
$reason = trim((string)($input['reason'] ?? ''));

if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}
if ($reason === '') {
  jsonResponse(false, null, 'กรุณาระบุเหตุผล', 422);
}
if (mb_strlen($reason) > 500) {
  jsonResponse(false, null, 'เหตุผลยาวเกิน 500 ตัวอักษร', 422);
}

$db = pdo();

try {
  $stmt = $db->prepare("
    INSERT INTO raid_cancel_reasons (room_id, reason, created_at)
    VALUES (:room_id, :reason, NOW())
  ");
  $stmt->execute([
    ':room_id' => $roomId,
    ':reason'  => $reason,
  ]);

  // อัปเดตสถานะห้องเป็น canceled (ถ้ายังไม่ canceled)
  if (strtolower((string)$room['status']) !== 'canceled') {
    $upd = $db->prepare("UPDATE raid_rooms SET status = 'canceled' WHERE id = ?");
    $upd->execute([$roomId]);
  }

  $id = (int)$db->lastInsertId();

  $data = [
    'id' => $id,
    'room_id' => $roomId,
    'reason' => $reason,
    'created_at' => date('Y-m-d H:i:s'),
  ];

  jsonResponse(true, $data, 'บันทึกเหตุผลสำเร็จ');

} catch (Throwable $e) {
  jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
}
