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

// 1) Validate เบื้องต้น
if (!$email) {
  jsonResponse(false, null, 'กรอก email, username, password ให้ครบ', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  jsonResponse(false, null, 'รูปแบบอีเมลไม่ถูกต้อง', 422);
}

$db = pdo();

// 2) ตรวจซ้ำ email/username
$check = $db->prepare("SELECT 1 FROM users WHERE email = :email LIMIT 1");
$check->execute([':email' => $email]);
if ($check->fetch()) {
  jsonResponse(false, null, 'อีเมลหรือชื่อผู้ใช้ถูกใช้งานแล้ว', 409);
}

function mb_first_upper(string $s, string $enc = 'UTF-8'): string {
    if ($s === '') return $s;
    return mb_strtoupper(mb_substr($s, 0, 1, $enc), $enc);
}

$avatar_result = mb_first_upper($email);
$avatar_result_image = "https://ui-avatars.com/api/?name=" . urlencode($avatar_result) . "&background=random&size=256&bold=true";

// 3) สร้างบัญชี
try {
  $stmt = $db->prepare("
    INSERT INTO users (email, username, avatar, friend_code, level, created_at)
    VALUES (:email, :username, :avatar, :friend, :level, :created_at)
  ");
  $stmt->execute([
    ':email'     => $email,
    ':username'  => $username,
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
