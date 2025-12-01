<?php
// api/system/config.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php'; // ปรับ path ตามโครงสร้างจริงของคุณ
cors();

// 1. Handle Preflight & Method
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { jsonResponse(false, null, 'Method not allowed', 405); }

try {
    // Note: ไม่ใช้ authGuard() เพราะแอพต้องดึงค่านี้ได้ก่อน Login (เช่น เช็คปิดปรับปรุง)
    
    $db = pdo();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 2. ดึงข้อมูลจากตาราง system_configs (row id = 1 เท่านั้น)
    $sql = "SELECT * FROM system_configs WHERE id = 1 LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    // กรณีไม่มีข้อมูลใน DB (กัน Error) ให้สร้าง Default values
    if (!$config) {
        // หรือจะ return error 500 ก็ได้ แต่ return default ปลอดภัยกว่าแอพไม่เด้ง
        $config = []; 
    }

    // 3. จัด Format ข้อมูลเป็น Nested JSON (ตามที่ออกแบบไว้)
    // การใช้ (bool) หรือ ?? '' ช่วยป้องกันค่า null ที่อาจทำให้แอพพัง
    $data = [
        'maintenance' => [
            'is_active' => (bool)($config['maintenance_mode'] ?? 0),
            'message'   => $config['maintenance_message'] ?? 'ระบบกำลังปรับปรุง'
        ],
        'version_check' => [
            'android' => [
                'min_version' => $config['min_version_android'] ?? '1.0.0',
                'store_url'   => $config['store_url_android'] ?? ''
            ],
            'ios' => [
                'min_version' => $config['min_version_ios'] ?? '1.0.0',
                'store_url'   => $config['store_url_ios'] ?? ''
            ]
        ],
        'features' => [
            'ads_enabled'         => (bool)($config['enable_ads'] ?? 1),
            'vip_enables'         => (bool)($config['vip'] ?? 1),         
        ],
        'announcement' => [
            'show'  => (bool)($config['show_announcement'] ?? 0),
            'title' => $config['announcement_title'] ?? '',
            'body'  => $config['announcement_body'] ?? '',
            'link'  => $config['announcement_link'] ?? ''
        ],
        'general' => [
            'contact_line'   => $config['contact_line_id'] ?? '',
            'privacy_policy' => $config['privacy_policy_url'] ?? ''
        ]
    ];

    // 4. ส่งค่ากลับ
    jsonResponse(true, $data, 'Load config success', 200);

} catch (Throwable $e) {
    jsonResponse(false, null, 'server error: ' . $e->getMessage(), 500);
}