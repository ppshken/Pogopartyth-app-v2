<?php
// api/friends/search.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

const APP_DEBUG = true; // เปลี่ยนเป็น false เมื่อขึ้นจริง

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

try {
  if (APP_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
  }

  $authUserId = authGuard();

  // ---- รับพารามิเตอร์ ----
  $q     = trim((string)($_GET['q'] ?? ''));
  $page  = max(1, (int)($_GET['page'] ?? 1));
  $limit = (int)($_GET['limit'] ?? 20);
  if ($limit < 1)  $limit = 20;
  if ($limit > 50) $limit = 50;
  $offset = ($page - 1) * $limit;

  $pdo = pdo();
  // $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // ---- where / params ----
  $where   = ['u.id <> :me AND u.role = "member" AND u.setup_status = "yes"'];
  $params  = [':me' => $authUserId];

  if ($q !== '') {
    $kw = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
    $where[] = '(u.username LIKE :kw OR u.friend_code LIKE :kw)';
    $params[':kw'] = $kw;
  }

  $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

  // ---- นับรวม ----
  $sqlCount = "SELECT COUNT(*) FROM users u $whereSql";
  $stmt = $pdo->prepare($sqlCount);
  foreach ($params as $k => $v) {
    $stmt->bindValue($k, $v, $k === ':me' ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $stmt->execute();
  $total = (int)$stmt->fetchColumn();

  // ---- ดึงรายการ + เรตติ้งเฉลี่ยที่ได้รับในฐานะเจ้าของห้อง ----
  // หมายเหตุ: ถ้ามีสถานะรีวิว ให้เติม AND r.status = 'approved'
  $sql = "
    SELECT 
      u.id, u.username, u.email, u.avatar, u.friend_code, u.team, u.level,
      -- ค่าเรตติ้งรวมต่อเจ้าของห้อง (จากรีวิวของแต่ละห้องที่เขาสร้าง)
      ROUND(ro.avg_rating, 2)   AS owner_avg_rating,
      COALESCE(ro.cnt_rating,0) AS owner_rating_count
    FROM users u
    LEFT JOIN (
      SELECT 
        rr.owner_id AS uid,
        AVG(r.rating) AS avg_rating,
        COUNT(*)      AS cnt_rating
      FROM raid_reviews r
      INNER JOIN raid_rooms rr ON rr.id = r.room_id
      WHERE r.rating IS NOT NULL
      GROUP BY rr.owner_id
    ) ro ON ro.uid = u.id
    $whereSql
    ORDER BY u.username ASC
    LIMIT :limit OFFSET :offset
  ";

  $stmt = $pdo->prepare($sql);
  foreach ($params as $k => $v) {
    $stmt->bindValue($k, $v, $k === ':me' ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();

  $rows = [];
  while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    // friend code mask
    $masked = null;
    if (!empty($r['friend_code'])) {
      $digits = preg_replace('/\D+/', '', (string)$r['friend_code']);
      $masked = strlen($digits) >= 4
        ? str_repeat('•', max(0, strlen($digits) - 4)) . substr($digits, -4)
        : $r['friend_code'];
    }

    $avg  = $r['owner_avg_rating'] !== null ? (float)$r['owner_avg_rating'] : null;
    $cnt  = (int)$r['owner_rating_count'];

    $rows[] = [
      'id'                 => (int)$r['id'],
      'username'           => $r['username'],
      'avatar'             => $r['avatar'],
      'friend_code_masked' => $masked,
      'team'               => $r['team'],
      'level'              => (int)$r['level'],
      'rating_owner'       => (float)$r['owner_avg_rating'] ,
    ];
  }

  $totalPages = (int)ceil($total / $limit);
  $hasMore = $page < $totalPages;

  jsonResponse(true, [
    'data' => $rows,
    'pagination' => [
      'page'        => $page,
      'limit'       => $limit,
      'total'       => $total,
      'total_pages' => $totalPages,
      'has_more'    => $hasMore,
      'next_page'   => $hasMore ? $page + 1 : null,
    ]
  ], 'ค้นหาเพื่อนสำเร็จ');

} catch (Throwable $e) {
  if (APP_DEBUG) {
    jsonResponse(false, null, 'ERR500: ' . $e->getMessage(), 500);
  } else {
    jsonResponse(false, null, 'Internal Server Error', 500);
  }
}
