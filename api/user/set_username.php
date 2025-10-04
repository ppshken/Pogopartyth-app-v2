<?php
// api/user/set_username.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
$userId = authGuard(); // ฟังก์ชันอ่าน JWT ของคุณ

$input = json_decode(file_get_contents('php://input'), true);
$username = strtolower(trim((string)($input['username'] ?? '')));

if (!preg_match('/^[a-z0-9_]{3,20}$/', $username)) {
  jsonResponse(false, null, 'รูปแบบ username ไม่ถูกต้อง', 422);
}

$db = pdo();
$db->exec("SET time_zone = '+00:00'");

// ตรวจซ้ำด้วย prepared statement
$st = $db->prepare("SELECT 1 FROM users WHERE username=:u AND id<>:id LIMIT 1");
$st->execute([':u'=>$username, ':id'=>$userId]);
if ($st->fetchColumn()) {
  jsonResponse(false, null, 'username นี้ถูกใช้แล้ว', 409);
}

// อัปเดต
$upd = $db->prepare("UPDATE users SET username=:u WHERE id=:id");
$upd->execute([':u'=>$username, ':id'=>$userId]);

jsonResponse(true, null, 'บันทึกสำเร็จ');
