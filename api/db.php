<?php
// db.php
declare(strict_types=1);

function pdo(): PDO {
    
    static $pdo = null; // cache connection
    if ($pdo) return $pdo;

    $host = '127.0.0.1'; // ที่ห้อง
    //$host = 'localhost'; // ที่ทำงาน

    $db   = 'pogopartyth_v1'; // ที่ห้อง
    //$db   = 'pogopartyth_v2'; // ที่ทำงาน

    $user = 'root';
    $pass = '';

    $dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec("SET time_zone = '+07:00'");
        return $pdo;
    } catch (PDOException $e) {
        die("DB Connection failed: " . $e->getMessage());
    }
}
?>