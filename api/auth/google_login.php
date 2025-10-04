<?php
// api/auth/google_login.php
declare(strict_types=1);
header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/../helpers.php';

// ===== helpers =====
function make_friend_code(PDO $db): string {
  do {
    $code = substr(strtoupper(bin2hex(random_bytes(6))), 0, 8);
    $q = $db->prepare("SELECT 1 FROM users WHERE friend_code=:c LIMIT 1");
    $q->execute([':c' => $code]);
  } while ($q->fetchColumn());
  return $code;
}

function suggest_username(string $name, PDO $db): string {
  $base = strtolower(preg_replace('/[^a-z0-9_]+/i', '', str_replace(' ', '_', $name)));
  if ($base === '') $base = 'user';
  $base = substr($base, 0, 15);
  $candidate = $base; $i = 1;
  while (true) {
    $q = $db->prepare("SELECT 1 FROM users WHERE username=:u LIMIT 1");
    $q->execute([':u' => $candidate]);
    if (!$q->fetchColumn()) return $candidate;
    $candidate = substr($base, 0, max(1, 15 - strlen((string)$i))) . $i;
    $i++;
  }
}

// ===== 1) รับ id_token =====
$input   = json_decode(file_get_contents('php://input'), true);
$idToken = trim((string)($input['id_token'] ?? ''));
if ($idToken === '') {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'missing id_token']); exit;
}

// ===== 2) ตรวจสอบกับ Google (tokeninfo) =====
$ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10]);
$res  = curl_exec($ch);
if ($res === false) { echo json_encode(['success'=>false,'message'=>'google verify failed']); exit; }
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($code !== 200) { echo json_encode(['success'=>false,'message'=>'invalid id_token']); exit; }

$p = json_decode($res, true) ?: [];
$aud     = $p['aud'] ?? '';
$sub     = $p['sub'] ?? '';
$email   = $p['email'] ?? '';
$ev      = ($p['email_verified'] ?? 'false') === 'true';
$name    = $p['name'] ?? '';
$picture = $p['picture'] ?? '';
$exp     = (int)($p['exp'] ?? 0);
$iss     = $p['iss'] ?? '';

// --- เช็ค issuer / audience / expiry ---
if (!in_array($iss, ['accounts.google.com','https://accounts.google.com'], true)) {
  echo json_encode(['success'=>false,'message'=>'iss mismatch']); exit;
}
$ALLOWED_AUDS = [
  '926863512286-tmavj5behf6g3j8bhggp11ajitiovlh9.apps.googleusercontent.com', // Android (ของคุณ)
  'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
];
if (!in_array($aud, $ALLOWED_AUDS, true)) { echo json_encode(['success'=>false,'message'=>'aud mismatch']); exit; }
if ($exp < time()) { echo json_encode(['success'=>false,'message'=>'id_token expired']); exit; }
if ($email === '') { echo json_encode(['success'=>false,'message'=>'email not provided']); exit; }

// ===== 3) DB / upsert =====
$db = pdo();
$db->exec("SET time_zone = '+00:00'");

// เช็คครั้งเดียวว่า users มีคอลัมน์ google_sub ไหม
$cols = $db->query("DESCRIBE users")->fetchAll(PDO::FETCH_ASSOC);
$fields = array_column($cols, 'Field');
$hasGoogleSub = in_array('google_sub', $fields, true);

// หา user
if ($hasGoogleSub) {
  $st = $db->prepare("SELECT * FROM users WHERE google_sub=:sub OR email=:email LIMIT 1");
  $st->execute([':sub'=>$sub, ':email'=>$email]);
} else {
  $st = $db->prepare("SELECT * FROM users WHERE email=:email LIMIT 1");
  $st->execute([':email'=>$email]);
}
$user = $st->fetch(PDO::FETCH_ASSOC);

try {
  $db->beginTransaction();

  if ($user) {
    $userId = (int)$user['id'];
    $friend_code = $user['friend_code'] ?: make_friend_code($db);

    $sql = "UPDATE users
            SET email=:email,
                avatar=COALESCE(NULLIF(avatar,''), :avatar),
                friend_code=:fc,
                level=COALESCE(level, 1),
                role=COALESCE(role, 'member'),
                status=COALESCE(status, 'active')"
            . ($hasGoogleSub ? ", google_sub=:sub" : "")
            . ($ev ? ", email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP())" : "")
            . " WHERE id=:id";
    $params = [
      ':email'=>$email, ':avatar'=>$picture, ':fc'=>$friend_code, ':id'=>$userId
    ];
    if ($hasGoogleSub) $params[':sub'] = $sub;
    $db->prepare($sql)->execute($params);

    // refresh minimal fields used in response
    $user['friend_code'] = $friend_code;
    if (empty($user['avatar'])) $user['avatar'] = $picture;

  } else {
    $friend_code = make_friend_code($db);
    $sql = "INSERT INTO users (email, username, avatar, friend_code, level, role, status, created_at, email_verified_at"
         . ($hasGoogleSub ? ", google_sub" : "")
         . ")
           VALUES (:email, NULL, :avatar, :fc, 1, 'member', 'active', UTC_TIMESTAMP(), "
         . ($ev ? "UTC_TIMESTAMP()" : "NULL")
         . ($hasGoogleSub ? ", :sub" : "")
         . ")";
    $params = [':email'=>$email, ':avatar'=>$picture, ':fc'=>$friend_code];
    if ($hasGoogleSub) $params[':sub'] = $sub;
    $db->prepare($sql)->execute($params);

    $userId = (int)$db->lastInsertId();
    $user = [
      'id'=>$userId, 'email'=>$email, 'username'=>null,
      'avatar'=>$picture, 'friend_code'=>$friend_code
    ];
  }

  $db->commit();

} catch (Throwable $e) {
  $db->rollBack();
  echo json_encode(['success'=>false,'message'=>'db error']); exit;
}

// ===== 4) ตัดสินใจจาก username =====
$missing = [];
if (empty($user['username'])) $missing[] = 'username';

// ===== 5) JWT =====
if (!function_exists('generate_jwt')) {
  function generate_jwt(array $payload, int $ttl = 604800): string {
    $key = getenv('JWT_SECRET') ?: 'change-me-please'; // !!! ใช้ ENV จริง
    $header = ['alg'=>'HS256','typ'=>'JWT'];
    $now = time();
    $payload += ['iat'=>$now, 'exp'=>$now + $ttl];

    $b64 = fn($d) => rtrim(strtr(base64_encode(json_encode($d, JSON_UNESCAPED_UNICODE)), '+/', '-_'), '=');
    $h = $b64($header); $p = $b64($payload);
    $s = rtrim(strtr(base64_encode(hash_hmac('sha256', "$h.$p", $key, true)), '+/', '-_'), '=');
    return "$h.$p.$s";
  }
}
$token = generate_jwt(['user_id'=>$user['id']], 60*60*24*7);

// ===== 6) Response =====
if (!empty($missing)) {
  echo json_encode([
    'success'      => true,
    'next_action'  => 'complete_profile',
    'missing'      => $missing,
    'suggestions'  => ['username' => suggest_username($name ?: 'user', $db)],
    'token'        => $token,
    'user'         => [
      'id'=>$user['id'],
      'email'=>$email,
      'username'=>null,
      'avatar'=>$user['avatar'] ?? $picture,
      'friend_code'=>$user['friend_code'] ?? null,
    ],
  ], JSON_UNESCAPED_UNICODE);
} else {
  echo json_encode([
    'success'     => true,
    'next_action' => 'go_home',
    'token'       => $token,
    'user'        => [
      'id'=>$user['id'],
      'email'=>$email,
      'username'=>$user['username'],
      'avatar'=>$user['avatar'],
      'friend_code'=>$user['friend_code'],
      'level'=>$user['level'] ?? 1,
      'role'=>$user['role'] ?? 'member',
      'status'=>$user['status'] ?? 'active',
    ],
  ], JSON_UNESCAPED_UNICODE);
}
