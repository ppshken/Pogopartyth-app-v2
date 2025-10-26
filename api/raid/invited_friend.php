<?php
// api/raid/join.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers.php';
cors();

/**
 * ส่ง Expo Push Notification แบบง่าย ๆ
 */
function sendExpoPush(string $to, string $title, string $body, array $data = []): bool
{
  if ($to === '') return false;

  $payload = json_encode([
    'to'    => $to,
    'title' => $title,
    'body'  => $body,
    'sound' => 'default',
    'data'  => $data,
  ], JSON_UNESCAPED_UNICODE);

  $ch = curl_init('https://exp.host/--/api/v2/push/send');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
      'Content-Type: application/json',
      'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_TIMEOUT        => 10,
  ]);

  $res  = curl_exec($ch);
  $err  = curl_error($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($err || $code >= 400) return false;

  // ถ้าอยากเช็คสถานะละเอียดขึ้น สามารถ parse $res ได้
  // $json = json_decode((string)$res, true);
  // return ($json['data']['status'] ?? null) === 'ok';

  return true; // ถือว่าสำเร็จถ้า HTTP 2xx และไม่มี error
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(false, null, 'Method not allowed', 405);
}

$userId = authGuard();
$input = getJsonInput();
$roomId = (int)($input['room_id'] ?? 0);
if ($roomId <= 0) {
  jsonResponse(false, null, 'room_id ไม่ถูกต้อง', 422);
}

$db = pdo();

try {

      if ($ownerToken !== '') {
        $title = 'มีสมาชิกใหม่เข้าร่วมห้อง';
        $body  = "{$joinerName} เข้าร่วมแล้ว (สมาชิก {$countAfter}/{$max})";
        $data  = [
          'type'     => 'raid_member_join',
          'room_id'  => $roomId,
          'user_id'  => (int)$userId,
          'owner_id' => $ownerId,
          'url'      => "pogopartyth://rooms/".$roomId,
          // ใส่เพิ่มได้ เช่น route ในแอพของคุณ
        ];

        // ยิง push (ไม่ทำให้ flow ล้มเหลวหากส่งไม่สำเร็จ)
        @sendExpoPush($ownerToken, $title, $body, $data);
      }
    } catch (\Throwable $e) {
      // เงียบไว้ ไม่ให้กระทบการตอบกลับหลัก
      // ถ้าต้องการ log ให้เพิ่มที่นี่ได้

  // ตอบกลับปกติ
  jsonResponse(true, ['room_id' => $roomId], 'เข้าร่วมห้องสำเร็จ', 201);

} catch (Throwable $e) {
  if ($db->inTransaction()) $db->rollBack();
  jsonResponse(false, null, 'เข้าร่วมห้องล้มเหลว', 500);
}
