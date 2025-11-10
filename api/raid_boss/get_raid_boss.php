<?php
// api/raid_boss/get_raid_boss.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$db = pdo();

/**
 * พารามิเตอร์
 * q           : string   คำค้นหาในชื่อบอส
 * pokemon_id  : int      กรองตามไอดี
 * all         : 0|1      ดึงทั้งหมด (ไม่แบ่งหน้า)
 */
$q          = trim((string)($_GET['q'] ?? ''));
$pokemonId  = (int)($_GET['pokemon_id'] ?? 0);
$isAll      = (int)($_GET['all'] ?? 0) === 1;

// เงื่อนไข: เฉพาะช่วงเวลาที่ active ในตอนนี้
$cond   = ['rb.start_date <= :now', 'rb.end_date >= :now'];
$params = [':now' => now()];

if ($q !== '') {
  $cond[]            = 'rb.pokemon_name LIKE :q';
  $params[':q']      = '%' . $q . '%';
}
if ($pokemonId > 0) {
  $cond[]               = 'rb.pokemon_id = :pid';
  $params[':pid']       = $pokemonId;
}

$where = $cond ? 'WHERE ' . implode(' AND ', $cond) : '';

// นับทั้งหมด
$countSql = "SELECT COUNT(*) FROM raid_boss rb $where";
$stmt = $db->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// ดึงรายการ
$sql = "
  SELECT
    rb.id,
    rb.pokemon_id,
    rb.pokemon_name,
    rb.pokemon_image,
    rb.pokemon_tier,
    rb.start_date,
    rb.end_date,
    rb.type,
    rb.special,
    rb.cp_normal_min,
    rb.cp_normal_max,
    rb.cp_boost_min,
    rb.cp_boost_max,
    rb.created_at
  FROM raid_boss rb
  $where
  ORDER BY rb.end_date ASC, rb.pokemon_tier DESC, rb.pokemon_name ASC
";

// โหมด all=1 (ดึงทั้งหมดที่ active ตอนนี้ เหมาะสำหรับ dropdown)
if ($isAll) {
  $stmt = $db->prepare($sql);
  foreach ($params as $k => $v) $stmt->bindValue($k, $v);
  $stmt->execute();
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // map key ชื่อ pokemin_image ให้ตรงตามที่ผู้ใช้ต้องการ
  $items = array_map(function(array $r) {
    return [
      'raid_boss_id'    => (int)$r['id'],
      'pokemon_id'    => (int)$r['pokemon_id'],
      'pokemon_name'  => $r['pokemon_name'],
      // mapping ชื่อคีย์ output -> pokemin_image
      'pokemon_image' => $r['pokemon_image'],
      'pokemon_tier' => $r['pokemon_tier'],
      'start_date'    => $r['start_date'],
      'end_date'      => $r['end_date'],
      'type'          => $r['type'],
      'special'       => $r['special'],
      'cp_normal_min' => (int)$r['cp_normal_min'],
      'cp_normal_max' => (int)$r['cp_normal_max'],
      'cp_boost_min'  => (int)$r['cp_boost_min'],
      'cp_boost_max'  => (int)$r['cp_boost_max'],
      'created_at'    => $r['created_at'],
    ];
  }, $rows);

  jsonResponse(true, [
    'items'        => $items,
    'page'         => 1,
    'limit'        => count($items),
    'total'        => $total,
    'total_pages'  => 1,
  ], 'ดึงรายชื่อ Raid Boss ที่กำลังจัดอยู่ (all=1) สำเร็จ');
  exit;
}

// โหมดแบ่งหน้า
[$page, $limit, $offset] = paginateParams();
$sql .= " LIMIT :limit OFFSET :offset";
$stmt = $db->prepare($sql);
foreach ($params as $k => $v) $stmt->bindValue($k, $v);
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$items = array_map(function(array $r) {
  return [
    'raid_boss_id'    => (int)$r['id'],
    'pokemon_id'    => (int)$r['pokemon_id'],
    'pokemon_name'  => $r['pokemon_name'],
    'pokemon_image' => $r['pokemon_image'], // map ชื่อคีย์ตามที่ขอ
    'pokemon_tier' => $r['pokemon_tier'],
    'start_date'    => $r['start_date'],
    'end_date'      => $r['end_date'],
    'type'          => $r['type'],
    'special'       => $r['special'],
    'cp_normal_min' => (int)$r['cp_normal_min'],
    'cp_normal_max' => (int)$r['cp_normal_max'],
    'cp_boost_min'  => (int)$r['cp_boost_min'],
    'cp_boost_max'  => (int)$r['cp_boost_max'],
    'created_at'    => $r['created_at'],
  ];
}, $rows);

jsonResponse(true, [
  'items'       => $items,
  'page'        => $page,
  'limit'       => $limit,
  'total'       => $total,
  'total_pages' => (int)ceil($total / $limit),
], 'ดึงรายชื่อ Raid Boss ที่กำลังจัดอยู่สำเร็จ');
