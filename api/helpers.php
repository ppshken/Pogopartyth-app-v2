<?php
// api/helpers.php
declare(strict_types=1);

// === storage & log paths (กัน mkdir(): File exists) ===
$storageRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
$logDir      = $storageRoot . DIRECTORY_SEPARATOR . 'logs';

if (!is_dir($storageRoot)) {
  if (!@mkdir($storageRoot, 0777, true) && !is_dir($storageRoot)) {
    throw new RuntimeException("Failed to create storage dir: {$storageRoot}");
  }
}
if (!is_dir($logDir)) {
  if (!@mkdir($logDir, 0777, true) && !is_dir($logDir)) {
    throw new RuntimeException("Failed to create log dir: {$logDir}");
  }
}

// ค่าคงที่ให้ไฟล์อื่นเรียกใช้
if (!defined('APP_STORAGE'))   define('APP_STORAGE', $storageRoot);
if (!defined('APP_LOG_DIR'))   define('APP_LOG_DIR', $logDir);
if (!defined('APP_ERROR_LOG')) define('APP_ERROR_LOG', $logDir . DIRECTORY_SEPARATOR . 'php-error.log');

// ตั้งค่า error_log กลาง (ไฟล์อื่น ๆ จะ override ได้ภายหลัง)
ini_set('log_errors', '1');
ini_set('error_log', APP_ERROR_LOG);

// --- เพิ่ม: ตั้ง timezone ให้เวลาถูกต้องตามไทย ---
date_default_timezone_set('Asia/Bangkok');

// --- แนะนำ: ปิดการแสดง error เป็น HTML และ log ลงไฟล์แทน (โปรดสร้างโฟลเดอร์ storage/) ---
ini_set('display_errors', '0');         // ไม่พ่น Warning/Notice ปน JSON
ini_set('log_errors', '1');
@mkdir(__DIR__ . '/../storage', 0777, true);
ini_set('error_log', __DIR__ . '/../storage/php-error.log');

require_once __DIR__ . '/db.php';

function cors(): void {
  header('Content-Type: application/json; charset=utf-8');
  header('Access-Control-Allow-Origin: ' . (getenv('CORS_ORIGIN') ?: '*'));
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
  // --- เพิ่ม: รองรับวิธีอื่น ๆ เผื่ออนาคตต้องใช้ ---
  header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
  header('Access-Control-Max-Age: 86400'); // cache preflight

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    // กันเศษ output ค้าง
    while (ob_get_level()) { ob_end_clean(); }
    exit;
  }
}

function jsonResponse(bool $success, $data = null, string $message = '', int $code = 200): void {
  http_response_code($code);
  // --- สำคัญ: ล้าง buffer ทั้งหมดก่อน เพื่อกัน Warning/ช่องว่างปน JSON ---
  while (ob_get_level()) { ob_end_clean(); }

  echo json_encode([
    'success' => $success,
    'message' => $message,
    'data'    => $data,
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

function getJsonInput(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

/** Simple HMAC token (ไม่ใช่ JWT มาตรฐาน) */
function makeToken(int $userId, int $ttlSeconds = 7*86400): string {
  $secret = getenv('APP_KEY') ?: 'change_me';
  $payload = [
    'user_id' => $userId,
    'exp'     => time() + $ttlSeconds,
  ];
  $b64 = base64_encode(json_encode($payload));
  $sig = hash_hmac('sha256', $b64, $secret);
  return $b64 . '.' . $sig;
}

function verifyToken(?string $token): ?array {
  if (!$token) return null;
  $secret = getenv('APP_KEY') ?: 'change_me';
  $parts = explode('.', $token);
  if (count($parts) !== 2) return null;
  [$b64, $sig] = $parts;
  $calc = hash_hmac('sha256', $b64, $secret);
  if (!hash_equals($calc, $sig)) return null;
  $payload = json_decode(base64_decode($b64), true);
  if (!is_array($payload) || empty($payload['user_id']) || empty($payload['exp'])) return null;
  if ($payload['exp'] < time()) return null;
  return $payload;
}

function readAuthHeader(): ?string {
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
  if (!$hdr && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $hdr = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  }
  if (!$hdr && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    foreach ($headers as $k => $v) {
      if (strcasecmp($k, 'Authorization') === 0) { $hdr = $v; break; }
    }
  }
  return $hdr ? trim($hdr) : null;
}

function authGuard(): int {
  $hdr = readAuthHeader();
  $token = null;

  if ($hdr && stripos($hdr, 'Bearer ') === 0) {
    $token = trim(substr($hdr, 7));
  }

  // Fallback debug ผ่าน query (แนะนำเอาออกเมื่อขึ้น Prod)
  if (!$token && !empty($_GET['token'])) {
    $token = trim((string)$_GET['token']);
  }

  $payload = verifyToken($token);
  if (!$payload) {
    jsonResponse(false, null, 'Unauthorized', 401);
  }
  return (int)$payload['user_id'];
}

function paginateParams(): array {
  $page = max(1, (int)($_GET['page'] ?? 1));
  $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
  $offset = ($page - 1) * $limit;
  return [$page, $limit, $offset];
}

function now(): string {
  return date('Y-m-d H:i:s');
}
