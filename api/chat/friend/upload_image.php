<?php
// api/upload_image.php
declare(strict_types=1);
require_once __DIR__ . '/../../helpers.php';

cors();

$me = authGuard();

// ตรวจไฟล์
if (!isset($_FILES['file'])) {
  jsonResponse(false, null, 'ไม่พบไฟล์ (field name = file)', 422);
}

$f = $_FILES['file'];
if (!is_uploaded_file($f['tmp_name'])) {
  jsonResponse(false, null, 'อัปโหลดไม่ถูกต้อง', 422);
}

$ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
$allowed = ['jpg','jpeg','png','gif','webp'];
if (!in_array($ext, $allowed, true)) {
  jsonResponse(false, null, 'ชนิดไฟล์ไม่รองรับ', 422);
}
if ($f['size'] > 5 * 1024 * 1024) { // 5MB
  jsonResponse(false, null, 'ไฟล์ใหญ่เกิน 5MB', 422);
}

// สร้างชื่อไฟล์
$baseDir = realpath(__DIR__ . '/../../uploads');
if ($baseDir === false) {
  // ถ้าไม่มีโฟลเดอร์ ให้พยายามสร้าง
  $try = __DIR__ . '/../../uploads';
  if (!is_dir($try)) mkdir($try, 0775, true);
  $baseDir = realpath($try);
}
if ($baseDir === false) {
  jsonResponse(false, null, 'ไม่สามารถสร้างโฟลเดอร์ uploads ได้', 500);
}

$fname = 'dm_' . $me . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$dest  = $baseDir . DIRECTORY_SEPARATOR . $fname;

if (!move_uploaded_file($f['tmp_name'], $dest)) {
  jsonResponse(false, null, 'บันทึกไฟล์ไม่สำเร็จ', 500);
}

// URL ของไฟล์ (ปรับ BASE_URL ให้ตรงโดเมนจริง)
$baseUrl = (isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'https') . '://' . ($_SERVER['HTTP_HOST'] ?? 'example.com');
$imageUrl = $baseUrl . '/uploads/chat_image/' . $fname;

jsonResponse(true, ['url' => $imageUrl], 'อัปโหลดสำเร็จ');
