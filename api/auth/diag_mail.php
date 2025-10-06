<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../../storage/php-error.log');

$resp = [
  'php' => PHP_VERSION,
  'cwd' => __DIR__,
  'vendor_autoload_exists' => false,
  'phpmailer_class_loadable' => false,
  'dns_smtp_gmail' => null,
  'can_connect_465' => null,
  'can_connect_587' => null,
  'last_error' => null,
];

function can_connect($host, $port, $timeout = 8) {
  $errno = 0; $errstr = '';
  $fp = @fsockopen($host, $port, $errno, $errstr, $timeout);
  if ($fp) { fclose($fp); return true; }
  return "$errno $errstr";
}

// 1) autoload path (ปรับ ../ หรือ ../../ ให้ตรงตำแหน่งไฟล์จริงของคุณ)
$autoload = __DIR__ . '/../vendor/autoload.php';
$resp['vendor_autoload_exists'] = file_exists($autoload);

try {
  require $autoload;
  // 2) class load
  $resp['phpmailer_class_loadable'] = class_exists(\PHPMailer\PHPMailer\PHPMailer::class);
} catch (Throwable $e) {
  $resp['last_error'] = 'autoload_fail: '.$e->getMessage();
  echo json_encode($resp, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); exit;
}

// 3) DNS
$resolved = @gethostbyname('smtp.gmail.com');
$resp['dns_smtp_gmail'] = $resolved ?: 'resolve_failed';

// 4) ทดสอบการเชื่อมต่อพอร์ต (network/firewall)
$resp['can_connect_465'] = can_connect($resolved ?: 'smtp.gmail.com', 465);
$resp['can_connect_587'] = can_connect($resolved ?: 'smtp.gmail.com', 587);

// 5) สรุปแนะนำเบื้องต้น
if ($resp['vendor_autoload_exists'] !== true) {
  $resp['hint'] = "ไม่พบ vendor/autoload.php → รัน: composer require phpmailer/phpmailer และเช็ก path ../../";
} elseif ($resp['phpmailer_class_loadable'] !== true) {
  $resp['hint'] = "PHPMailer โหลดไม่ขึ้น → ตรวจ composer, autoload path";
} elseif ($resp['can_connect_465'] !== true && $resp['can_connect_587'] !== true) {
  $resp['hint'] = "ต่อออก smtp.gmail.com ไม่ได้ (465/587) → เครือข่าย/ไฟร์วอลล์บล็อก ลอง hotspot/VPN หรือใช้ SMTP ของโฮสต์";
} else {
  $resp['hint'] = "autoload/network ผ่านแล้ว → ถ้ายัง 500 ให้เปิด \$mail->SMTPDebug=2 ดูข้อความ auth/ssl";
}

echo json_encode($resp, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
