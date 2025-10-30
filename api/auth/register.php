<?php
// api/auth/register.php
declare(strict_types=1);

use BcMath\Number;

require_once __DIR__ . '/../helpers.php';
cors();

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// นำเข้า PHPMailer
require_once __DIR__ . '/../vendor/autoload.php'; // ตรวจสอบเส้นทางให้ถูกต้อง

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$input    = getJsonInput();
$email    = trim($input['email']    ?? '');

// 1) Validate เบื้องต้น
if (!$email) {
  jsonResponse(false, null, 'กรุณากรอก email', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonResponse(false, null, 'รูปแบบอีเมลไม่ถูกต้อง', 422);
}

$db = pdo();

// 2) ตรวจซ้ำ email/username
$check = $db->prepare("SELECT 1 FROM users WHERE email = :email LIMIT 1");
$check->execute([':email' => $email]);
if ($check->fetch()) {
  jsonResponse(false, null, 'อีเมลหรือชื่อผู้ใช้ถูกใช้งานแล้ว', 409);
}

function mb_first_upper(string $s, string $enc = 'UTF-8'): string {
    if ($s === '') return $s;
    return mb_strtoupper(mb_substr($s, 0, 1, $enc), $enc);
}

$avatar_result = mb_first_upper($email);
$avatar_result_image = "https://ui-avatars.com/api/?name=" . urlencode($avatar_result) . "&background=random&size=256&bold=true";

// 3) สร้างบัญชี
try {
  $stmt = $db->prepare("
    INSERT INTO users (email, avatar)
    VALUES (:email, :avatar)
  ");
  $stmt->execute([
    ':email'     => $email,
    ':avatar'    => $avatar_result_image ?: null,
  ]);

  $userId = (int)$db->lastInsertId();
  $otp_code = rand(100000, 999999);
  $token  = makeToken($userId, 86400 * 7); // login ให้อัตโนมัติ 7 วัน

  // 4) เช็ค email จาก userId
  $st = $db->prepare("SELECT email FROM users WHERE id = :uid LIMIT 1");
  $st->execute([':uid' => $userId]);
  $user = $st->fetch();
  if (!$user || empty($user['email'])) {
      http_response_code(404);
      echo json_encode(['success' => false, 'message' => 'ไม่พบบัญชีผู้ใช้งานหรืออีเมลของผู้ใช้']);
      exit;
  }
  $email = $user['email'];

  // ===== ลบ OTP เก่าของ user_id + type =====
  $del = $db->prepare("DELETE FROM otp WHERE user_id = :uid AND type = 'register'");
  $del->execute([':uid' => $userId,]);

  // ===== บันทึกลงตาราง otp =====
  $ins = $db->prepare("
      INSERT INTO otp (user_id, otp, type, created_at)
      VALUES (:uid, :otp, 'register', NOW())
      ");
  $ins->execute([
      ':uid'  => $userId,
      ':otp'  => $otp_code,
  ]);

  // =====  ส่งอีเมลด้วย PHPMailer =====
  $mail = new PHPMailer(true); // true enables exceptions
  
  // ตั้งค่า SMTP (แนะนำให้ใช้ SMTP ของผู้ให้บริการมืออาชีพ)
  $mail->isSMTP();
  $mail->Host       = 'smtp.gmail.com'; // ตัวอย่าง: Gmail SMTP
  $mail->SMTPAuth   = true;
  $mail->Username   = 'kensaohin@gmail.com'; // อีเมลผู้ส่ง
  $mail->Password   = 'hsfy uzhb cwmk eazs';      // รหัสผ่านสำหรับแอป
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
  $mail->Port       = 587;

  // ตั้งค่าผู้ส่งและผู้รับ
  $mail->setFrom('YOUR_SENDER_EMAIL@gmail.com', 'PogopartyTH');
  $mail->addAddress($email);

  // เนื้อหาอีเมล
  $mail->isHTML(true);
  $mail->Subject = 'OTP For Register PogopartyTH';
  $mail->Body    = "<h1>รหัสยืนยันของคุณคือ: <b>{$otp_code}</b></h1><p>รหัสนี้จะหมดอายุใน 5 นาที</p>";
  $mail->AltBody = "รหัสยืนยันของคุณคือ: {$otp_code}. รหัสนี้จะหมดอายุใน 5 นาที";

  $mail->send();

  jsonResponse(true, [
    'user' => [
      'id'        => $userId,
      'email'     => $email,
      'avatar'    => $avatar ?: null,
    ],
  ], 'สมัครสมาชิกสำเร็จ', 201);

} catch (Throwable $e) {
  // ถ้ามี unique index ที่ DB ก็อาจโยน Duplicate error ได้ ตรงนี้กันไว้
  jsonResponse(false, null, 'สมัครสมาชิกไม่สำเร็จ', 500);
}
