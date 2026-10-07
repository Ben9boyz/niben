<?php
/**
 * niben.no – innholds-API (reiser, bøker, gitaropptak).
 *
 *   GET  api.php?action=content            offentlig: alt innhold som JSON
 *   GET  api.php?action=me                 er jeg logget inn?
 *   POST api.php?action=login|logout
 *   POST api.php?action=trip_save|trip_delete|photo_upload|photo_delete
 *   POST api.php?action=book_save|book_delete
 *   POST api.php?action=recording_save|recording_delete
 *
 * Tilgangene ligger i _config.php (lages av ./setup.sh og lastes opp sammen med siden).
 * Alle endringer krever innlogging + headeren "X-Niben: 1" (hindrer forespørsler fra andre sider).
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header_remove('X-Powered-By');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES = 60 * 1024 * 1024;
const PHOTO_MAX_EDGE  = 2400;

function out($data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $status = 400): never { out(['error' => $msg], $status); }

$configFile = __DIR__ . '/_config.php';
if (!is_file($configFile)) fail('Serveren er ikke satt opp ennå (mangler _config.php).', 503);
$config = require $configFile;

// ── Database ─────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    global $config;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_name']),
            $config['db_user'],
            $config['db_pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $e) {
        error_log('niben db: ' . $e->getMessage());
        fail('Kunne ikke koble til databasen.', 500);
    }
    return $pdo;
}

function ensure_schema(): void {
    $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS trips (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, country VARCHAR(80) NOT NULL, place VARCHAR(160) NULL,
  title VARCHAR(200) NOT NULL, year SMALLINT NULL, date_from DATE NULL, date_to DATE NULL, body TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_trips_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS trip_photos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, trip_id INT UNSIGNED NOT NULL, path VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NULL, width SMALLINT UNSIGNED NULL, height SMALLINT UNSIGNED NULL, sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_photos_trip (trip_id),
  CONSTRAINT fk_photos_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS books (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, title VARCHAR(255) NOT NULL, author VARCHAR(255) NULL,
  isbn VARCHAR(20) NULL, ol_key VARCHAR(40) NULL, cover_url VARCHAR(255) NULL, published_year SMALLINT NULL,
  pages SMALLINT UNSIGNED NULL, read_on DATE NULL, rating TINYINT UNSIGNED NULL, thoughts TEXT NULL, quote TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS recordings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, guitar VARCHAR(60) NOT NULL, title VARCHAR(200) NOT NULL,
  recorded_on DATE NULL, youtube VARCHAR(20) NULL, audio_path VARCHAR(255) NULL, notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_rec_guitar (guitar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS login_attempts (
  ip VARCHAR(45) NOT NULL, attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL;
    // one statement at a time (some hosts disable multi-statements)
    foreach (array_filter(array_map('trim', explode(";\n", $sql))) as $stmt) {
        db()->exec(rtrim($stmt, ';'));
    }
}

// ── Session / auth ────────────────────────────────────────
session_name('niben_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax', // Lax so the session survives the redirect back from Spotify; writes still need X-Niben
]);
session_start();

function is_admin(): bool {
    return !empty($_SESSION['admin']) && ($_SESSION['expires'] ?? 0) > time();
}
/** The owner (me) only. Whatever room is being shown, the settings it touches are the owner's own. */
function require_admin(): void {
    if (!is_admin()) fail('Du må logge inn.', 401);
    if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
    $_SESSION['expires'] = time() + 60 * 60 * 8; // sliding 8 h
    kv_scope(1);
}
function client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0'), 0, 45); }

// ── Input helpers ─────────────────────────────────────────
function body(): array {
    static $b = null;
    if ($b !== null) return $b;
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_starts_with($ct, 'application/json')) {
        $b = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
    } else {
        $b = $_POST;
    }
    return $b;
}
function str_or_null($v, int $max): ?string {
    if ($v === null) return null;
    $v = trim((string)$v);
    if ($v === '') return null;
    return mb_substr($v, 0, $max);
}
function int_or_null($v, int $min, int $max): ?int {
    if ($v === null || $v === '') return null;
    if (!is_numeric($v)) return null;
    $n = (int)$v;
    return ($n < $min || $n > $max) ? null : $n;
}
function date_or_null($v): ?string {
    $v = str_or_null($v, 10);
    if ($v === null) return null;
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return ($d && $d->format('Y-m-d') === $v) ? $v : null;
}
function youtube_id($v): ?string {
    $v = str_or_null($v, 300);
    if ($v === null) return null;
    if (preg_match('~(?:v=|youtu\.be/|embed/|shorts/)([\w-]{11})~', $v, $m)) return $m[1];
    return preg_match('~^[\w-]{11}$~', $v) ? $v : null;
}
function https_url_or_null($v): ?string {
    $v = str_or_null($v, 255);
    if ($v === null) return null;
    return preg_match('~^(https://[^\s"<>]+|uploads/[\w./-]+)$~', $v) ? $v : null;
}

// ── Uploads ───────────────────────────────────────────────
// Extra upload helpers (clearer error messages, audio format sniffing) live in their own file.
// If it is missing, simple fallbacks keep everything working.
@include __DIR__ . '/_upload.inc.php';
if (function_exists('check_request_size')) check_request_size();
if (!function_exists('upload_error')) {
    function upload_error(int $code): string { return 'Opplastingen feilet (kode ' . $code . ').'; }
}
if (!function_exists('sniff_audio')) {
    function sniff_audio(string $path): ?string { return null; }
}
function upload_dir(string $sub): string {
    $base = __DIR__ . '/uploads';
    if (!is_dir($base)) {
        mkdir($base, 0755, true);
        // never execute anything in uploads/
        file_put_contents($base . '/.htaccess', "Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar|pl|py|cgi|sh)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    $dir = $base . '/' . $sub;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}
function random_name(string $ext): string { return bin2hex(random_bytes(10)) . '.' . $ext; }

/** Re-encodes the image (drops EXIF/GPS) and limits its size. Returns [path, w, h]. */
function save_photo(array $file): array {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail(upload_error((int)($file['error'] ?? UPLOAD_ERR_NO_FILE)));
    if ($file['size'] > MAX_PHOTO_BYTES) fail('Bildet er for stort.');
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) fail('Kun JPEG, PNG eller WebP.');
    $src = match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($file['tmp_name']),
        IMAGETYPE_PNG => @imagecreatefrompng($file['tmp_name']),
        IMAGETYPE_WEBP => @imagecreatefromwebp($file['tmp_name']),
    };
    if (!$src) fail('Kunne ikke lese bildet.');
    [$w, $h] = [$info[0], $info[1]];
    $scale = min(1, PHOTO_MAX_EDGE / max($w, $h));
    $nw = max(1, (int)round($w * $scale));
    $nh = max(1, (int)round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $name = random_name('jpg');
    $path = upload_dir('photos') . '/' . $name;
    imagejpeg($dst, $path, 84);
    imagedestroy($src);
    imagedestroy($dst);
    return ['uploads/photos/' . $name, $nw, $nh];
}

function save_audio(array $file): string {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail(upload_error((int)($file['error'] ?? UPLOAD_ERR_NO_FILE)));
    if ($file['size'] > MAX_AUDIO_BYTES) fail('Lydfilen er for stor (maks 60 MB).');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
    $ext = match ($mime) {
        'audio/mpeg', 'audio/mp3' => 'mp3',
        'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'video/mp4' => 'm4a',
        'audio/aac', 'audio/x-hx-aac-adts' => 'aac',
        'audio/wav', 'audio/x-wav', 'audio/wave' => 'wav',
        'audio/ogg', 'application/ogg' => 'ogg',
        'audio/webm', 'video/webm' => 'webm',
        'audio/flac', 'audio/x-flac' => 'flac',
        default => null,
    } ?? sniff_audio($file['tmp_name']);
    if (!$ext) fail('Ukjent lydformat (' . $mime . '). Bruk MP3, M4A, WAV, OGG eller FLAC.');
    $name = random_name($ext);
    if (!move_uploaded_file($file['tmp_name'], upload_dir('audio') . '/' . $name)) fail('Kunne ikke lagre lydfilen.', 500);
    return 'uploads/audio/' . $name;
}

function delete_upload(?string $rel): void {
    if (!$rel || !preg_match('~^uploads/(photos|audio)/[a-f0-9]{20}\.[a-z0-9]{2,4}$~', $rel)) return;
    $p = __DIR__ . '/' . $rel;
    if (is_file($p)) @unlink($p);
}

// ── Routing ───────────────────────────────────────────────
$action = (string)($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') fail('Metode ikke tillatt.', 405);
$post = $method === 'POST';

require_once __DIR__ . '/_guard.inc.php';
require_once __DIR__ . '/_spotify.inc.php';
require_once __DIR__ . '/_users.inc.php';
kv_scope(room_resolve()); // the room this request is about (the owner's unless a cookie / a logged-in user says otherwise)
if (($_COOKIE['niben_r'] ?? '') !== (string)kv_scope()) room_cookie(kv_scope());
guard_request($action);
require_once __DIR__ . '/_spotify_more.inc.php';
require_once __DIR__ . '/_jpdb.inc.php';
require_once __DIR__ . '/_songs.inc.php';
require_once __DIR__ . '/_steam.inc.php';
require_once __DIR__ . '/_about.inc.php';
require_once __DIR__ . '/_site.inc.php';
require_once __DIR__ . '/_github.inc.php';
require_once __DIR__ . '/_translate.inc.php';
require_once __DIR__ . '/_visits.inc.php';
require_once __DIR__ . '/_milestones.inc.php';
require_once __DIR__ . '/_home.inc.php';
require_once __DIR__ . '/_extras.inc.php';
require_once __DIR__ . '/_discover.inc.php';
require_once __DIR__ . '/_decor.inc.php';
require_once __DIR__ . '/_modules.inc.php';
require_once __DIR__ . '/_strava.inc.php';
require_once __DIR__ . '/_cleanup.inc.php';
require_once __DIR__ . '/_news.inc.php';

try {
    if (in_array($action, ['user_register', 'user_login', 'rooms', 'rooms_find', 'room_set', 'me_settings', 'me_password', 'me_email', 'me_delete', 'user_forgot', 'user_reset', 'admin_users', 'admin_user_set'], true)) { users_handle($action, $post); fail('Ukjent handling.', 404); }
    if (in_array($action, ['guitar_save', 'guitar_delete'], true)) { users_ready(); guitars_handle($action, $post); fail('Ukjent handling.', 404); }
    if (str_starts_with($action, 'spotify_')) {
        sp_more_handle($action, $post);
        sp_handle($action, $post);
        fail('Ukjent handling.', 404);
    }
    if (str_starts_with($action, 'song_')) {
        songs_handle($action, $post);
        fail('Ukjent handling.', 404);
    }
    if (str_starts_with($action, 'jpdb_')) {
        jp_handle($action, $post);
        fail('Ukjent handling.', 404);
    }
    if (str_starts_with($action, 'about_')) {
        about_handle($action, $post);
        fail('Ukjent handling.', 404);
    }
    if (str_starts_with($action, 'steam_')) {
        st_handle($action, $post);
        fail('Ukjent handling.', 404);
    }
    if (str_starts_with($action, 'github_')) {
        gh_handle($action);
        fail('Ukjent handling.', 404);
    }
    if ($action === 'translate') tr_handle();
    if (str_starts_with($action, 'news_') || $action === 'feed') { nw_handle($action, $post); fail('Ukjent handling.', 404); }
    if ($action === 'admin_cleanup') { cleanup_handle($action, $post); fail('Ukjent handling.', 404); }
    if (str_starts_with($action, 'strava_')) { strava_handle($action, $post); fail('Ukjent handling.', 404); }
    if (str_starts_with($action, 'mod_')) { mod_handle($action, $post); fail('Ukjent handling.', 404); }
    if (str_starts_with($action, 'decor_')) { decor_handle($action, $post); fail('Ukjent handling.', 404); }
    if (str_starts_with($action, 'discover_')) { dc_handle($action, $post); fail('Ukjent handling.', 404); }
    if ($action === 'texts_save') {
        // the site's own wording (headings, intro lines …): { texts: { key: text } }. An empty text = back to the default.
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $in = (array)(body()['texts'] ?? []);
        $clean = [];
        foreach (array_slice($in, 0, 400, true) as $k => $v) {
            if (!is_string($k) || !preg_match('~^[a-z0-9_.]{1,60}$~', $k) || !is_string($v)) continue;
            $v = mb_substr(trim($v), 0, 1500);
            if ($v !== '') $clean[$k] = $v;
        }
        kv_set('site_texts', json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'texts' => (object)$clean]);
    }
    if (in_array($action, ['guestbook_list', 'guestbook_add', 'admin_guestbook', 'admin_guestbook_set', 'practice_calendar', 'wrapped', 'admin_backup'], true)) ex_handle($action, $post);
    if (in_array($action, ['home_live', 'home_search', 'home_set', 'home_get'], true)) hm_handle($action, $post);
    if ($action === 'milestones' || $action === 'milestone_add' || $action === 'milestone_delete') ms_handle($action, $post);
    if ($action === 'visit') {
        if (!$post || ($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') out(['ok' => false]);
        vi_count((string)(body()['path'] ?? ''));
        out(['ok' => true]);
    }
    if ($action === 'admin_visits') { require_admin(); out(vi_stats()); }
    if ($action === 'admin_status') {
        require_admin();
        $count = function (string $t) { try { return (int)db()->query("SELECT COUNT(*) FROM $t")->fetchColumn(); } catch (Throwable $e) { return 0; } };
        $cfgSteam = function_exists('st_config') ? (bool)st_config() : false;
        $cfgJp = function_exists('jp_config') ? (bool)jp_config() : false;
        $sp = (bool)kv_get('refresh_token');
        out([
            'counts' => ['trips' => $count('trips'), 'books' => $count('books'), 'recordings' => $count('recordings'), 'photos' => $count('trip_photos')],
            'spotify' => ['connected' => $sp, 'lock_seconds' => $sp ? sp_lock_seconds() : null, 'can_save' => $sp && sp_has_scope('user-library-modify'), 'can_playlists' => $sp && sp_has_scope('playlist-modify-private')],
            'steam' => $cfgSteam, 'jpdb' => $cfgJp,
            'translate' => tr_admin_status(),
        ]);
    }
    if ($action === 'admin_best_friend') {
        require_admin();
        if (!$post) out(['id' => kv_get('st_best_friend') ?: ST_BEST_FRIEND]);
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $v = trim((string)($b['id'] ?? ''));
        if (preg_match('~/profiles/(\d{17})~', $v, $m)) $v = $m[1];
        if ($v !== '' && !preg_match('~^\d{17}$~', $v)) fail('Bruk den 17-sifrede Steam-ID-en eller lenken til profilen (…/profiles/7656…).', 400);
        kv_set('st_best_friend', $v === '' ? null : $v);
        kv_del('st_friends'); // forget what was cached so it shows at once
        out(['ok' => true, 'id' => $v ?: ST_BEST_FRIEND]);
    }
    if ($action === 'admin_translate_clear') {
        require_admin();
        if (!$post) fail('Bruk POST.', 405);
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $l = (string)($b['lang'] ?? '');
        if ($l !== '' && !preg_match('~^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$~', $l)) fail('Ugyldig språk.', 400);
        tr_admin_clear($l);
        out(['ok' => true]);
    }
    switch ($action) {

    case 'content': {
        try { site_ensure_htaccess(); } catch (Throwable $e) { error_log('niben htaccess: ' . $e->getMessage()); }
        $pdo = db();
        $room = kv_scope(); // whose room this is (1 = mine)
        try {
            users_ready();
            $tq = $pdo->prepare('SELECT id, country, place, title, year, date_from, date_to, body FROM trips WHERE user_id = ? ORDER BY COALESCE(date_from, MAKEDATE(year, 1)) DESC, id DESC');
            $tq->execute([$room]);
            $trips = $tq->fetchAll();
        } catch (PDOException $e) {
            out(['trips' => [], 'books' => [], 'recordings' => [], 'songs' => [], 'empty' => true]); // tables not created yet
        }
        $pq = $pdo->prepare('SELECT p.id, p.trip_id, p.path, p.caption, p.width, p.height FROM trip_photos p JOIN trips t ON t.id = p.trip_id WHERE t.user_id = ? ORDER BY p.sort, p.id');
        $pq->execute([$room]);
        $photos = $pq->fetchAll();
        $byTrip = [];
        foreach ($photos as $p) $byTrip[$p['trip_id']][] = $p;
        foreach ($trips as &$t) $t['photos'] = $byTrip[$t['id']] ?? [];
        unset($t);
        $bookCols = 'id, title, author, isbn, ol_key, cover_url, published_year, pages, read_on, rating, thoughts, quote';
        $bookOrder = ' FROM books WHERE user_id = ? ORDER BY COALESCE(read_on, created_at) DESC, id DESC';
        try {
            $bq = $pdo->prepare('SELECT ' . $bookCols . ', reading' . $bookOrder);
            $bq->execute([$room]);
        } catch (PDOException $e) {
            $bq = $pdo->prepare('SELECT ' . $bookCols . $bookOrder); // "reading" column not added yet
            $bq->execute([$room]);
        }
        $books = $bq->fetchAll();
        $rq = $pdo->prepare('SELECT id, guitar, title, recorded_on, youtube, audio_path, notes FROM recordings WHERE user_id = ? ORDER BY COALESCE(recorded_on, created_at) DESC, id DESC');
        $rq->execute([$room]);
        $recs = $rq->fetchAll();
        $gq = $pdo->prepare('SELECT slug AS id, name AS navn, brand AS merke, type, year AS aar, color AS farge, pickguard, fretboard AS gripebrett, description AS beskrivelse FROM guitars WHERE user_id = ? ORDER BY id');
        $gq->execute([$room]);
        $roomUser = user_by_id($room);
        if ($room === 1) { try { gm_adopt_builtin(); } catch (Throwable $e) { /* no harm: the files next to the site still work */ } }
        $payload = json_encode([
            'trips' => $trips, 'books' => $books, 'recordings' => $recs, 'songs' => songs_list($pdo), 'guitars' => $gq->fetchAll(),
            'guitar_models' => (object)gm_map(), 'figures' => fig_list(), 'about' => json_decode((string)kv_get('about'), true), 'questions' => q_list(), 'nav' => json_decode((string)kv_get('nav_tabs'), true), 'texts' => (object)(json_decode((string)kv_get('site_texts'), true) ?: []),
            'profile' => ['username' => $roomUser['username'] ?? 'niben', 'owner' => $room === 1, 'sections' => sections_of($roomUser), 'mine' => viewing_own_room(), 'github' => gh_user()],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        // unchanged content: the browser keeps its copy (304, no body)
        $etag = '"' . md5($payload) . '"';
        header('ETag: ' . $etag);
        header('Cache-Control: private, no-cache');
        if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
        echo $payload;
        exit;
    }

    case 'limits':
        out(function_exists('upload_limits') ? upload_limits() : []);

    case 'me':
        if (is_admin() && empty($_COOKIE['niben_me'])) vi_mark_me(); // logged in from before the counter existed: that's me too
        $uid = session_uid();
        $me = null;
        if ($uid > 0) { try { $u = user_by_id($uid); if ($u && $u['status'] === 'approved') $me = user_public($u); } catch (Throwable $e) { /* no table yet */ } }
        out(['admin' => is_admin(), 'user' => $me, 'room' => ['id' => kv_scope(), 'mine' => $uid > 0 && $uid === kv_scope()]]);

    case 'login': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        ensure_schema();
        $pdo = db();
        $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY')->execute();
        $q = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > NOW() - INTERVAL 15 MINUTE');
        $q->execute([client_ip()]);
        if ((int)$q->fetchColumn() >= 8) fail('For mange forsøk. Vent 15 minutter.', 429);
        $pw = (string)(body()['password'] ?? '');
        if ($pw === '' || !password_verify($pw, (string)$config['admin_hash'])) {
            $pdo->prepare('INSERT INTO login_attempts (ip) VALUES (?)')->execute([client_ip()]);
            usleep(400000);
            fail('Feil passord.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['uid'] = 1;
        room_cookie(1);
        $_SESSION['expires'] = time() + 60 * 60 * 8;
        vi_mark_me(); // I'm not a visitor
        out(['admin' => true]);
    }

    case 'logout':
        if (!$post) fail('Bruk POST.', 405);
        $_SESSION = [];
        session_destroy();
        setcookie('niben_room', '', ['expires' => time() - 3600, 'path' => '/']); // back to my room
        room_cookie(1);
        out(['admin' => false]);

    // ── Trips ──
    case 'trip_save': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $b = body();
        $country = str_or_null($b['country'] ?? null, 80) ?? fail('Velg et land.');
        $title = str_or_null($b['title'] ?? null, 200) ?? fail('Skriv en tittel.');
        $vals = [
            $country,
            str_or_null($b['place'] ?? null, 160),
            $title,
            int_or_null($b['year'] ?? null, 1900, 2200),
            date_or_null($b['date_from'] ?? null),
            date_or_null($b['date_to'] ?? null),
            str_or_null($b['body'] ?? null, 20000),
        ];
        if ($vals[3] === null && $vals[4] !== null) $vals[3] = (int)substr($vals[4], 0, 4);
        $id = int_or_null($b['id'] ?? null, 1, PHP_INT_MAX);
        if ($id) {
            $st = db()->prepare('UPDATE trips SET country=?, place=?, title=?, year=?, date_from=?, date_to=?, body=? WHERE id=? AND user_id=?');
            $st->execute([...$vals, $id, $uid]);
            if (!$st->rowCount()) { $own = db()->prepare('SELECT 1 FROM trips WHERE id=? AND user_id=?'); $own->execute([$id, $uid]); if (!$own->fetchColumn()) fail('Den reisen er ikke din.', 403); }
        } else {
            db()->prepare('INSERT INTO trips (country, place, title, year, date_from, date_to, body, user_id) VALUES (?,?,?,?,?,?,?,?)')->execute([...$vals, $uid]);
            $id = (int)db()->lastInsertId();
        }
        // caption / order updates for existing photos
        if (!empty($b['photos']) && is_array($b['photos'])) {
            $st = db()->prepare('UPDATE trip_photos SET caption=?, sort=? WHERE id=? AND trip_id=?');
            foreach (array_values($b['photos']) as $i => $p) {
                $pid = int_or_null($p['id'] ?? null, 1, PHP_INT_MAX);
                if ($pid) $st->execute([str_or_null($p['caption'] ?? null, 255), $i, $pid, $id]);
            }
        }
        out(['id' => $id]);
    }

    case 'trip_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        $st = db()->prepare('SELECT p.path FROM trip_photos p JOIN trips t ON t.id = p.trip_id WHERE p.trip_id=? AND t.user_id=?');
        $st->execute([$id, $uid]);
        foreach ($st->fetchAll() as $p) delete_upload($p['path']);
        db()->prepare('DELETE FROM trips WHERE id=? AND user_id=?')->execute([$id, $uid]);
        out(['ok' => true]);
    }

    case 'photo_upload': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $tripId = int_or_null($_POST['trip_id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler reise.');
        $exists = db()->prepare('SELECT 1 FROM trips WHERE id=? AND user_id=?');
        $exists->execute([$tripId, $uid]);
        if (!$exists->fetchColumn()) fail('Reisen finnes ikke.', 404);
        [$path, $w, $h] = save_photo($_FILES['file'] ?? []);
        $sort = db()->prepare('SELECT COALESCE(MAX(sort), -1) + 1 FROM trip_photos WHERE trip_id=?');
        $sort->execute([$tripId]);
        db()->prepare('INSERT INTO trip_photos (trip_id, path, width, height, sort) VALUES (?,?,?,?,?)')
            ->execute([$tripId, $path, $w, $h, (int)$sort->fetchColumn()]);
        out(['id' => (int)db()->lastInsertId(), 'path' => $path, 'width' => $w, 'height' => $h]);
    }

    case 'photo_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        $st = db()->prepare('SELECT p.path FROM trip_photos p JOIN trips t ON t.id = p.trip_id WHERE p.id=? AND t.user_id=?');
        $st->execute([$id, $uid]);
        $path = $st->fetchColumn();
        if (!$path) fail('Det bildet er ikke ditt.', 403);
        delete_upload($path);
        db()->prepare('DELETE FROM trip_photos WHERE id=?')->execute([$id]);
        out(['ok' => true]);
    }

    // ── Books ──
    case 'book_save': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $b = body();
        $vals = [
            str_or_null($b['title'] ?? null, 255) ?? fail('Boka mangler tittel.'),
            str_or_null($b['author'] ?? null, 255),
            str_or_null(preg_replace('~[^0-9Xx]~', '', (string)($b['isbn'] ?? '')), 20),
            str_or_null($b['ol_key'] ?? null, 40),
            https_url_or_null($b['cover_url'] ?? null),
            int_or_null($b['published_year'] ?? null, -3000, 2200),
            int_or_null($b['pages'] ?? null, 1, 65000),
            date_or_null($b['read_on'] ?? null),
            int_or_null($b['rating'] ?? null, 1, 5),
            str_or_null($b['thoughts'] ?? null, 20000),
            str_or_null($b['quote'] ?? null, 2000),
            empty($b['reading']) ? 0 : 1,
        ];
        try { db()->exec('ALTER TABLE books ADD COLUMN reading TINYINT(1) NOT NULL DEFAULT 0'); } catch (PDOException $e) { /* already there */ }
        $id = int_or_null($b['id'] ?? null, 1, PHP_INT_MAX);
        if ($id) {
            $st = db()->prepare('UPDATE books SET title=?, author=?, isbn=?, ol_key=?, cover_url=?, published_year=?, pages=?, read_on=?, rating=?, thoughts=?, quote=?, reading=? WHERE id=? AND user_id=?');
            $st->execute([...$vals, $id, $uid]);
            if (!$st->rowCount()) { $own = db()->prepare('SELECT 1 FROM books WHERE id=? AND user_id=?'); $own->execute([$id, $uid]); if (!$own->fetchColumn()) fail('Den boka er ikke din.', 403); }
        } else {
            db()->prepare('INSERT INTO books (title, author, isbn, ol_key, cover_url, published_year, pages, read_on, rating, thoughts, quote, reading, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([...$vals, $uid]);
            $id = (int)db()->lastInsertId();
        }
        // finished (a date, and not "reading"): a milestone – once per book
        if (!empty($b['read_on']) && empty($b['reading']) && date_or_null($b['read_on'])) ms_add('book:' . $id, 'book', (string)$vals[0], (string)($vals[1] ?? ''), $vals[4] ?? null, strtotime((string)date_or_null($b['read_on']) . ' 12:00') ?: time(), null);
        out(['id' => $id]);
    }

    case 'book_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        db()->prepare('DELETE FROM books WHERE id=? AND user_id=?')->execute([$id, $uid]);
        out(['ok' => true]);
    }

    // ── Recordings ──
    case 'recording_save': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $b = body();
        $guitar = str_or_null($b['guitar'] ?? null, 60) ?? fail('Velg gitar.');
        if (!preg_match('~^[a-z0-9_-]+$~', $guitar)) fail('Ugyldig gitar.');
        if ($uid !== 1) { // (my own guitars are in data.json; everybody else's are in the database)
            $g = db()->prepare('SELECT 1 FROM guitars WHERE slug=? AND user_id=?');
            $g->execute([$guitar, $uid]);
            if (!$g->fetchColumn()) fail('Velg en av gitarene dine (legg til en under Gitarer først).');
        }
        $title = str_or_null($b['title'] ?? null, 200) ?? fail('Skriv en tittel.');
        $yt = youtube_id($b['youtube'] ?? null);
        $audio = !empty($_FILES['file']) && ($_FILES['file']['error'] ?? 4) !== UPLOAD_ERR_NO_FILE ? save_audio($_FILES['file']) : null;
        $id = int_or_null($b['id'] ?? null, 1, PHP_INT_MAX);
        if ($id) {
            $old = db()->prepare('SELECT audio_path FROM recordings WHERE id=? AND user_id=?');
            $old->execute([$id, $uid]);
            $row = $old->fetch();
            if (!$row) fail('Det opptaket er ikke ditt.', 403);
            $oldPath = $row['audio_path'] ?: null;
            if ($audio) delete_upload($oldPath);
            db()->prepare('UPDATE recordings SET guitar=?, title=?, recorded_on=?, youtube=?, audio_path=?, notes=? WHERE id=? AND user_id=?')
                ->execute([$guitar, $title, date_or_null($b['recorded_on'] ?? null), $yt, $audio ?? $oldPath, str_or_null($b['notes'] ?? null, 5000), $id, $uid]);
        } else {
            if (!$yt && !$audio) fail('Legg til en lydfil eller en YouTube-lenke.');
            db()->prepare('INSERT INTO recordings (guitar, title, recorded_on, youtube, audio_path, notes, user_id) VALUES (?,?,?,?,?,?,?)')
                ->execute([$guitar, $title, date_or_null($b['recorded_on'] ?? null), $yt, $audio, str_or_null($b['notes'] ?? null, 5000), $uid]);
            $id = (int)db()->lastInsertId();
            // (the milestone is added when the list is read, from the recording's date – see ms_trips)
        }
        out(['id' => $id]);
    }

    case 'recording_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        $st = db()->prepare('SELECT audio_path FROM recordings WHERE id=? AND user_id=?');
        $st->execute([$id, $uid]);
        delete_upload($st->fetchColumn() ?: null);
        db()->prepare('DELETE FROM recordings WHERE id=? AND user_id=?')->execute([$id, $uid]);
        out(['ok' => true]);
    }

    default:
        fail('Ukjent handling.', 404);
    }
} catch (PDOException $e) {
    error_log('niben api: ' . $e->getMessage());
    fail('Databasefeil.', 500);
}
