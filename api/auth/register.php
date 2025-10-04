<?php
// api/auth/register.php
declare(strict_types=1);

use BcMath\Number;

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$input    = getJsonInput();
$email    = trim($input['email']    ?? '');
$username = trim($input['username'] ?? '');
$password = (string)($input['password'] ?? '');
$avatar   = trim($input['avatar']   ?? '');
$friend   = trim($input['friend_code'] ?? '');
$level   =  ($input['level'] ?? '');

// 1) Validate เบื้องต้น
if ($email === '' || $username === '' || $password === '') {
  jsonResponse(false, null, 'กรอก email, username, password ให้ครบ', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonResponse(false, null, 'รูปแบบอีเมลไม่ถูกต้อง', 422);
}
// username: a-z,0-9,._-, 3–20 ตัว
if (!preg_match('/^[a-z0-9._-]{3,20}$/i', $username)) {
  jsonResponse(false, null, 'username ต้องเป็น a-z,0-9,._- และยาว 3–20 ตัว', 422);
}
if (strlen($password) < 6) {
  jsonResponse(false, null, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 422);
}

$db = pdo();

// 2) ตรวจซ้ำ email/username
$check = $db->prepare("SELECT 1 FROM users WHERE email = :email OR username = :username LIMIT 1");
$check->execute([':email' => $email, ':username' => $username]);
if ($check->fetch()) {
  jsonResponse(false, null, 'อีเมลหรือชื่อผู้ใช้ถูกใช้งานแล้ว', 409);
}

function mb_first_upper(string $s, string $enc = 'UTF-8'): string {
    if ($s === '') return $s;
    return mb_strtoupper(mb_substr($s, 0, 1, $enc), $enc);
}

$avatar_result = mb_first_upper($username);
$avatar_result_image = "https://ui-avatars.com/api/?name=" . urlencode($avatar_result) . "&background=random&size=256&bold=true";

// 3) สร้างบัญชี
try {
  $hash = password_hash($password, PASSWORD_DEFAULT);
  $stmt = $db->prepare("
    INSERT INTO users (email, username, password_hash, avatar, friend_code, level, created_at)
    VALUES (:email, :username, :hash, :avatar, :friend, :level, :created_at)
  ");
  $stmt->execute([
    ':email'     => $email,
    ':username'  => $username,
    ':hash'      => $hash,
    ':avatar'    => $avatar_result_image ?: null,
    ':friend'    => $friend ?: null,
    ':level'     => $level,
    ':created_at'=> now(),
  ]);

  $userId = (int)$db->lastInsertId();
  $token  = makeToken($userId, 86400 * 7); // login ให้อัตโนมัติ 7 วัน

  jsonResponse(true, [
    'user' => [
      'id'        => $userId,
      'email'     => $email,
      'username'  => $username,
      'avatar'    => $avatar ?: null,
      'friend_code' => $friend ?: null,
      'level'     => $level,
    ],
    'token' => $token,
  ], 'สมัครสมาชิกสำเร็จ', 201);

} catch (Throwable $e) {
  // ถ้ามี unique index ที่ DB ก็อาจโยน Duplicate error ได้ ตรงนี้กันไว้
  jsonResponse(false, null, 'สมัครสมาชิกไม่สำเร็จ', 500);
}
