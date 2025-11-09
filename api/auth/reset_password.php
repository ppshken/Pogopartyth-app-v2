<?php
// api/auth/reset_password.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$input    = getJsonInput();
$userId   = (int)($input['user_id'] ?? 0);
$password = (string)($input['password'] ?? '');

// --- Validate ---
if ($userId <= 0) {
  jsonResponse(false, null, 'user_id ไม่ถูกต้อง', 422);
}
if ($password === '') {
  jsonResponse(false, null, 'กรุณากรอกรหัสผ่าน', 422);
}
// กำหนด policy ขั้นต่ำ (ปรับได้)
if (mb_strlen($password) < 8) {
  jsonResponse(false, null, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', 422);
}

try {
  $db = pdo();

  // ตรวจว่ามีผู้ใช้งานจริง
  $st = $db->prepare("SELECT id FROM users WHERE id = :id LIMIT 1");
  $st->execute([':id' => $userId]);
  $exists = $st->fetchColumn();
  if (!$exists) {
    jsonResponse(false, null, 'ไม่พบบัญชีผู้ใช้งาน', 404);
  }

  // แฮชรหัสผ่าน
  $hash = password_hash($password, PASSWORD_DEFAULT);
  if ($hash === false) {
    jsonResponse(false, null, 'ไม่สามารถแฮชรหัสผ่านได้', 500);
  }

  $db->beginTransaction();

  // อัปเดตรหัสผ่าน
  $up = $db->prepare("
    UPDATE users
    SET password_hash = :hash
    WHERE id = :id
    LIMIT 1
  ");
  $up->execute([':hash' => $hash, ':id' => $userId]);

  // (แนะนำ) ยกเลิก/ลบ OTP reset ที่ยังไม่ถูกใช้ (ถ้ามีระบบ OTP)
  // $delOtp = $db->prepare("DELETE FROM otp WHERE user_id = :uid AND type = 'reset'");
  // $delOtp->execute([':uid' => $userId]);

  // (ตัวเลือก) ทำให้โทเค็นเดิมใช้ไม่ได้ เช่น เพิ่ม token_version แล้วเช็คใน JWT
  // $db->prepare("UPDATE users SET token_version = token_version + 1 WHERE id = :id")->execute([':id' => $userId]);

  $db->commit();

  jsonResponse(true, [
    'user' => ['id' => $userId],
  ], 'รีเซ็ตรหัสผ่านสำเร็จ', 200);

} catch (Throwable $e) {
  // logError($e); // แนะนำให้ทำ log
  if (isset($db) && $db->inTransaction()) { $db->rollBack(); }
  jsonResponse(false, null, 'รีเซ็ตรหัสผ่านไม่สำเร็จ', 500);
}
