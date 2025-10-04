<?php // api/auth/update_device_token.php 
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}
$userId = authGuard(); // ต้องส่ง Authorization: Bearer <token> 
$input = getJsonInput();
$deviceToken = trim($input['device_token'] ?? '');
if ($deviceToken === '') {
  jsonResponse(false, null, 'device_token ว่าง', 422);
} // (อาจตรวจรูปแบบ token เพิ่มเติมก็ได้ เช่น เริ่มด้วย "ExpoPushToken[" หรือ "ExponentPushToken[...]") 
$db = pdo();
$stm = $db->prepare("UPDATE users SET device_token = :t WHERE id = :id");
$stm->execute([':t' => $deviceToken, ':id' => $userId]);
jsonResponse(true, null, 'อัปเดต device_token สำเร็จ');


