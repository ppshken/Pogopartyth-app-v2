<?php
// api/auth/register.php
declare(strict_types=1);

use BcMath\Number;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../vendor/autoload.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$input = getJsonInput();
$email = trim($input['email'] ?? '');

// 1) Validate
if ($email === '') {
  jsonResponse(false, null, 'กรุณากรอก email', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonResponse(false, null, 'รูปแบบอีเมลไม่ถูกต้อง', 422);
}

$db = pdo();

// helper
function mb_first_upper(string $s, string $enc = 'UTF-8'): string {
  if ($s === '') return $s;
  return mb_strtoupper(mb_substr($s, 0, 1, $enc), $enc);
}

$avatar_result = mb_first_upper($email);
$avatar_result_image = "https://ui-avatars.com/api/?name=" . urlencode($avatar_result) . "&background=random&size=256&bold=true";

try {
  // 2) ตรวจว่ามีผู้ใช้อยู่แล้วไหม + สถานะอะไร
  $check = $db->prepare("SELECT id, email, status FROM users WHERE email = :email LIMIT 1");
  $check->execute([':email' => $email]);
  $exist = $check->fetch(PDO::FETCH_ASSOC);

  if ($exist) {
    // เคส: มี user แล้ว
    if (is_null($exist['status'])) {
      // สถานะยังไม่ active (เช่น สมัครไว้แต่ยังไม่ยืนยัน)
      // ตามเงื่อนไข: ไม่ต้อง insert / ไม่ต้องส่งเมล — ตอบ success=true
      jsonResponse(true, [
        'user' => [
          'id'     => (int)$exist['id'],
          'email'  => $exist['email'],
          'status' => null,
        ],
        'type' => false,
      ], 'มีบัญชีที่ยังไม่ยืนยันอยู่แล้ว', 200);
    } else if (strtolower((string)$exist['status']) === 'active') {
      // มีบัญชีใช้งานแล้ว
      jsonResponse(false, null, 'อีเมลนี้มีบัญชีอยู่แล้ว', 409);
    } else {
      // เผื่อมีสถานะอื่น ๆ (เช่น suspended เป็นต้น) — ปรับตามธุรกิจ
      jsonResponse(false, null, 'ไม่สามารถสมัครด้วยอีเมลนี้ได้ (สถานะบัญชีไม่อนุญาต)', 409);
    }
  }

  // 3) ยังไม่มีผู้ใช้ → เพิ่มบัญชีใหม่
  $stmt = $db->prepare("
    INSERT INTO users (email, avatar, status, created_at)
    VALUES (:email, :avatar, NULL, NOW())
  ");
  $stmt->execute([
    ':email'  => $email,
    ':avatar' => $avatar_result_image ?: null,
  ]);

  $userId   = (int)$db->lastInsertId();
  $otp_code = rand(100000, 999999);
  $token    = makeToken($userId, 86400 * 7); // login ให้อัตโนมัติ 7 วัน (ถ้าต้องการ)

  // 4) ยืนยัน email จาก DB อีกรอบ (กันกรณี edge)
  $st = $db->prepare("SELECT email FROM users WHERE id = :uid LIMIT 1");
  $st->execute([':uid' => $userId]);
  $user = $st->fetch(PDO::FETCH_ASSOC);
  if (!$user || empty($user['email'])) {
    jsonResponse(false, null, 'ไม่พบบัญชีผู้ใช้งานหรืออีเมลของผู้ใช้', 404);
  }
  $emailToSend = $user['email'];

  // 5) ลบ OTP เก่า (type = register) แล้วเพิ่มใหม่
  $del = $db->prepare("DELETE FROM otp WHERE user_id = :uid AND type = 'register'");
  $del->execute([':uid' => $userId]);

  $ins = $db->prepare("
    INSERT INTO otp (user_id, otp, type, created_at)
    VALUES (:uid, :otp, 'register', NOW())
  ");
  $ins->execute([
    ':uid' => $userId,
    ':otp' => $otp_code,
  ]);

  // 6) ส่งอีเมล OTP
  $mail = new PHPMailer(true);
  $mail->isSMTP();
  $mail->Host       = 'smtp.gmail.com';
  $mail->SMTPAuth   = true;
  $mail->Username   = 'kensaohin@gmail.com';         // TODO: .env
  $mail->Password   = 'hsfy uzhb cwmk eazs';         // TODO: .env (App Password)
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
  $mail->Port       = 587;

  $mail->setFrom('YOUR_SENDER_EMAIL@gmail.com', 'PogopartyTH'); // TODO: .env
  $mail->addAddress($emailToSend);

  $mail->isHTML(true);
  $mail->Subject = 'OTP For Register PogopartyTH';
  $mail->Body    = "<h1>รหัสยืนยันของคุณคือ: <b>{$otp_code}</b></h1><p>รหัสนี้จะหมดอายุใน 5 นาที</p>";
  $mail->AltBody = "รหัสยืนยันของคุณคือ: {$otp_code}. รหัสนี้จะหมดอายุใน 5 นาที";

  $mail->send();

  jsonResponse(true, [
    'user' => [
      'id'     => $userId,
      'email'  => $emailToSend,
      'avatar' => $avatar_result_image ?: null,
    ],
    'type' => true,
  ], 'สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยัน', 201);

} catch (Throwable $e) {
  // logError($e); // แนะนำทำ log จริง
  jsonResponse(false, null, 'สมัครสมาชิกไม่สำเร็จ', 500);
}
