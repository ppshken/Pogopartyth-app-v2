<?php
// api/raid/get_room.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$roomId = (int)($_GET['room_id'] ?? 0);
if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}

// ----- อ่าน user_id จาก token แบบ OPTIONAL -----
$authedUserId = null;
$hdr = function_exists('readAuthHeader') ? readAuthHeader() : ($_SERVER['HTTP_AUTHORIZATION'] ?? null);
$token = null;
if ($hdr && stripos($hdr, 'Bearer ') === 0) {
  $token = trim(substr($hdr, 7));
} elseif (!empty($_GET['token'])) { // fallback debug เท่านั้น
  $token = trim($_GET['token']);
}
if ($token) {
  $payload = verifyToken($token);
  if ($payload && !empty($payload['user_id'])) {
    $authedUserId = (int)$payload['user_id'];
  }
}

$db = pdo();

// ดึงรายละเอียดห้อง + เจ้าของ (✅ เพิ่ม friend_code ของเจ้าของ)
$stmt = $db->prepare("
  SELECT
    r.id, r.raid_boss_id, r.pokemon_image, r.boss, r.start_time, r.max_members, r.status, r.owner_id, r.note, r.created_at,
    u.username AS owner_username,
    u.friend_code AS owner_friend_code,
    u.avatar   AS owner_avatar,
    u.level AS owner_level,
    (SELECT COUNT(*) FROM chat c WHERE c.raid_rooms_id = r.id) AS current_chat_messages
  FROM raid_rooms r
  JOIN users u ON u.id = r.owner_id
  WHERE r.id = :id
  LIMIT 1
");
$stmt->execute([':id' => $roomId]);
$room = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$room) {
  jsonResponse(false, null, 'ไม่พบห้อง', 404);
}

// จำนวนสมาชิกปัจจุบัน
$qCount = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE room_id = :rid");
$qCount->execute([':rid' => $roomId]);
$currentMembers = (int)$qCount->fetchColumn();
$isFull = $currentMembers >= (int)$room['max_members'];

// รายชื่อสมาชิกในห้อง (+ is_review: สมาชิกคนนั้นเคยรีวิวห้องนี้หรือยัง)
$qMembers = $db->prepare("
  SELECT
    ur.user_id,
    ur.role,
    ur.joined_at,
    uu.username,
    uu.avatar,
    uu.friend_code AS friend_code,
    uu.level AS member_level,
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM raid_reviews rv 
        WHERE rv.room_id = :rid 
          AND rv.user_id = ur.user_id
        LIMIT 1
      ) THEN 1 ELSE 0
    END AS is_review
  FROM user_raid_rooms ur
  JOIN users uu ON uu.id = ur.user_id
  WHERE ur.room_id = :rid
  ORDER BY (ur.role = 'owner') DESC, ur.joined_at ASC
");
$qMembers->execute([':rid' => $roomId]);
$members = $qMembers->fetchAll(PDO::FETCH_ASSOC);

// แปลงชนิดข้อมูลบางฟิลด์ให้อ่านง่าย (optional)
foreach ($members as &$m) {
  $m['user_id'] = (int)$m['user_id'];
  $m['member_level'] = isset($m['member_level']) ? (int)$m['member_level'] : null;
  $m['is_review'] = (int)$m['is_review']; // 0|1
}
unset($m);


// สถานะของผู้เรียกดู (ถ้ามี token)
$you = null;
if ($authedUserId !== null) {
  $youRole = null;
  foreach ($members as $m) {
    if ((int)$m['user_id'] === $authedUserId) {
      $youRole = $m['role'];
      break;
    }
  }
  $you = [
    'user_id'   => $authedUserId,
    'is_member' => $youRole !== null,
    'role'      => $youRole,                 // owner | member | null
    'is_owner'  => $youRole === 'owner',
  ];
}

jsonResponse(true, [
  'room' => [
    'id'              => (int)$room['id'],
    'raid_boss_id'    => (int)$room['raid_boss_id'],
    'boss'            => $room['boss'],
    'start_time'      => $room['start_time'],
    'pokemon_image'      => $room['pokemon_image'],
    'max_members'     => (int)$room['max_members'],
    'status'          => $room['status'],
    'owner'           => [
      'id'          => (int)$room['owner_id'],
      'username'    => $room['owner_username'],
      'friend_code' => $room['owner_friend_code'],
      'avatar'      => $room['owner_avatar'],
    ],
    'note'            => $room['note'],
    'created_at'      => $room['created_at'],
    'current_chat_messages' => (int)$room['current_chat_messages'],
    'current_members' => $currentMembers,
    'is_full'         => $isFull,
  ],
  'members' => $members,  // ตอนนี้สมาชิกแต่ละคนมี friend_code ด้วยแล้ว
  'you'     => $you,      // null ถ้าไม่ได้ส่ง token มา
], 'โหลดรายละเอียดห้องสำเร็จ');
