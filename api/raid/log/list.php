<?php
// api/raid/log/list.php
declare(strict_types=1);

require_once __DIR__ . '/../../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { jsonResponse(false, null, 'Method not allowed', 405); }

try {
  $room_id = (int)($_GET['room_id'] ?? 0);
  $page    = (int)($_GET['page'] ?? 1);
  $limit   = (int)($_GET['limit'] ?? 20);
  $type    = trim((string)($_GET['type'] ?? ''));
  $order   = strtoupper((string)($_GET['order'] ?? 'DESC')); // ASC|DESC

  if ($room_id <= 0) jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
  if ($page < 1) $page = 1;
  if ($limit < 1) $limit = 1;
  if ($limit > 100) $limit = 100;
  if ($order !== 'ASC' && $order !== 'DESC') $order = 'DESC';

  $offset = ($page - 1) * $limit;

  $where   = ['rl.room_id = :room_id'];
  $params  = [':room_id' => $room_id];

  if ($type !== '') {
    $where[] = 'rl.type = :type';
    $params[':type'] = $type;
  }
  $whereSql = implode(' AND ', $where);

  $db = pdo();

  // ดึง limit+1 แถว เพื่อตรวจ has_more
  $sql = "
    SELECT
      rl.id,
      rl.room_id,
      rl.user_id,
      rl.type,
      rl.description,
      rl.created_at,
      u.username AS username,           -- ✅ เพิ่ม username
      u.avatar   AS avatar              -- (เผื่อใช้งานแสดงรูป)
    FROM raid_rooms_log rl
    LEFT JOIN users u ON u.id = rl.user_id
    WHERE $whereSql
    ORDER BY rl.id $order
    LIMIT :limit_plus
    OFFSET :offset
  ";

  $stmt = $db->prepare($sql);
  foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
  $stmt->bindValue(':limit_plus', $limit + 1, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();

  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
  $has_more = false;
  if (count($rows) > $limit) {
    $has_more = true;
    array_pop($rows);
  }

  jsonResponse(true, [
    'list' => $rows,
    'pagination' => ['page' => $page, 'has_more' => $has_more],
  ], 'ok', 200);

} catch (Throwable $e) {
  jsonResponse(false, null, 'โหลดไม่สำเร็จ (server error)', 500);
}
