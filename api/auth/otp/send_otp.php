<?php
// api/auth/otp/send_otp.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// นำเข้า PHPMailer
require_once __DIR__ . '/../../vendor/autoload.php'; // ตรวจสอบเส้นทางให้ถูกต้อง

// ===== รับพารามิเตอร์ =====
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$user_id = isset($input['user_id']) ? (int)$input['user_id'] : 0;
$type    = isset($input['type']) ? trim((string)$input['type']) : '';

if (!$user_id || $type === '') {
  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'กรุณาระบุ user_id และ type (register|reset)']);
  exit;
}
if (!in_array($type, ['register','reset'], true)) {
  http_response_code(422);
  echo json_encode(['success' => false, 'message' => 'type ไม่ถูกต้อง ต้องเป็น register หรือ reset']);
  exit;
}

// 2. สร้างรหัส OTP
$otp_code = rand(100000, 999999); // สร้างรหัส 6 หลัก
$expires_at = date('Y-m-d H:i:s', strtotime('+5 minutes')); // หมดอายุใน 5 นาที

$db = pdo(); // เชื่อมต่อฐานข้อมูล

// 3. จัดการฐานข้อมูล (ตัวอย่างการเชื่อมต่อ PDO)
try {
      // ===== หาอีเมลของผู้ใช้ =====
    $st = $db->prepare("SELECT email FROM users WHERE id = :uid LIMIT 1");
    $st->execute([':uid' => $user_id]);
    $user = $st->fetch();
    if (!$user || empty($user['email'])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'ไม่พบบัญชีผู้ใช้งานหรืออีเมลของผู้ใช้']);
        exit;
    }
    $email = $user['email'];

    // ===== ลบ OTP เก่าของ user_id + type =====
    $del = $db->prepare("DELETE FROM otp WHERE user_id = :uid AND type = :type");
    $del->execute([
        ':uid' => $user_id,
        ':type' => $type,
    ]);

    // ===== บันทึกลงตาราง otp =====
    $ins = $db->prepare("
        INSERT INTO otp (user_id, otp, type, created_at)
        VALUES (:uid, :otp, :type, NOW())
        ");
    $ins->execute([
        ':uid'  => $user_id,
        ':otp'  => $otp_code,
        ':type' => $type,
    ]);

    // 4. ส่งอีเมลด้วย PHPMailer
    $mail = new PHPMailer(true); // true enables exceptions
    
    // ตั้งค่า SMTP (แนะนำให้ใช้ SMTP ของผู้ให้บริการมืออาชีพ)
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com'; // ตัวอย่าง: Gmail SMTP
    $mail->SMTPAuth   = true;
    $mail->Username   = 'pogopartyth@gmail.com'; // อีเมลผู้ส่ง
    $mail->Password   = 'lmqa ufkb voon mgvm';      // รหัสผ่านสำหรับแอป
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

    $data = [
        "user_id" => $user_id,
        "email" => $email,
        "otp" => $otp_code,
    ];

    http_response_code(200);
    echo json_encode([
        'success' => true,
        "message" => "ส่งรหัส OTP เรียบร้อยแล้ว",
        "data" => $data,
        ]);

} catch (Exception $e) {
    // ถ้าส่งอีเมลล้มเหลว หรือมีปัญหา DB
    http_response_code(500);
    echo json_encode(["message" => "ไม่สามารถส่งรหัส OTP ได้: " . $e->getMessage()]);
}

?>