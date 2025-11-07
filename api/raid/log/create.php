<?php
// api/raid/log.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

// ถ้าต้องการให้เฉพาะผู้ล็อกอินใช้งาน ให้เปิดบรรทัดนี้
$userIdFromToken = authGuard(); // คืน user_id ของผู้เรียกใช้งาน (ถ้าอยาก override ให้ใช้ค่าที่ส่งมาก็ได้ แต่ควรตรวจสอบสิทธิ์ด้วย)

// รับ JSON
$input = getJsonInput(); // ควรคืน array

$room_id    = isset($input['room_id']) ? (int)$input['room_id'] : 0;
$type       = trim((string)($input['type'] ?? ''));
$target     = trim((string)($input['target'] ?? ''));
$description= isset($input['description']) ? trim((string)$input['description']) : null;

// --- Validation พื้นฐาน ---
if ($room_id <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}
if ($type === '') {
  jsonResponse(false, null, 'type ห้ามว่าง', 422);
}
// กัน type ยาวเกิน schema
if (mb_strlen($type) > 50) {
  jsonResponse(false, null, 'type ยาวเกิน 50 ตัวอักษร', 422);
}

// (ทางเลือก) จำกัดค่า type ที่อนุญาต
$allowedTypes = ['join', 'leave', 'invite', 'review', 'create', 'cancel'];
if (!in_array($type, $allowedTypes, true)) {
  // ถ้าอยากปล่อยอิสระ ให้คอมเมนต์บรรทัดนี้
  jsonResponse(false, null, 'type ไม่อยู่ในรูปแบบที่อนุญาต', 422);
}

try {
  $db = pdo();

  $stmt = $db->prepare("
    INSERT INTO raid_rooms_log (room_id, user_id, type, target, description)
    VALUES (:room_id, :user_id, :type, :target, :description)
  ");

  $stmt->execute([
    ':room_id'     => $room_id,
    ':user_id'     => $userIdFromToken,
    ':type'        => $type,
    ':target'      => $target,
    ':description' => $description !== '' ? $description : null,
  ]);

  $newId = (int)$db->lastInsertId();

  jsonResponse(true, [
    'id'          => $newId,
    'room_id'     => $room_id,
    'user_id'     => $userIdFromToken,
    'type'        => $type,
    'target'      => $target,
    'description' => $description,
  ], 'บันทึก log สำเร็จ', 201);

} catch (Throwable $e) {
  // ส่งข้อความ error แบบปลอดภัย
  jsonResponse(false, null, 'ส่งไม่สำเร็จ (server error)', 500);
}
