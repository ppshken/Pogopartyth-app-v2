<?php
// api/chat/threads.php
declare(strict_types=1);
require_once __DIR__ . '/../../helpers.php';

cors();

$me = authGuard();
$db = pdo();

$limit  = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

$stmt = $db->prepare("
  SELECT
    t.id AS thread_id,
    IF(t.member_min = :me, t.member_max, t.member_min) AS other_user_id,
    u.username AS other_username,
    u.avatar   AS other_avatar,
    t.last_message_text,
    t.last_message_at,
    t.last_message_sender
  FROM dm_threads t
  JOIN users u ON u.id = IF(t.member_min = :me, t.member_max, t.member_min)
  WHERE :me IN (t.member_min, t.member_max)
  ORDER BY t.last_message_at DESC
  LIMIT :lim OFFSET :off
");
$stmt->bindValue(':me', $me, PDO::PARAM_INT);
$stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
$stmt->bindValue(':off', $offset, PDO::PARAM_INT);
$stmt->execute();
$list = $stmt->fetchAll();

jsonResponse(true, [
  'list'       => $list,
  'pagination' => ['limit' => $limit, 'offset' => $offset, 'has_more' => count($list) === $limit],
]);
