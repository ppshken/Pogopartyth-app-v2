<?php
// api/auth/forget_password.php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../vendor/autoload.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$input = getJsonInput();
$email = trim((string)($input['email'] ?? ''));

// 1) Validate
if ($email === '') {
  jsonResponse(false, null, 'กรุณากรอก email', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonResponse(false, null, 'รูปแบบอีเมลไม่ถูกต้อง', 422);
}

$db = pdo();

try {
  // 2) หา user ตามอีเมล
  $st = $db->prepare("
    SELECT id, email, setup_status
    FROM users
    WHERE email = :email
    LIMIT 1
  ");
  $st->execute([':email' => $email]);
  $user = $st->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    // ไม่บังซ่อนการมีอยู่ของบัญชีตามที่คุณขอ (แจ้งว่าไม่มีบัญชีนี้)
    jsonResponse(false, null, 'ยังไม่มีบัญชีผู้ใช้นี้', 404);
  }

  $userId = (int)$user['id'];
  $emailToSend = $user['email'];
  $isSetup = strtolower((string)$user['setup_status']) === 'yes';

  // 3) ถ้ายัง setup ไม่เสร็จ → ไม่ส่ง OTP แต่ตอบ eligible=false
  if (!$isSetup) {
    jsonResponse(true, [
      'eligible' => false,
      'user' => [
        'id'    => $userId,
        'email' => $emailToSend,
      ],
    ], 'บัญชีนี้ยังตั้งค่าไม่สมบูรณ์ (setup_status != yes)', 200);
  }

  // 4) ลบ OTP เก่าประเภท reset แล้วสร้างใหม่ (อายุ 5 นาที)
  $db->beginTransaction();

  $del = $db->prepare("
    DELETE FROM otp
    WHERE user_id = :uid AND type = 'reset'
  ");
  $del->execute([':uid' => $userId]);

  // สร้างรหัส 6 หลัก
  $otp_code = (string)random_int(100000, 999999);

  // แนะนำให้มีคอลัมน์ expires_at ในตาราง otp
  $ins = $db->prepare("
    INSERT INTO otp (user_id, otp, type, created_at)
    VALUES (:uid, :otp, 'reset', NOW() )
  ");
  $ins->execute([
    ':uid' => $userId,
    ':otp' => $otp_code,
  ]);

  $db->commit();

  // 5) ส่งอีเมล OTP
  try {
    // 6) ส่งอีเมล OTP
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'pogopartyth@gmail.com';         // TODO: .env
    $mail->Password   = 'lmqa ufkb voon mgvm';         // TODO: .env (App Password)
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom('YOUR_SENDER_EMAIL@gmail.com', 'PogopartyTH'); // TODO: .env
    $mail->addAddress($emailToSend);

    $mail->isHTML(true);
    $mail->Subject = 'OTP For Reset Password PogopartyTH';
    $mail->Body    = "<h1>รหัสยืนยันของคุณคือ: <b>{$otp_code}</b></h1><p>รหัสนี้จะหมดอายุใน 5 นาที</p>";
    $mail->AltBody = "รหัสยืนยันของคุณคือ: {$otp_code}. รหัสนี้จะหมดอายุใน 5 นาที";

    $mail->send();
  } catch (Exception $e) {
    // ถ้าส่งเมลไม่สำเร็จ ไม่ต้อง rollback OTP (เลือกตามนโยบาย)
    // logError($e);
    jsonResponse(false, null, 'ส่งอีเมลไม่สำเร็จ โปรดลองอีกครั้ง', 500);
  }

  // 6) ตอบกลับ
  jsonResponse(true, [
    'eligible' => true,
    'user' => [
      'id'    => $userId,
      'email' => $emailToSend,
    ],
  ], 'ส่งรหัสรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบอีเมล', 200);

} catch (Throwable $e) {
  // logError($e);
  if ($db && $db->inTransaction()) { $db->rollBack(); }
  jsonResponse(false, null, 'ดำเนินการไม่สำเร็จ', 500);
}
