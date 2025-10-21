<?php
// api/friend/respond.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php'; // เรียกใช้ฟังก์ชันช่วย เช่น authGuard(), jsonResponse(), pdo()
cors(); // อนุญาต CORS ให้ frontend (React Native/เว็บ) เรียกได้

// ------------------------
// 1) ตรวจสอบ Method
// ------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

// ------------------------
// 2) ตรวจสอบสิทธิ์ผู้ใช้ (อ่านจาก Token)
// ------------------------
$me = authGuard(); // อ่าน user_id ของผู้ที่ล็อกอินอยู่
$input = getJsonInput(); // อ่านข้อมูล JSON จาก body request

// ------------------------
// 3) อ่านค่าจาก body
// ------------------------
$requesterId = (int)($input['requester_id'] ?? 0); // id ของคนที่ส่งคำขอมา
$action = strtolower(trim((string)($input['action'] ?? ''))); // คำสั่งที่เลือก: accept หรือ decline

// ------------------------
// 4) ตรวจสอบความถูกต้องของข้อมูลที่ส่งมา
// ------------------------
if ($requesterId <= 0) {
  jsonResponse(false, null, 'requester_id ไม่ถูกต้อง', 422);
}
if (!in_array($action, ['accept', 'decline'], true)) {
  jsonResponse(false, null, 'action ต้องเป็น accept หรือ decline', 422);
}
if ($requesterId === $me) {
  jsonResponse(false, null, 'ไม่อนุญาตให้ตอบคำขอของตัวเอง', 422);
}

// ------------------------
// 5) เชื่อมต่อฐานข้อมูล
// ------------------------
$db = pdo();

try {
  // ------------------------
  // 6) ค้นหาคำขอเพื่อนที่ "อีกฝ่าย" ส่งมาให้เรา
  // ------------------------
  $q = $db->prepare("
    SELECT id, requester_id, addressee_id, status, created_at, updated_at
    FROM friendships
    WHERE requester_id = :req
      AND addressee_id = :me
    LIMIT 1
  ");
  $q->execute([':req' => $requesterId, ':me' => $me]);
  $row = $q->fetch();

  // ถ้าไม่เจอ แสดงว่าไม่มีคำขอที่เข้ามา
  if (!$row) {
    jsonResponse(false, null, 'ไม่พบคำขอเพื่อนที่เข้ามา', 404);
  }

  // ถ้าไม่อยู่ในสถานะ pending แล้ว (เช่น เคยตอบรับ/ปฏิเสธไปแล้ว)
  if ($row['status'] !== 'pending') {
    jsonResponse(false, null, 'คำขอนี้ไม่ได้อยู่ในสถานะรอการตอบรับ', 409);
  }

  // ------------------------
  // 7) เปลี่ยนสถานะตาม action ที่ผู้ใช้เลือก
  // ------------------------
  $newStatus = $action === 'accept' ? 'accepted' : 'declined';

  $upd = $db->prepare("
    UPDATE friendships
    SET status = :status,
        updated_at = NOW()
    WHERE id = :id
    LIMIT 1
  ");
  $upd->execute([
    ':status' => $newStatus,
    ':id' => $row['id']
  ]);

  // ------------------------
  // 8) (ออปชัน) สามารถเพิ่มระบบ Notification แจ้งอีกฝ่ายได้ที่นี่
  // เช่น แจ้งผ่าน push, LINE Notify, หรือระบบในแอป
  // ------------------------

  // ------------------------
  // 9) ส่งผลลัพธ์กลับไปยัง client
  // ------------------------
  jsonResponse(true, [
    'friendship' => [
      'id'           => (int)$row['id'],
      'requester_id' => (int)$row['requester_id'],
      'addressee_id' => (int)$row['addressee_id'],
      'status'       => $newStatus,
      'updated_at'   => date('Y-m-d H:i:s'),
    ],
    'message' => $newStatus === 'accepted'
      ? 'ตอบรับคำขอเป็นเพื่อนแล้ว'
      : 'ปฏิเสธคำขอเป็นเพื่อนแล้ว',
  ]);
} catch (Throwable $e) {
  // ถ้าเกิดข้อผิดพลาด เช่น query fail หรือ connection error
  jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
}
