<?php
// api/auth/google_login.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();
header('Content-Type: application/json; charset=UTF-8');

// เปิดโหมดดีบักชั่วคราว (โปรดปรับเป็น false เมื่อขึ้นจริง)
const DEBUG_MODE = true;

// ช่วย log ลงไฟล์เดียวกับ helpers.php
function dlog(string $msg): void {
  @file_put_contents(APP_ERROR_LOG, "[".date('c')."] google_login: ".$msg."\n", FILE_APPEND);
}

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed', 405);
  }

  // รับ JSON body อย่างปลอดภัย
  $inputRaw = file_get_contents('php://input');
  if (DEBUG_MODE) dlog("RAW BODY=".substr((string)$inputRaw, 0, 200));
  $input = json_decode((string)$inputRaw, true);
  if (!is_array($input)) {
    jsonResponse(false, null, 'invalid json body', 400);
  }

  $idToken = trim((string)($input['id_token'] ?? ''));
  if ($idToken === '') {
    jsonResponse(false, null, 'missing id_token', 422);
  }

  $device_token = trim((string)($input['device_token'] ?? ''));

  // === ดึง payload จาก Google tokeninfo ด้วย 2 วิธี (file_get_contents -> cURL) ===
  $payload = null;
  $verifyUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);

  // 1) file_get_contents
  $raw = @file_get_contents($verifyUrl);
  if ($raw !== false) {
    $payload = json_decode($raw, true);
  } else {
    // 2) cURL fallback (บางเครื่องปิด allow_url_fopen หรือ SSL)
    if (DEBUG_MODE) dlog("file_get_contents FAILED: $verifyUrl");
    if (function_exists('curl_init')) {
      $ch = curl_init($verifyUrl);
      curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
      ]);
      $raw = curl_exec($ch);
      if ($raw === false) {
        if (DEBUG_MODE) dlog('curl error: '.curl_error($ch));
      }
      curl_close($ch);
      if ($raw !== false) {
        $payload = json_decode($raw, true);
      }
    }
  }

  if (DEBUG_MODE) dlog("GOOGLE RAW=".substr((string)($raw ?? ''), 0, 300));

  if (!$payload || !isset($payload['email'])) {
    jsonResponse(false, null, 'invalid token', 401);
  }

  // ---- ตรวจค่าเบื้องต้น (รวบรัด) ----
  $iss = $payload['iss'] ?? '';
  if (!in_array($iss, ['https://accounts.google.com','accounts.google.com'], true)) {
    jsonResponse(false, null, 'iss invalid', 401);
  }

  // (เลือกอย่างหนึ่ง)
  // A) ล็อก aud = web client เดียว (จาก payload ที่คุณส่งมา)
  $WEB_CLIENT_ID = '926863512286-q7nio8ioecntg5o54kpjla06qq03eejo.apps.googleusercontent.com';

  // B) หรือใช้ allow-list หลายตัว (คอมเมนต์ A ทิ้งก่อน)
  // $allowedAuds = [
  //   '926863512286-q7nio8ioecntg5o54kpjla06qq03eejo.apps.googleusercontent.com', // web
  //   '926863512286-c2s6shb73ot66n55md241oqt0btslqko.apps.googleusercontent.com', // iOS
  //   '926863512286-tmavj5behf6g3j8bhggp11ajitiovlh9.apps.googleusercontent.com', // Android
  // ];
  // if (!in_array($payload['aud'] ?? '', $allowedAuds, true)) {
  //   jsonResponse(false, null, 'aud mismatch', 401);
  // }

  // ใช้แบบ A:
  if (($payload['aud'] ?? '') !== $WEB_CLIENT_ID) {
    jsonResponse(false, null, 'aud mismatch', 401);
  }

  $exp = (int)($payload['exp'] ?? 0);
  if ($exp <= time()) {
    jsonResponse(false, null, 'token expired', 401);
  }

  $email    = strtolower(trim((string)($payload['email'] ?? '')));
  $verified = filter_var($payload['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
  $sub      = trim((string)($payload['sub'] ?? ''));
  $avatar   = trim((string)($payload['picture'] ?? '')) ?: null;

  if (!$email || !$verified) {
    jsonResponse(false, null, 'email invalid', 401);
  }

  // ---- ต่อฐานข้อมูล ----
  $db = pdo(); // ถ้า pdo() error จะโยน exception มาเข้า catch ด้านล่าง
  // ให้ PDO โยน exception เสมอ (กัน 500 เงียบ)
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // ตรวจว่ามีคอลัมน์ google_sub หรือยัง (กันเคสคอลัมน์หาย)
  // หมายเหตุ: ใน production ตัดบล็อกนี้ออกได้ เพื่อประสิทธิภาพ
  // try { $db->query("SELECT google_sub FROM users LIMIT 1"); } catch (Throwable $e) { ... }

  $stmt = $db->prepare("SELECT * FROM users WHERE google_sub = :sub OR email = :email LIMIT 1");
  $stmt->execute([':sub' => $sub, ':email' => $email]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  $isNew = false;
  $isSetup = false;

  if (!$user) {
    $ins = $db->prepare("
      INSERT INTO users (email, avatar, device_token, google_sub, status, created_at)
      VALUES (:email, :avatar, :device_token, :sub, 'active', NOW())
    ");
    $ins->execute([
      ':email'    => $email,
      ':avatar'   => $avatar,
      ':device_token' => $device_token,
      ':sub'      => $sub,
    ]);
    $userId = (int)$db->lastInsertId();

    $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    $isNew = true;
  }

  // --- ออก token ของระบบคุณ ---
  if (!function_exists('issueYourJWT')) {
    // กันพังขณะทดสอบ: ถ้าไม่มีฟังก์ชันนี้ ใช้โทเคน HMAC ชั่วคราว
    if (DEBUG_MODE) dlog("issueYourJWT() not found, fallback to makeToken()");
    $jwt = makeToken((int)$user['id']);
  } else {
    $jwt = issueYourJWT(['uid' => (int)$user['id'], 'email' => $email]);
  }

  jsonResponse(true, [
    'token' => $jwt,
    'user'  => [
      'id'       => (int)$user['id'],
      'email'    => $email,
      'avatar'   => $user['avatar'] ?? null,
    ],
    'is_new' => $isNew,
  ]);

} catch (Throwable $e) {
  // ไม่ให้ 500 เงียบ ๆ อีกต่อไป
  dlog("EXCEPTION: ".$e->getMessage()." @".$e->getFile().":".$e->getLine());
  if (DEBUG_MODE) {
    jsonResponse(false, null, 'server error: '.$e->getMessage(), 500);
  } else {
    jsonResponse(false, null, 'server error', 500);
  }
}
