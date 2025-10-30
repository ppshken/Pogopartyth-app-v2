<?php
// api/auth/update_profile.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$db = pdo();

try {
  $in = getJsonInput();

  // อนุญาตเฉพาะฟิลด์: username, friend_code, level (1–50)
  $password    = isset($in['password']) ? trim((string)$in['password']) : null;
  $username    = isset($in['username']) ? trim((string)$in['username']) : null;
  $friend_code = array_key_exists('friend_code', $in) ? trim((string)$in['friend_code']) : null;
  $team        = array_key_exists('team', $in) ? trim((string)$in['team']) : null;
  $level_raw   = array_key_exists('level', $in) ? $in['level'] : null;
  $device_token   = array_key_exists('device_token', $in) ? $in['device_token'] : null;

  $setup_status   = isset($in['setup_status']) ? trim((string)$in['setup_status']) : null;

  $set = [];
  $params = [':id' => $userId];

  // username
  if ($username !== null) {
    if ($username === '') {
      jsonResponse(false, null, 'username ห้ามว่าง', 422);
    }
    $set[] = 'username = :username';
    $params[':username'] = $username;
  }

  // friend_code (ถ้าจะบังคับรูปแบบ 12 หลัก คอมเมนต์ด้านล่าง)
  if ($friend_code !== null) {
    $set[] = 'friend_code = :friend_code';
    $params[':friend_code'] = $friend_code;
  }

  if ($setup_status !== null) {
    $set[] = 'setup_status = :setup_status';
    $params[':setup_status'] = $setup_status;
  }

  if ($password !== null) {
  $hash = password_hash($password, PASSWORD_DEFAULT);
    $set[] = 'password_hash = :password';
    $params[':password'] = $hash;
  }

  if ($device_token !== null) {
    $set[] = 'device_token = :device_token';
    $params[':device_token'] = $device_token;
  }

  // team
  $allowed_teams = ['Valor', 'Mystic', 'Instinct', ''];
  if ($team !== null) {
    if (!in_array($team, $allowed_teams, true)) {
      jsonResponse(false, null, 'team ต้องเป็นค่า Valor, Mystic, Instinct หรือเว้นว่าง', 422);
    }
    $set[] = 'team = :team';
    $params[':team'] = $team;
  }

  // level (ต้องเป็น int 1–80)
  if ($level_raw !== null) {
    $level = filter_var(
      $level_raw,
      FILTER_VALIDATE_INT,
      ['options' => ['min_range' => 1, 'max_range' => 80]]
    );
    if ($level === false) {
      jsonResponse(false, null, 'level ต้องเป็นจำนวนเต็มระหว่าง 1–50', 422);
    }
    $set[] = 'level = :level';
    $params[':level'] = (int)$level;
  }

  if (empty($set)) {
    jsonResponse(false, null, 'ไม่มีข้อมูลให้ปรับปรุง', 422);
  }

  $sql = 'UPDATE users SET ' . implode(', ', $set) . ' WHERE id = :id';
  $stmt = $db->prepare($sql);
  $stmt->execute($params);

  // ส่งข้อมูลล่าสุดกลับ (เพิ่ม level)
  $stmt = $db->prepare("
    SELECT id, email, username, avatar, friend_code, level, created_at
    FROM users WHERE id = :id LIMIT 1
  ");
  $stmt->execute([':id' => $userId]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    jsonResponse(false, null, 'ไม่พบผู้ใช้หลังอัปเดต', 404);
  }

  jsonResponse(true, ['user' => $user], 'อัปเดตโปรไฟล์สำเร็จ');

} catch (PDOException $e) {
  if ($e->getCode() === '23000') {
    jsonResponse(false, null, 'ข้อมูลซ้ำ (เช่น username มีผู้ใช้แล้ว)', 409);
  }
  jsonResponse(false, null, 'DB Error: ' . $e->getMessage(), 500);
} catch (Throwable $e) {
  jsonResponse(false, null, 'Server Error: ' . $e->getMessage(), 500);
}
