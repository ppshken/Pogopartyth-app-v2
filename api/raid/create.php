<?php
// api/raid/create.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input = getJsonInput();

/**
 * อินพุตที่รองรับ
 * - boss: ชื่อบอส เช่น "Mewtwo" (ถ้าใช้ boss_id ก็รองรับได้เหมือนกัน)
 * - start_time: "YYYY-MM-DD HH:MM:SS" (เวลาไทย)
 * - max_members: int (2–20)
 * - note (ออปชัน): string
 */
$pokemon_image= isset($input['pokemon_image']) ? $input['pokemon_image'] : null;
$raid_boss_id= isset($input['raid_boss_id']) ? (int)$input['raid_boss_id'] : null;
$boss        = trim($input['boss'] ?? '');
$bossId      = isset($input['boss_id']) ? (int)$input['boss_id'] : null; // ถ้าคุณมีตารางบอส แยกเป็นตัวเลข
$start_time  = trim($input['start_time'] ?? '');
$max_members = (int)($input['max_members'] ?? 5);
$note        = trim($input['note'] ?? '');

if (($boss === '' && !$bossId) || $start_time === '' || $max_members < 2) {
  jsonResponse(false, null, 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', 422);
}

// ตรวจรูปแบบเวลา + ห้ามเป็นอดีต
$startTs = strtotime($start_time);
if ($startTs === false) {
  jsonResponse(false, null, 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD HH:MM:SS)', 422);
}
if ($startTs <= time()) {
  jsonResponse(false, null, 'เวลาเริ่มต้องอยู่ในอนาคต', 422);
}
if ($max_members > 20) {
  jsonResponse(false, null, 'จำนวนสมาชิกสูงสุดไม่เกิน 20', 422);
}

$db = pdo();

try {
  $db->beginTransaction();

  // ป้องกันสแปม: ไม่ให้เจ้าของสร้างห้องถี่เกินไป (เช่น 2 นาทีล่าสุด)
  $antiSpam = $db->prepare("
    SELECT id FROM raid_rooms 
    WHERE owner_id = :owner AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
    ORDER BY id DESC LIMIT 1
  ");
  $antiSpam->execute([':owner' => $userId]);
  if ($antiSpam->fetch()) {
    $db->rollBack();
    jsonResponse(false, null, 'คุณสร้างห้องถี่เกินไป ลองใหม่อีกครั้งภายใน 2 นาที', 429);
  }

  // ป้องกันสร้างห้องบอสซ้ำของตัวเอง (ยังไม่ปิด)
  $antiRaidboss = $db->prepare("
    SELECT r.id
    FROM raid_rooms r
    WHERE r.owner_id = :owner
      AND (
        (:raid_boss_id IS NOT NULL AND r.raid_boss_id = :raid_boss_id)
        OR
        (:raid_boss_id IS NULL AND r.boss IS NOT NULL AND LOWER(r.boss) = LOWER(:boss))
      )
      AND LOWER(r.status) NOT IN ('closed','canceled')
    ORDER BY r.id DESC
    LIMIT 1
  ");

  $antiRaidboss->execute([
    ':owner'        => $userId,
    ':raid_boss_id' => $raid_boss_id,            // อาจเป็น null ได้
    ':boss'         => $boss !== '' ? $boss : null,
  ]);

  if ($antiRaidboss->fetch()) {
    $db->rollBack();
    jsonResponse(false, null, 'คุณมีห้องของบอสนี้อยู่แล้ว กรุณาปิดห้องเดิม หรือยกเลิกก่อน', 409);
  }
  
  // สร้างห้อง
  $stmt = $db->prepare("
    INSERT INTO raid_rooms (raid_boss_id, pokemon_image, boss, start_time, max_members, status, owner_id, note, created_at)
    VALUES (:raid_boss_id, :pokemon_image, :boss, :start_time, :max_members, 'active', :owner_id, :note, :created_at)
  ");
  $stmt->execute([
    ':raid_boss_id'=> $raid_boss_id,
    ':pokemon_image'=> $pokemon_image,
    ':boss'        => $boss,
    ':start_time'  => $start_time,
    ':max_members' => $max_members,
    ':owner_id'    => $userId,
    ':note'        => $note ?: null,
    ':created_at'  => now(),
  ]);

  $roomId = (int)$db->lastInsertId();

  // Owner เข้าห้องเป็นสมาชิกทันที
  $stmt = $db->prepare("
    INSERT INTO user_raid_rooms (room_id, user_id, role, joined_at)
    VALUES (:room_id, :user_id, 'owner', :joined_at)
  ");
  $stmt->execute([
    ':room_id'   => $roomId,
    ':user_id'   => $userId,
    ':joined_at' => now(),
  ]);

  // ดึงข้อมูลห้องที่สร้างพร้อมจำนวนสมาชิกปัจจุบัน (=1)
  $detail = $db->prepare("
    SELECT
      r.id, r.raid_boss_id, r.pokemon_image, r.boss, r.start_time, r.max_members, r.status, r.owner_id, r.note, r.created_at,
      (SELECT COUNT(*) FROM user_raid_rooms ur WHERE ur.room_id = r.id) AS current_members
    FROM raid_rooms r
    WHERE r.id = :id
    LIMIT 1
  ");
  $detail->execute([':id' => $roomId]);
  $room = $detail->fetch();

  $db->commit();
  jsonResponse(true, ['room' => $room], 'สร้างห้องสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'เกิดข้อผิดพลาดในการสร้างห้อง', 500);
}
