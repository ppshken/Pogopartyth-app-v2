<?php
// api/auth/login.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$in = getJsonInput();
$login = trim((string)($in['login'] ?? $in['email'] ?? $in['username'] ?? ''));
$password = (string)($in['password'] ?? '');
$deviceToken = (string)($in['device_token'] ?? '');

if ($login === '' || $password === '') {
  jsonResponse(false, null, 'กรอกข้อมูลให้ครบถ้วน', 422);
}

$db = pdo();
$stmt = $db->prepare(
  "SELECT id, email, username, password_hash
   FROM users
   WHERE email = :u OR username = :u
   LIMIT 1"
);
$stmt->execute([':u' => $login]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
  jsonResponse(false, null, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401);
}

$userId = (int)$user['id'];

if ($deviceToken) {
  $upd = $db->prepare(
    "UPDATE users SET device_token = :t WHERE id = :id"
  );
  $upd->execute([':t' => $deviceToken, ':id' => $userId]);
}

$token = makeToken($userId, 86400 * 7); // อายุ 7 วัน

jsonResponse(true, [
  'user' => [
    'id'           => $userId,
    'email'        => $user['email'],
    'username'     => $user['username'],
    'device_token' => $deviceToken,
  ],
  'token' => $token,
], 'เข้าสู่ระบบสำเร็จ');
