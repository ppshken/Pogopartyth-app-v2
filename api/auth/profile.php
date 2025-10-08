<?php
// api/auth/profile.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$authUserId = authGuard(); // อ่านจาก Authorization: Bearer <token>

// ถ้าส่ง user_id มา และไม่ตรงกับ token ให้บล็อค
$reqUserId = (int)($_GET['user_id'] ?? 0);
if ($reqUserId > 0 && $reqUserId !== $authUserId) {
  jsonResponse(false, null, 'Forbidden: cannot view other user profile', 403);
}

$userId = $reqUserId > 0 ? $reqUserId : $authUserId;

$db = pdo();
$stmt = $db->prepare("
  SELECT
    id,
    email,
    username,
    avatar,
    friend_code,
    level,
    device_token,
    noti_status,
    created_at
  FROM users
  WHERE id = :id
  LIMIT 1
");
$stmt->execute([':id' => $userId]);
$user = $stmt->fetch();

if (!$user) {
  jsonResponse(false, null, 'ไม่พบผู้ใช้', 404);
}

// (ออปชัน) สถิติเล็กน้อย เช่น จำนวนห้องที่เข้าร่วม/สร้าง
$stats = [
  'rooms_owned'  => 0,
  'rooms_joined' => 0,
];
try {
  $q1 = $db->prepare("SELECT COUNT(*) FROM raid_rooms WHERE owner_id = :uid");
  $q1->execute([':uid' => $userId]);
  $stats['rooms_owned'] = (int)$q1->fetchColumn();

  $q2 = $db->prepare("SELECT COUNT(*) FROM user_raid_rooms WHERE user_id = :uid");
  $q2->execute([':uid' => $userId]);
  $stats['rooms_joined'] = (int)$q2->fetchColumn();
} catch (Throwable $e) {
  // ไม่ต้อง fail ทั้ง endpoint แค่ไม่ใส่ stats ก็พอ
}

// คะแนนรีวิวเฉลี่ยของ "เจ้าของห้อง" (จากรีวิวห้องที่ตัวเองสร้าง)
$ratingOwner = [
  'avg'   => null,
  'count' => 0,
];

try {
  // สมมติใช้ตาราง reviews มีคอลัมน์: id, room_id, reviewer_id, rating, comment, created_at (และอาจมี status)
  // ถ้าระบบของคุณมีสถานะอนุมัติ ให้เพิ่ม AND r.status = 'approved'
  $qr = $db->prepare("
    SELECT 
      AVG(r.rating) AS avg_rating,
      COUNT(*)      AS cnt
    FROM raid_reviews r
    INNER JOIN raid_rooms rr ON rr.id = r.room_id
    WHERE rr.owner_id = :uid
      AND r.rating IS NOT NULL
  ");
  $qr->execute([':uid' => $userId]);
  $row = $qr->fetch();

  if ($row && (int)$row['cnt'] > 0) {
    $ratingOwner['avg']   = round((float)$row['avg_rating'], 2);
    $ratingOwner['count'] = (int)$row['cnt'];
  }
} catch (Throwable $e) {
  // เงียบไป ไม่ให้ 500 ทั้งเส้น
}


jsonResponse(true, [
  'user'  => $user,
  'stats' => $stats,
  'rating_owner' => $ratingOwner,
], 'โหลดโปรไฟล์สำเร็จ');
