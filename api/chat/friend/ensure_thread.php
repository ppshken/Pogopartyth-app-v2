<?php
// api/chat/ensure_thread.php
declare(strict_types=1);
require_once __DIR__ . '/../../helpers.php';

cors();

$me    = authGuard();
$other = (int)($_GET['other_id'] ?? 0);

if ($other <= 0 || $other === $me) {
  jsonResponse(false, null, 'other_id ไม่ถูกต้อง', 422);
}

$db = pdo();

// ใช้ UNIQUE(member_min,member_max) + LAST_INSERT_ID reuse
$stmt = $db->prepare("
  INSERT INTO dm_threads (member_min, member_max, last_message_at)
  VALUES (LEAST(:a,:b), GREATEST(:a,:b), NOW())
  ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
");
$stmt->execute([':a' => $me, ':b' => $other]);

$threadId = (int)$db->lastInsertId();

jsonResponse(true, ['thread_id' => $threadId]);
