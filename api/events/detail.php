<?php
// api/events/detail.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
cors();

// 1. ตรวจสอบสิทธิ์ (ตามสไตล์ไฟล์เดิม)
// ถ้าต้องการให้คนทั่วไปดูได้โดยไม่ต้อง Login ให้ Comment ส่วนนี้ออกครับ
$authUserId = authGuard();
/*
if (!$authUserId) {
    jsonResponse(false, null, 'Unauthorized', 401);
}
*/

try {
    $db = pdo();

    // 2. รับค่า ID จาก URL Parameter (GET)
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    // ถ้าไม่มี ID หรือ ID เป็น 0 ให้แจ้ง Error
    if ($id <= 0) {
        jsonResponse(false, null, 'ระบุรหัสกิจกรรมไม่ถูกต้อง (Invalid ID)', 400);
    }

    // 3. เตรียม SQL Query
    // เลือกฟิลด์ให้ตรงกับ Type Events ใน React Native
    $sql = "
        SELECT 
            e.id,
            e.title,
            e.description,
            e.image,
            e.created_at,
            -- แปลง id ผู้สร้าง เป็นชื่อ username เพื่อนำไปโชว์
            COALESCE(u.username, 'Admin') AS created_by,
            u.avatar AS creator_avatar
        FROM events e
        LEFT JOIN users u ON u.id = e.created_by
        WHERE e.id = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute([':id' => $id]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    // 4. ตรวจสอบว่าพบข้อมูลไหม
    if (!$item) {
        jsonResponse(false, null, 'ไม่พบข้อมูลกิจกรรมนี้ หรือกิจกรรมอาจถูกลบไปแล้ว', 404);
    }

    // 5. ส่ง JSON กลับ
    // โครงสร้าง: success, message, data (เป็น Object ก้อนเดียว)
    echo json_encode([
        'success' => true,
        'message' => 'ดึงรายละเอียดกิจกรรมสำเร็จ',
        'data'    => $item
    ]);

} catch (Throwable $e) {
    // กรณี Server Error
    jsonResponse(false, null, 'Server Error: ' . $e->getMessage(), 500);
}