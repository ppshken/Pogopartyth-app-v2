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

// ====== CONFIG กันสแปม ======
const REPORT_COOLDOWN_SEC = 300; // 5 นาที = 300 วินาที

// ====== ตรวจค่า input ======
$allowed = ['user', 'room', 'other'];
if (!in_array($type, $allowed, true)) {
  jsonResponse(false, null, 'report_type ไม่ถูกต้อง (user|room|other)', 422);
}

if ($type === 'other') {
  // ถ้าเป็น "รายงานทั่วไป" ไม่ผูก user/room ให้ target = 0 ชัดเจน
  $target = 0;
}

$len = mb_strlen($reason);
if ($len < 1 || $len > 2000) {
  jsonResponse(false, null, 'กรุณากรอกเหตุผล 1–2000 ตัวอักษร', 422);
}

$db = pdo();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
  $db->beginTransaction();

  // ====== กันสแปม: ดู report ล่าสุดของ user นี้ ======
  $lastStmt = $db->prepare("
    SELECT created_at
    FROM reports
    WHERE reporter_id = :uid
    ORDER BY id DESC
    LIMIT 1
  ");
  $lastStmt->execute([':uid' => $userId]);
  $last = $lastStmt->fetch(PDO::FETCH_ASSOC);

  if ($last && !empty($last['created_at'])) {
    $lastTs = strtotime((string)$last['created_at']);
    if ($lastTs !== false) {
      $diff = time() - $lastTs; // วินาทีที่ผ่านไปแล้วจากการส่งล่าสุด
      if ($diff < REPORT_COOLDOWN_SEC) {
        $wait = REPORT_COOLDOWN_SEC - $diff;

        // ยกเลิก transaction ก่อนออก
        $db->rollBack();

        jsonResponse(
          false,
          [
            'cooldown_sec' => $wait,
            'message_hint' => "คุณเพิ่งส่งรายงานไปแล้ว โปรดลองใหม่ในอีกประมาณ {$wait} วินาที"
          ],
          'ส่งรายงานถี่เกินไป กรุณารอสักครู่',
          429
        );
      }
    }
  }

  // ====== ผ่านคูลดาวน์ -> บันทึก report ======
  $stmt = $db->prepare("
    INSERT INTO reports (report_type, target_id, reporter_id, reason, status, created_at)
    VALUES (:type, :target, :reporter, :reason, 'pending', NOW())
  ");

  $ok = $stmt->execute([
    ':type'     => $type,
    ':target'   => $target,
    ':reporter' => $userId,
    ':reason'   => $reason,
  ]);

  if (!$ok) {
    // ยังอยู่ใน transaction → rollback ให้เรียบร้อย
    $db->rollBack();
    jsonResponse(false, null, 'บันทึกไม่สำเร็จ', 500);
  }

  $id = (int)$db->lastInsertId();

  // สำเร็จ: commit
  $db->commit();

  jsonResponse(true, [
    'id'     => $id,
    'status' => 'pending',
  ], 'ส่งรายงานสำเร็จ');

} catch (Throwable $e) {
  if ($db->inTransaction()) {
    $db->rollBack();
  }
  jsonResponse(false, null, 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', 500);
}
