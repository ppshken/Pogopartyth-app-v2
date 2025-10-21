<?php
// api/friend/add.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php'; // ฟังก์ชันช่วยเหลือ: authGuard(), jsonResponse(), pdo(), getJsonInput(), cors()
cors(); // เปิด CORS ให้ frontend เรียกได้

// ---------------------------------------------------------------------
// 0) รับเฉพาะเมธอด POST เท่านั้น
// ---------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

// ---------------------------------------------------------------------
// 1) อ่านตัวตนผู้ใช้จาก JWT และอ่านอินพุต JSON
// ---------------------------------------------------------------------
$userId = authGuard();        // ผู้ใช้ที่ล็อกอิน (requester)
$input  = getJsonInput();     // ข้อมูล JSON ใน body

// ---------------------------------------------------------------------
// 2) รับพารามิเตอร์จาก Body และตรวจสอบความถูกต้อง
// ---------------------------------------------------------------------
$targetId = (int)($input['target_id'] ?? 0);   // ผู้ใช้ปลายทางที่เราจะขอเป็นเพื่อน

if ($targetId <= 0) {
  jsonResponse(false, null, 'target_id ไม่ถูกต้อง', 422);
}
if ($targetId === $userId) {
  jsonResponse(false, null, 'ห้ามขอเป็นเพื่อนกับตัวเอง', 422);
}

// ---------------------------------------------------------------------
// 3) เชื่อมต่อฐานข้อมูล
// ---------------------------------------------------------------------
$db = pdo();

// ---------------------------------------------------------------------
// 🎯 ฟังก์ชันช่วย: ส่ง Expo Push + (ออปชัน) บันทึกลงตาราง notifications
// ---------------------------------------------------------------------

/**
 * ส่งแจ้งเตือนด้วย Expo Push
 * @param string $expoToken  ExponentPushToken[...] ของปลายทาง
 * @param string $title      หัวข้อแจ้งเตือน
 * @param string $message    เนื้อหาแจ้งเตือน
 * @param array  $data       ข้อมูลเสริม (กดแจ้งเตือนแล้วให้แอพนำทางได้)
 * @return bool              ส่งเรียบร้อยหรือไม่ (เชิงเทคนิค)
 */
function sendExpoPush(string $expoToken, string $title, string $message, array $data = []): bool
{
  // Endpoint สำหรับ Expo Push
  $url = 'https://exp.host/--/api/v2/push/send';

  $payload = [
    'to'    => $expoToken,
    'title' => $title,
    'body'  => $message,
    'sound' => 'default',
    'data'  => $data,
  ];

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
      'Content-Type: application/json',
      // 'Authorization: Bearer <YOUR_EXPO_ACCESS_TOKEN>' // ถ้าคุณมี token ฝั่งเซิร์ฟเวอร์ค่อยเพิ่ม
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT        => 10,
  ]);

  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  // ถือว่าสำเร็จเมื่อได้ 200 กลับมา (อย่างง่าย)
  if ($err) return false;
  return $code >= 200 && $code < 300;
}

/**
 * บันทึกแจ้งเตือนลง DB (ออปชัน)
 * ตารางตัวอย่าง:
 * CREATE TABLE notifications (
 *   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 *   user_id BIGINT UNSIGNED NOT NULL,
 *   type VARCHAR(50) NOT NULL,        -- เช่น 'friend_request'
 *   title VARCHAR(100) NOT NULL,
 *   message VARCHAR(255) NOT NULL,
 *   data JSON NULL,                   -- ข้อมูลเพิ่มเติมสำหรับ deep link
 *   is_read TINYINT(1) NOT NULL DEFAULT 0,
 *   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   KEY idx_user (user_id),
 *   CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 */
function createInAppNotification(PDO $db, int $userId, string $type, string $title, string $message, array $data = []): void
{
  try {
    $stmt = $db->prepare("
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (:uid, :type, :title, :msg, :data)
    ");
    $stmt->execute([
      ':uid'   => $userId,
      ':type'  => $type,
      ':title' => $title,
      ':msg'   => $message,
      ':data'  => json_encode($data, JSON_UNESCAPED_UNICODE),
    ]);
  } catch (Throwable $e) {
    // ไม่ต้อง fail API แค่เก็บเงียบ ๆ
  }
}

/**
 * ฟังก์ชัน high-level: แจ้งเตือน "มีคำขอเป็นเพื่อนใหม่"
 * - ดึงข้อมูล username ของผู้ส่งคำขอเพื่อแสดงผลในแจ้งเตือน
 * - ดึง device_token ของผู้รับคำขอ แล้วส่ง Expo Push
 * - (ออปชัน) บันทึกเข้าสู่ notifications table
 */
function notifyFriendRequest(PDO $db, int $fromUserId, int $toUserId): void
{
  // ดึงชื่อผู้ส่ง + token ผู้รับ
  $q = $db->prepare("
    SELECT 
      u_from.username AS from_name,
      u_to.device_token AS expo_token
    FROM users u_from
    JOIN users u_to ON u_to.id = :toId
    WHERE u_from.id = :fromId
    LIMIT 1
  ");
  $q->execute([':fromId' => $fromUserId, ':toId' => $toUserId]);
  $u = $q->fetch();

  $fromName  = $u['from_name']  ?? 'ผู้ใช้ใหม่';
  $expoToken = $u['expo_token'] ?? null;

  // เนื้อหาแจ้งเตือน
  $title   = 'คำขอเป็นเพื่อนใหม่';
  $message = "{$fromName} ส่งคำขอเป็นเพื่อนถึงคุณ";

  // deep link สำหรับกดแจ้งเตือนให้พาไปหน้า "คำขอเพื่อน"
  // (แก้ schema ให้ตรงกับแอปคุณ เช่น pogopartyth://friends/requests)
  $data = [
    'type'      => 'friend_request',
    'from_id'   => $fromUserId,
    'deeplink'  => 'pogopartyth://friends/requests'
  ];

  // ส่ง Expo Push (ถ้ามี token)
  if (!empty($expoToken)) {
    sendExpoPush($expoToken, $title, $message, $data);
  }

  // บันทึกแจ้งเตือนแบบ in-app ไว้ดูย้อนหลัง
  createInAppNotification($db, $toUserId, 'friend_request', $title, $message, $data);
}

try {
  // -------------------------------------------------------------------
  // 4) ตรวจว่ามีความสัมพันธ์อยู่แล้วไหม (ดึงให้ครบฟิลด์ที่ต้องใช้)
  // -------------------------------------------------------------------
  $q = $db->prepare("
    SELECT id, requester_id, addressee_id, status
    FROM friendships
    WHERE (requester_id = :me AND addressee_id = :target)
       OR (requester_id = :target AND addressee_id = :me)
    LIMIT 1
  ");
  $q->execute([':me' => $userId, ':target' => $targetId]);
  $exist = $q->fetch();

  if ($exist) {
    // กรณี: เคยเป็นเพื่อนแล้ว
    if ($exist['status'] === 'accepted') {
      jsonResponse(false, null, 'เป็นเพื่อนกันอยู่แล้ว', 409);
    }
    // กรณี: มีคำขอค้างอยู่ (pending)
    if ($exist['status'] === 'pending') {
      // ถ้าเราเป็นคนขออยู่แล้ว
      if ((int)$exist['requester_id'] === $userId) {
        jsonResponse(false, null, 'คุณได้ส่งคำขอไปแล้ว', 409);
      } else {
        // อีกฝ่ายเป็นคนส่งคำขอมาแล้ว → บอกให้ไปตอบรับแทน
        jsonResponse(false, null, 'อีกฝ่ายส่งคำขอมาแล้ว กรุณากดตอบรับ', 409);
      }
    }

    // กรณี: เคยปฏิเสธ (declined) → อนุญาตให้รีเซ็ตกลับเป็น pending ใหม่
    if ($exist['status'] === 'declined') {
      $upd = $db->prepare("
        UPDATE friendships
        SET requester_id = :me,
            addressee_id = :target,
            status = 'pending',
            created_at = CURRENT_TIMESTAMP,
            updated_at = NULL
        WHERE id = :id
      ");
      $upd->execute([
        ':me'     => $userId,
        ':target' => $targetId,
        ':id'     => $exist['id']
      ]);

      // 🔔 แจ้งเตือนผู้รับคำขอ (target) ว่ามีคำขอใหม่/อีกครั้ง
      notifyFriendRequest($db, $userId, $targetId);

      jsonResponse(true, null, 'ส่งคำขอเป็นเพื่อนใหม่อีกครั้ง');
    }
  }

  // -------------------------------------------------------------------
  // 5) แทรกแถวใหม่ (ยังไม่เคยมีความสัมพันธ์)
  // -------------------------------------------------------------------
  $ins = $db->prepare("
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (:me, :target, 'pending')
  ");
  $ins->execute([':me' => $userId, ':target' => $targetId]);

  // 🔔 แจ้งเตือนผู้รับคำขอ (target) ว่ามีคำขอเป็นเพื่อน
  notifyFriendRequest($db, $userId, $targetId);

  jsonResponse(true, null, 'ส่งคำขอเป็นเพื่อนเรียบร้อยแล้ว');
} catch (Throwable $e) {
  // เก็บรายละเอียดข้อผิดพลาด (แนะนำให้ล็อกลงไฟล์ด้วยสำหรับดีบัก)
  jsonResponse(false, null, 'เกิดข้อผิดพลาด: ' . $e->getMessage(), 500);
}
