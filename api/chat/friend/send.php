<?php
// api/chat/send.php (debug-friendly)
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';

cors();

$me    = authGuard();
$input = getJsonInput();

$threadId = (int)($input['thread_id'] ?? 0);
$text     = isset($input['text']) ? trim((string)$input['text']) : '';
$imageUrl = isset($input['image_url']) ? trim((string)$input['image_url']) : '';

if ($threadId <= 0) jsonResponse(false, null, 'thread_id ไม่ถูกต้อง', 422);
if ($text === '' && $imageUrl === '') jsonResponse(false, null, 'ต้องมี text หรือ image_url', 422);

$db = pdo();

try {
  $threadRow = assertThreadMember($db, $threadId, $me);
  $db->beginTransaction();

  $ins = $db->prepare("
    INSERT INTO dm_messages (thread_id, sender_id, text_body, image_url, created_at)
    VALUES (:t, :s, :text, :img, NOW())
  ");
  $ins->execute([
    ':t'    => $threadId,
    ':s'    => $me,
    ':text' => $text !== '' ? $text : null,
    ':img'  => $imageUrl !== '' ? $imageUrl : null,
  ]);

  // ตรวจคอลัมน์ก่อนอัปเดต (กัน error 1054 ตอนโครงสร้างยังไม่ครบ)
  $hasLastText = false; $hasLastSender = false; $hasLastAt = false;
  $cols = $db->query("SHOW COLUMNS FROM dm_threads")->fetchAll(PDO::FETCH_COLUMN);
  if ($cols) {
    $set = array_flip($cols);
    $hasLastText   = isset($set['last_message_text']);
    $hasLastSender = isset($set['last_message_sender']);
    $hasLastAt     = isset($set['last_message_at']);
  }

  $summary = null;
  if ($text !== '') $summary = mb_substr($text, 0, 120);
  elseif ($imageUrl !== '') $summary = '[รูปภาพ]';

  // อัปเดตเท่าที่คอลัมน์มี (กันพัง)
  $sql = "UPDATE dm_threads SET ";
  $parts = [];
  $params = [':t' => $threadId];

  if ($hasLastAt)    { $parts[] = "last_message_at = NOW()"; }
  if ($hasLastText)  { $parts[] = "last_message_text = :lm"; $params[':lm'] = $summary; }
  if ($hasLastSender){ $parts[] = "last_message_sender = :s"; $params[':s'] = $me; }

  if (!$parts) {
    // อย่างน้อยอัปเดตเวลาไม่ได้ ก็ไม่เป็นไร แต่ให้แจ้งเตือนไว้ใน log
    error_log("[chat] dm_threads missing summary columns; consider ALTER TABLE");
  } else {
    $sql .= implode(", ", $parts) . " WHERE id = :t";
    $upd = $db->prepare($sql);
    $upd->execute($params);
  }

  $db->commit();
  jsonResponse(true, null, 'ส่งแล้ว');

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  // log ลงไฟล์ error log ของ PHP/Apache
  error_log("[chat] send.php error uid={$me}, thread={$threadId}: ".$e->getMessage());
  jsonResponse(false, null, 'ส่งไม่สำเร็จ (server error)', 500);
}
