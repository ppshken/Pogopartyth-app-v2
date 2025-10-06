<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL); ini_set('display_errors','1'); ini_set('log_errors','1');
ini_set('error_log', __DIR__.'/../../storage/php-error.log');

require __DIR__.'/../vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$to = trim($input['to'] ?? ''); $subject = trim($input['subject'] ?? '');
$html = (string)($input['html'] ?? ''); $text = (string)($input['text'] ?? '');
if (!$to || !$subject || (!$html && !$text)) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'missing fields']); exit; }

// ตั้งค่า sender
$gmailUser = 'Kensaohin@gmail.com';
$appPass   = preg_replace('/\s+/u','', 'pevz zutv kflu mzxq'); // ล้างช่องว่างทุกชนิด

try {
  $m = new PHPMailer(true);
  // เปิดตอนดีบั๊ก:
  // $m->SMTPDebug = 2; $m->Debugoutput = 'error_log';

  $m->isSMTP();
  $m->Host       = gethostbyname('smtp.gmail.com'); // บังคับ IPv4
  $m->SMTPAuth   = true;
  $m->Username   = $gmailUser;
  $m->Password   = $appPass;
  $m->Timeout    = 15;

  // เริ่มด้วย SMTPS:465 ถ้าเน็ตผ่านพอร์ตนี้ได้มักนิ่ง
  $m->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
  $m->Port       = 587;

  $m->setFrom($gmailUser, 'PogopartyTH');
  $m->addAddress($to);
  $m->isHTML((bool)$html);
  $m->Subject = $subject;
  $m->Body    = $html ?: $text;
  if ($html && $text) $m->AltBody = $text;

  $m->send();
  echo json_encode(['ok'=>true]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false,'error'=>$m->ErrorInfo]);
}
