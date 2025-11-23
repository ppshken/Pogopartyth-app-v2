<?php
// api/chat/friend/inbox_list.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { jsonResponse(false, null, 'Method not allowed', 405); }

try {
  $meId = authGuard();
  if (!$meId) jsonResponse(false, null, 'Unauthorized', 401);

  $page       = (int)($_GET['page'] ?? 1);
  $limit      = (int)($_GET['limit'] ?? 50);
  
  if ($page < 1) $page = 1;
  if ($limit < 1) $limit = 1;
  if ($limit > 200) $limit = 200;
  $offset = ($page - 1) * $limit;

  $db = pdo();
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // ---------------------------------------------------------
  // 1. หาจำนวนข้อความที่ยังไม่ได้อ่าน (Unread Messages Count)
  // เฉพาะข้อความที่ "คนอื่นส่งหาเรา" และสถานะเป็น 'sent' (ยังไม่อ่าน)
  // ---------------------------------------------------------
  $sqlUnreadMsg = "
    SELECT COUNT(DISTINCT cf.friendship_id) 
    FROM chat_friends cf
    JOIN friendships f ON f.id = cf.friendship_id
    WHERE (f.requester_id = :me OR f.addressee_id = :me)
      AND cf.sender <> :me 
      AND cf.status = 'send'
    LIMIT 1
  ";
  $stmtUnread = $db->prepare($sqlUnreadMsg);
  $stmtUnread->execute([':me' => $meId]);
  $totalUnreadMessages = (int)$stmtUnread->fetchColumn();

  // ---------------------------------------------------------
  // 2. หาจำนวนคำขอเป็นเพื่อน (Pending Friend Requests Count)
  // เฉพาะคำขอที่ส่งมาหาเรา (addressee = :me) และสถานะ pending
  // ---------------------------------------------------------
  $sqlFriendReq = "
    SELECT COUNT(*) 
    FROM friendships 
    WHERE addressee_id = :me 
      AND status = 'pending'
  ";
  $stmtReq = $db->prepare($sqlFriendReq);
  $stmtReq->execute([':me' => $meId]);
  $totalFriendRequests = (int)$stmtReq->fetchColumn();


  // ---------------------------------------------------------
  // 3. ดึงรายการ Inbox (ล่าสุดต่อ Friendship)
  // ---------------------------------------------------------
  
  // Logic: 
  // 1. Join ตารางเพื่อน เพื่อดูว่าเป็นเพื่อนกับเราไหม
  // 2. ใช้ Window Function (ROW_NUMBER) แบ่งกลุ่มตาม friendship_id แล้วเรียงตามเวลาล่าสุด
  // 3. ไม่สนว่าใครเป็นคนส่ง (sender) เอาข้อความล่าสุดมาแสดงเสมอ
  
  $sqlList = "
    WITH RankedChats AS (
      SELECT
        cf.id,
        cf.friendship_id,
        cf.sender,
        cf.message,
        cf.status,
        cf.created_at,
        f.requester_id,
        f.addressee_id,
        ROW_NUMBER() OVER (PARTITION BY cf.friendship_id ORDER BY cf.id DESC) AS rn
      FROM chat_friends AS cf
      JOIN friendships AS f ON f.id = cf.friendship_id
      WHERE (f.requester_id = :me OR f.addressee_id = :me)
    )
    SELECT
      rc.id,
      rc.friendship_id,
      rc.sender,
      rc.message,
      rc.status,
      rc.created_at,
      u.id AS other_user_id,
      u.username,
      u.avatar
    FROM RankedChats AS rc
    -- Join เพื่อเอาข้อมูลของ 'อีกฝ่าย' (คู่สนทนา)
    JOIN users AS u ON u.id = CASE 
        WHEN rc.requester_id = :me THEN rc.addressee_id 
        ELSE rc.requester_id 
    END
    WHERE rc.rn = 1
    ORDER BY rc.created_at DESC
    LIMIT :limit OFFSET :offset
  ";

  $stmt = $db->prepare($sqlList);
  $stmt->bindValue(':me',     $meId,   PDO::PARAM_INT);
  $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();
  $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // นับจำนวนห้องแชททั้งหมด (สำหรับการแบ่งหน้า)
  $sqlCountChat = "
    SELECT COUNT(DISTINCT cf.friendship_id)
    FROM chat_friends AS cf
    JOIN friendships AS f ON f.id = cf.friendship_id
    WHERE (f.requester_id = :me OR f.addressee_id = :me)
    AND f.status = 'accepted'
  ";
  $stmtCount = $db->prepare($sqlCountChat);
  $stmtCount->execute([':me' => $meId]);
  $totalChats = (int)$stmtCount->fetchColumn();

  $hasMore = ($offset + count($list)) < $totalChats;

  jsonResponse(true, [
    'list' => $list,
    'counts' => [
        'unread_messages' => $totalUnreadMessages, // ข้อความที่ยังไม่อ่าน
        'friend_requests' => $totalFriendRequests, // คำขอเป็นเพื่อนที่รอตอบรับ
    ],
    'pagination' => [
      'page'     => $page,
      'limit'    => $limit,
      'total'    => $totalChats,
      'has_more' => $hasMore,
    ],
  ], 'โหลด Inbox สำเร็จ', 200);

} catch (Throwable $e) {
  jsonResponse(false, null, 'server error: ' . $e->getMessage(), 500);
}