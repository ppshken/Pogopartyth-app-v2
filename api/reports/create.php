<?php
// api/reports/create.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input  = getJsonInput();

$type   = strtolower(trim((string)($input['report_type'] ?? '')));
$target = (int)($input['target_id'] ?? 0);
$reason = trim((string)($input['reason'] ?? ''));

$allowed = ['user', 'room', 'other'];
if (!in_array($type, $allowed, true)) {
  jsonResponse(false, null, 'report_type ไม่ถูกต้อง (user|room|other)', 422);
}
if ($type === 'other') {
  $target = 0; // กรณีทั่วไป
}
if ($reason === '' || mb_strlen($reason) > 2000) {
  jsonResponse(false, null, 'กรุณากรอกเหตุผล 1–2000 ตัวอักษร', 422);
}

$db = pdo();

$stmt = $db->prepare("
  INSERT INTO reports (report_type, target_id, reporter_id, reason, status)
  VALUES (?, ?, ?, ?, 'pending')
");
$ok = $stmt->execute([$type, $target, $userId, $reason]);

if (!$ok) {
  jsonResponse(false, null, 'บันทึกไม่สำเร็จ', 500);
}

$id = (int)$db->lastInsertId();
jsonResponse(true, ['id' => $id, 'status' => 'pending'], 'ส่งรายงานสำเร็จ');
