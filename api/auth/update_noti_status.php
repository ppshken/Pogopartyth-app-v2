<?php
// api/user/update_noti_status.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();
header('Content-Type: application/json; charset=UTF-8');

const DEBUG_MODE = false; // เปิด true เมื่อต้องการ log เพิ่ม

function dlog(string $m): void {
  if (!DEBUG_MODE) return;
  @file_put_contents(APP_ERROR_LOG, "[".date('c')."] update_noti_status: ".$m."\n", FILE_APPEND);
}

try {
  // อนุญาต POST/PATCH
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if (!in_array($method, ['POST', 'PATCH'], true)) {
    jsonResponse(false, null, 'Method not allowed', 405);
  }

  // ต้อง login
  $userId = authGuard();

  // รับ JSON body
  $raw   = file_get_contents('php://input');
  $input = json_decode((string)$raw, true);
  if (!is_array($input)) {
    jsonResponse(false, null, 'invalid json body', 400);
  }

  // รองรับค่าที่ส่งมาเป็น on/off (ไม่สนตัวพิมพ์) หรือ boolean
  $val = $input['noti_status'] ?? null;
  if (is_bool($val)) {
    $noti = $val ? 'on' : 'off';
  } else {
    $noti = strtolower(trim((string)$val));
  }

  if (!in_array($noti, ['on', 'off'], true)) {
    jsonResponse(false, null, 'noti_status must be "on" or "off"', 422);
  }

  $db = pdo();
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // (ตัวเลือก) ถ้าอยากปิดแบบเด็ดขาด ให้ล้าง device_token เมื่อ off
  $CLEAR_TOKEN_WHEN_OFF = false; // ← เปลี่ยนเป็น true ถ้าต้องการ

  if ($CLEAR_TOKEN_WHEN_OFF && $noti === 'off') {
    $sql = "UPDATE users
            SET noti_status = :ns, device_token = NULL, updated_at = NOW()
            WHERE id = :id";
    $stmt = $db->prepare($sql);
    $stmt->execute([':ns' => $noti, ':id' => $userId]);
  } else {
    $sql = "UPDATE users
            SET noti_status = :ns, updated_at = NOW()
            WHERE id = :id";
    $stmt = $db->prepare($sql);
    $stmt->execute([':ns' => $noti, ':id' => $userId]);
  }

  // อ่านค่าล่าสุดเพื่อตอบกลับ
  $sel = $db->prepare("SELECT id, email, username, avatar, noti_status FROM users WHERE id = :id LIMIT 1");
  $sel->execute([':id' => $userId]);
  $user = $sel->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    jsonResponse(false, null, 'user not found', 404);
  }

  jsonResponse(true, [
    'user' => [
      'id'          => (int)$user['id'],
      'email'       => (string)$user['email'],
      'username'    => $user['username'] ?? null,
      'avatar'      => $user['avatar'] ?? null,
      'noti_status' => $user['noti_status'] ?? 'on',
    ],
  ]);

} catch (Throwable $e) {
  dlog("EX: ".$e->getMessage()." @".$e->getFile().":".$e->getLine());
  jsonResponse(false, null, DEBUG_MODE ? ('server error: '.$e->getMessage()) : 'server error', 500);
}
