<?php
// api/user/set_username.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php'; // ต้องมี pdo(), authGuard(), jsonResponse()

header('Content-Type: application/json; charset=UTF-8');

try {
  // ตรวจ method
  if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PATCH'], true)) {
    jsonResponse(false, null, 'Method not allowed', 405);
  }

  // auth จาก JWT → ได้ $userId
  $userId = authGuard();               // ต้องอ่านจาก Authorization: Bearer <JWT>
  $db = pdo();
  $db->exec("SET time_zone = '+00:00'");

  // รับค่า
  $input = json_decode(file_get_contents('php://input'), true);
  if (!is_array($input)) $input = [];
  $username = strtolower(trim((string)($input['username'] ?? '')));

  // ตรวจรูปแบบ
  if (!preg_match('/^[a-z0-9_]{3,20}$/', $username)) {
    jsonResponse(false, null, 'รูปแบบ username ไม่ถูกต้อง (ต้องเป็น a-z, 0-9, _ ความยาว 3–20 ตัว)', 422);
  }

  // ตรวจว่าผู้ใช้มีอยู่จริง (กันกรณี JWT ผิดปกติ)
  $st = $db->prepare("SELECT id FROM users WHERE id=:id LIMIT 1");
  $st->execute([':id' => $userId]);
  if (!$st->fetchColumn()) {
    jsonResponse(false, null, 'ไม่พบบัญชีผู้ใช้', 404);
  }

  // ห้ามซ้ำกับคนอื่น
  $dup = $db->prepare("SELECT 1 FROM users WHERE username=:u AND id<>:id LIMIT 1");
  $dup->execute([':u' => $username, ':id' => $userId]);
  if ($dup->fetchColumn()) {
    jsonResponse(false, null, 'username นี้ถูกใช้แล้ว', 409);
  }

  // อัปเดต
  $upd = $db->prepare("UPDATE users SET username=:u WHERE id=:id");
  $upd->execute([':u' => $username, ':id' => $userId]);

  // (ออปชัน) โหลดข้อมูลย่อกลับไปให้แอพ
  $me = $db->prepare("SELECT id, email, username, avatar, friend_code, level, role, status FROM users WHERE id=:id");
  $me->execute([':id' => $userId]);
  $user = $me->fetch(PDO::FETCH_ASSOC);

  jsonResponse(true, ['user' => $user], 'บันทึกสำเร็จ', 200);

} catch (Throwable $e) {
  // ถ้ามี jsonResponse อยู่แล้วจะรวม error format เดิมของคุณ
  jsonResponse(false, null, 'ERR500: ' . $e->getMessage(), 500);
}
