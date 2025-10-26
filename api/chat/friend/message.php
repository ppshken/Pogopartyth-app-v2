<?php
// api/chat/messages.php
declare(strict_types=1);
require_once __DIR__ . '/../../helpers.php';

cors();

$me       = authGuard();
$threadId = (int)($_GET['thread_id'] ?? 0);
$limit    = min(100, max(1, (int)($_GET['limit'] ?? 50)));
$offset   = max(0, (int)($_GET['offset'] ?? 0));

if ($threadId <= 0) {
  jsonResponse(false, null, 'thread_id ไม่ถูกต้อง', 422);
}

$db = pdo();
$threadRow = assertThreadMember($db, $threadId, $me);
$otherId   = otherUserIdOfThread($threadRow, $me);

// 1) โหลดข้อความ (เรียงใหม่สุดก่อน/เก่าสุดก่อนแล้วแต่ UI)
// ที่นี่ใช้เก่าสุดก่อนเพื่อเลื่อนอ่านต่อได้ง่าย
$q = $db->prepare("
  SELECT id, sender_id, text_body, image_url, created_at, seen_by_recipient_at
  FROM dm_messages
  WHERE thread_id = :t
  ORDER BY created_at ASC
  LIMIT :lim OFFSET :off
");
$q->bindValue(':t', $threadId, PDO::PARAM_INT);
$q->bindValue(':lim', $limit, PDO::PARAM_INT);
$q->bindValue(':off', $offset, PDO::PARAM_INT);
$q->execute();
$rows = $q->fetchAll();

// 2) mark read เฉพาะข้อความที่อีกฝั่งส่งมาและยังไม่เคยเห็น
$mark = $db->prepare("
  UPDATE dm_messages
  SET seen_by_recipient_at = NOW()
  WHERE thread_id = :t
    AND sender_id = :other
    AND seen_by_recipient_at IS NULL
");
$mark->execute([':t' => $threadId, ':other' => $otherId]);

// 3) นับยังไม่อ่าน (ไว้โชว์ badge ห้องนี้ได้ด้วย)
$countQ = $db->prepare("
  SELECT COUNT(*) AS unread
  FROM dm_messages
  WHERE thread_id = :t
    AND sender_id = :other
    AND seen_by_recipient_at IS NULL
");
$countQ->execute([':t' => $threadId, ':other' => $otherId]);
$unread = (int)($countQ->fetch()['unread'] ?? 0);

jsonResponse(true, [
  'list'       => $rows,
  'unread'     => $unread,
  'pagination' => ['limit' => $limit, 'offset' => $offset, 'has_more' => count($rows) === $limit],
]);
