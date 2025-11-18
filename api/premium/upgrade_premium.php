<?php
// api/premium/upgrade_premium.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

// ดึง user id จาก token
$userId = authGuard();
if (!$userId) {
  jsonResponse(false, null, 'Unauthorized', 401);
}

// อ่าน input
$input = getJsonInput();

// อยากให้ premium นานกี่วัน (สำหรับ debug)
$days = (int)($input['days'] ?? 30);
if ($days <= 0) $days = 30;
if ($days > 365) $days = 365; // กันใส่เกิน

$tz = new DateTimeZone('Asia/Bangkok');
$now = new DateTimeImmutable('now', $tz);
$expiresAt = $now->modify("+{$days} days")->format('Y-m-d H:i:s');
$premiumSince = $now->format('Y-m-d H:i:s');

$db = pdo();

try {
  $db->beginTransaction();

  // อัปเดตเป็น premium
  $q = $db->prepare("
    UPDATE users
    SET 
      plan = 'premium',
      plan_expires_at = :plan_expires_at,
      premium_since = CASE 
        WHEN premium_since IS NULL THEN :premium_since
        ELSE premium_since
      END
    WHERE id = :id
  ");
  $q->execute([
    ':plan_expires_at' => $expiresAt,
    ':premium_since'   => $premiumSince,
    ':id'              => $userId,
  ]);

  // ดึงข้อมูล user กลับไปให้ frontend
  $q2 = $db->prepare("
    SELECT id, username, email, plan, plan_expires_at, premium_since
    FROM users
    WHERE id = :id
  ");
  $q2->execute([':id' => $userId]);
  $user = $q2->fetch(PDO::FETCH_ASSOC);

  $db->commit();

  jsonResponse(true, [
    'user' => $user,
  ], 'อัปเกรดเป็น premium (debug) สำเร็จ');
} catch (Throwable $e) {
  if ($db->inTransaction()) {
    $db->rollBack();
  }
  error_log('upgrade_premium_debug error: ' . $e->getMessage());
  jsonResponse(false, null, 'อัปเกรด premium (debug) ไม่สำเร็จ', 500);
}
