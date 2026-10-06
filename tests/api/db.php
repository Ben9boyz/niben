<?php
// Small helper for the API tests: php tests/api/db.php <command> …   (reads the test copy's _config.php)
//   reset                 – drop every table (a clean database)
//   connect <uid>         – make that room look like it is connected to Spotify
//   kv <uid> <key>        – print a stored value
//   sql <query>           – run a query, print the rows as JSON
//   exec <statement>      – run a statement that returns nothing
$dir = getenv('NIBEN_TEST_DIR') ?: exit("NIBEN_TEST_DIR is not set\n");
$c = require "$dir/_config.php";
if (strpos($c['db_name'], 'test') === false) exit("refusing to touch a database that is not a test database\n");
$pdo = new PDO("mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4", $c['db_user'], $c['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$cmd = $argv[1] ?? '';
$key = fn(int $uid, string $k) => $uid === 1 ? $k : "u{$uid}_$k";
if ($cmd === 'reset') {
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) $pdo->exec("DROP TABLE `$t`");
} elseif ($cmd === 'connect') {
    $uid = (int)$argv[2];
    $pdo->exec('CREATE TABLE IF NOT EXISTS spotify_state (k VARCHAR(40) NOT NULL, v MEDIUMTEXT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (k)) ENGINE=InnoDB');
    $st = $pdo->prepare('REPLACE INTO spotify_state (k, v) VALUES (?, ?)');
    foreach (['refresh_token' => 'rt', 'access_token' => 'at', 'access_expires' => '9999999999', 'scopes' => 'user-library-read'] as $k => $v) $st->execute([$key($uid, $k), $v]);
} elseif ($cmd === 'kv') {
    $st = $pdo->prepare('SELECT v FROM spotify_state WHERE k = ?');
    $st->execute([$key((int)$argv[2], $argv[3])]);
    echo json_encode($st->fetchColumn() ?: null);
} elseif ($cmd === 'exec') {
    $pdo->exec($argv[2]);
} elseif ($cmd === 'sql') {
    echo json_encode($pdo->query($argv[2])->fetchAll());
} else {
    exit("unknown command\n");
}
