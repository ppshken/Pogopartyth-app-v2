<?php
// api/premium/verify_google_play.php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../vendor/autoload.php'; // จาก composer
cors();

use Google_Client;
use Google_Service_AndroidPublisher;

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

// user ต้องล็อกอิน
$userId = authGuard();
if (!$userId) {
  jsonResponse(false, null, 'Unauthorized', 401);
}

// input จากแอพ
/**
 * คาดหวัง JSON ประมาณนี้:
 * {
 *   "package_name": "com.pogopartyth.app",
 *   "product_id": "premium_monthly",   // หรือชื่อ product/sub ที่ตั้งใน Play
 *   "purchase_token": "XXXX",
 *   "purchase_type": "subs"            // "subs" = subscription, "inapp" = one-time
 * }
 */
$input = getJsonInput();

$packageName   = trim((string)($input['package_name'] ?? ''));
$productId     = trim((string)($input['product_id'] ?? ''));
$purchaseToken = trim((string)($input['purchase_token'] ?? ''));
$purchaseType  = trim((string)($input['purchase_type'] ?? 'subs')); // subs|inapp

if ($packageName === '' || $productId === '' || $purchaseToken === '') {
  jsonResponse(false, null, 'ข้อมูลไม่ครบ (package_name, product_id, purchase_token)', 422);
}

// ---------- ตั้งค่า Google Client ----------
$serviceAccountPath = __DIR__ . '/../pogopartyth-478605-b9b3ca2fee78.json';
if (!file_exists($serviceAccountPath)) {
  jsonResponse(false, null, 'Server ยังไม่ได้ตั้งค่า Service Account', 500);
}

$client = new Google_Client();
$client->setApplicationName('PogoPartyTH Backend');
$client->setAuthConfig($serviceAccountPath);
$client->setScopes(['https://www.googleapis.com/auth/androidpublisher']);

$service = new Google_Service_AndroidPublisher($client);

$db = pdo();

try {
  $tz  = new DateTimeZone('Asia/Bangkok');
  $now = new DateTimeImmutable('now', $tz);
  $nowStr = $now->format('Y-m-d H:i:s');

  if ($purchaseType === 'subs') {
    // --------- Subscription (รายเดือน/ปี) ---------
    $result = $service->purchases_subscriptions->get(
      $packageName,
      $productId,
      $purchaseToken
    );

    // เวลาหมดอายุ (ms)
    $expiryMs = (int)$result->getExpiryTimeMillis();
    if ($expiryMs <= 0) {
      jsonResponse(false, null, 'ไม่พบ expiryTimeMillis จาก Google', 400);
    }

    $expiryTs = (int) floor($expiryMs / 1000);
    $expiryDt = (new DateTimeImmutable('@' . $expiryTs))->setTimezone($tz);
    $planExpiresAt = $expiryDt->format('Y-m-d H:i:s');

    // ถ้าหมดอายุแล้ว
    if ($expiryDt <= $now) {
      jsonResponse(false, [
        'plan_expires_at' => $planExpiresAt,
      ], 'รายการ subscription นี้หมดอายุแล้ว', 400);
    }

    // ใช้ product_id เป็นชื่อแผน หรือจะ fix เป็น 'premium' ก็ได้
    $plan = 'premium';

    $db->beginTransaction();

    $q = $db->prepare("
      UPDATE users
      SET 
        plan = :plan,
        plan_expires_at = :plan_expires_at,
        premium_since = CASE
          WHEN premium_since IS NULL THEN :premium_since
          ELSE premium_since
        END
      WHERE id = :id
    ");
    $q->execute([
      ':plan'            => $plan,
      ':plan_expires_at' => $planExpiresAt,
      ':premium_since'   => $nowStr,
      ':id'              => $userId,
    ]);

    $q2 = $db->prepare("
      SELECT id, username, email, plan, plan_expires_at, premium_since
      FROM users
      WHERE id = :id
    ");
    $q2->execute([':id' => $userId]);
    $user = $q2->fetch(PDO::FETCH_ASSOC);

    $db->commit();

    jsonResponse(true, [
      'user' => $user,
      // จะเอาไว้ debug ก่อนก็ได้ แล้วค่อยตัดออกใน production
      'google_raw' => [
        'expiryTimeMillis' => $expiryMs,
      ],
    ], 'ยืนยัน premium (subscription) สำเร็จ');

  } else {
    // --------- In-app (ซื้อครั้งเดียว / lifetime) ---------
    $result = $service->purchases_products->get(
      $packageName,
      $productId,
      $purchaseToken
    );

    // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
    $purchaseState = (int)$result->getPurchaseState();
    if ($purchaseState !== 0) {
      jsonResponse(false, [
        'purchase_state' => $purchaseState,
      ], 'สถานะการซื้อไม่ใช่ purchased', 400);
    }

    $plan          = 'premium';
    $planExpiresAt = null; // lifetime

    $db->beginTransaction();

    $q = $db->prepare("
      UPDATE users
      SET 
        plan = :plan,
        plan_expires_at = :plan_expires_at,
        premium_since = CASE
          WHEN premium_since IS NULL THEN :premium_since
          ELSE premium_since
        END
      WHERE id = :id
    ");
    $q->bindValue(':plan', $plan, PDO::PARAM_STR);
    if ($planExpiresAt === null) {
      $q->bindValue(':plan_expires_at', null, PDO::PARAM_NULL);
    } else {
      $q->bindValue(':plan_expires_at', $planExpiresAt, PDO::PARAM_STR);
    }
    $q->bindValue(':premium_since', $nowStr, PDO::PARAM_STR);
    $q->bindValue(':id', $userId, PDO::PARAM_INT);
    $q->execute();

    $q2 = $db->prepare("
      SELECT id, username, email, plan, plan_expires_at, premium_since
      FROM users
      WHERE id = :id
    ");
    $q2->execute([':id' => $userId]);
    $user = $q2->fetch(PDO::FETCH_ASSOC);

    $db->commit();

    jsonResponse(true, [
      'user'           => $user,
      'purchase_state' => $purchaseState,
    ], 'ยืนยัน premium (ซื้อครั้งเดียว) สำเร็จ');
  }
} catch (Throwable $e) {
  if ($db->inTransaction()) {
    $db->rollBack();
  }
  error_log('verify_google_play error: ' . $e->getMessage());
  jsonResponse(false, null, 'ยืนยันกับ Google Play ไม่สำเร็จ', 500);
}
