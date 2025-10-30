<?php
// api/auth/otp/verify.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// นำเข้า PHPMailer
require_once __DIR__ . '/../../vendor/autoload.php'; // ตรวจสอบเส้นทางให้ถูกต้อง

// ===== รับพารามิเตอร์ =====
$input   = json_decode(file_get_contents('php://input'), true) ?: [];
$user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
$type    = isset($input['type']) ? trim((string)$input['type']) : '';
$otpIn   = isset($input['otp']) ? trim((string)$input['otp']) : '';

if (!$user_id || $type === '' || $otpIn === '') {
  http_response_code(400);
  echo json_encode(['success' => false, 'code' => 'BAD_REQUEST', 'message' => 'กรุณาระบุ user_id, type และ otp']);
  exit;
}
if (!in_array($type, ['register','reset'], true)) {
  http_response_code(422);
  echo json_encode(['success' => false, 'code' => 'INVALID_TYPE', 'message' => 'type ต้องเป็น register หรือ reset']);
  exit;
}

$db = pdo(); // เชื่อมต่อฐานข้อมูล

try {

  // เนื่องจากตอน "ส่ง OTP" คุณลบของเก่าก่อน insert ใหม่อยู่แล้ว
  // ที่นี่ดึงตัวล่าสุดเผื่อมีหลายแถวโดยบังเอิญ
  $stmt = $db->prepare("
    SELECT id, otp, created_at
    FROM otp
    WHERE user_id = :uid AND type = :type
    ORDER BY created_at DESC
    LIMIT 1
  ");
  $stmt->execute([':uid' => $user_id, ':type' => $type]);
  $row = $stmt->fetch();

  if (!$row) {
    http_response_code(404);
    echo json_encode(['success' => false, 'code' => 'NOT_FOUND', 'message' => 'ไม่มีคำขอ OTP สำหรับผู้ใช้นี้']);
    exit;
  }

  // เช็คอายุรหัส
  $createdAt = new DateTime($row['created_at']);
  $now       = new DateTime('now');
  $diffMin   = (int) floor(($now->getTimestamp() - $createdAt->getTimestamp()) / 60);

  if ($diffMin > $VALID_MINUTES) {
    // รหัสหมดอายุ → ลบทิ้ง
    $del = $db->prepare("UPDATE otp SET status = 'expire' WHERE id = :id");
    $del->execute([':id' => $row['id']]);

    http_response_code(410);
    echo json_encode(['success' => false, 'code' => 'EXPIRED', 'message' => 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่']);
    exit;
  }

  // เทียบรหัส
  if (hash_equals((string)$row['otp'], (string)$otpIn) === false) {
    // ไม่ตรง (ไม่ลบ ให้ผู้ใช้ลองใหม่ภายในเวลาที่กำหนด)
    http_response_code(401);
    echo json_encode(['success' => false, 'code' => 'INVALID_OTP', 'message' => 'รหัสไม่ถูกต้อง']);
    exit;
  }

  // อัพเดทสถานะ user > status = active
  $us = $db->prepare("UPDATE users SET status = 'active' WHERE id = :user_id");
  $us->execute(['user_id' => $user_id]);

  // ออก Token
  $token  = makeToken($user_id, 86400 * 7);

  // ถ้าตรง ลบ otp เก่าออก
  $del = $db->prepare("DELETE FROM otp WHERE id = :id");
  $del->execute([':id' => $row['id']]);

  
  $users = [
    'id'  => $user_id,
  ];

  $data = [
    'user'    => $users,
    'token'   => $token,
  ];

  echo json_encode([
    'success' => true,
    'message' => 'ยืนยันรหัสสำเร็จ',
    'data'    => $data,
  ]);

} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'code' => 'DB_ERROR', 'message' => $e->getMessage()]);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'code' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
