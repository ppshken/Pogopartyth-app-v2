<?php
// api/user/noti_status.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

// ต้องล็อกอินเท่านั้น
$userId = authGuard();
if (!$userId) {
  jsonResponse(false, null, 'Unauthorized', 401);
}

// ---- METHOD: GET -> คืนค่าสถานะปัจจุบัน ----
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  try {
    $db = pdo();
    $stmt = $db->prepare("SELECT noti_status FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
      jsonResponse(false, null, 'ไม่พบบัญชีผู้ใช้', 404);
    }

    jsonResponse(true, ['noti_status' => $row['noti_status'] ?? 'off']);
  } catch (Throwable $e) {
    jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
  }
  exit;
}

// ---- METHOD: POST -> อัปเดตสถานะเป็น on/off ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = getJsonInput();
  $status = strtolower(trim((string)($input['status'] ?? ''))); // on|off

  if (!in_array($status, ['on', 'off'], true)) {
    jsonResponse(false, null, "ค่า status ไม่ถูกต้อง (on|off)", 422);
  }

  try {
    $db = pdo();

    $stmt = $db->prepare("UPDATE users SET noti_status = ? WHERE id = ?");
    $ok = $stmt->execute([$status, $userId]);

    if (!$ok) {
      jsonResponse(false, null, 'อัปเดตไม่สำเร็จ', 500);
    }

    // ส่งกลับสถานะล่าสุด (เผื่อมี trigger/logic อื่น)
    $stmt2 = $db->prepare("SELECT noti_status FROM users WHERE id = ? LIMIT 1");
    $stmt2->execute([$userId]);
    $row = $stmt2->fetch(PDO::FETCH_ASSOC);

    jsonResponse(true, ['noti_status' => $row['noti_status'] ?? $status], 'อัปเดตสำเร็จ');
  } catch (Throwable $e) {
    jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
  }
  exit;
}

// ---- METHOD อื่นๆ ไม่อนุญาต ----
jsonResponse(false, null, 'Method not allowed', 405);
