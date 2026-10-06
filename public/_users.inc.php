<?php
// Several users. The site is still "mine" (user 1, the owner, who logs in with the admin password as before),
// but anybody can ask for an account: username + e-mail + password. I approve the accounts (Admin → Brukere).
// An approved user gets a room of their own: their own trips, books, guitars, recordings, songs and "Om meg", and
// their own settings (which corners of the room to show, API keys for jpdb / Steam).
//
//  · every content row has a user_id (rows made before this existed belong to user 1)
//  · the room a visitor sees is the one in the cookie niben_room; without it: their own room when logged in, else mine
//  · the key/value store (kv_get / kv_set, see _spotify.inc.php) is prefixed per room, so about, texts, caches and
//    keys never mix
//  · API keys are stored encrypted (AES-256-GCM, key from the server's own secrets)

const ROOM_SECTIONS = ['reiser', 'boker', 'gitar', 'ovelse', 'japansk', 'lytte', 'gaming', 'kode', 'om'];
/** What a new user starts with. The listening corner (Spotify) and the projects belong to the owner's room for now. */
const USER_DEFAULT_SECTIONS = ['reiser' => true, 'boker' => true, 'gitar' => true, 'ovelse' => true, 'japansk' => false, 'lytte' => false, 'gaming' => false, 'kode' => false, 'om' => true];
const USER_LOCKED_OFF = []; // (every corner can be had now: each room brings its own Spotify, Steam, jpdb and GitHub)
const RESERVED_NAMES = ['admin', 'niben', 'api', 'root', 'system', 'support', 'test', 'null', 'undefined'];

// ── schema ────────────────────────────────────────────────
function users_migrate(): void {
    sp_schema(); // (the key/value table)
    ensure_schema();
    if (function_exists('songs_ensure')) songs_ensure();
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, username VARCHAR(24) NOT NULL, email VARCHAR(190) NOT NULL DEFAULT '',
  pass_hash VARCHAR(255) NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'pending', sections TEXT NULL,
  created INT UNSIGNED NOT NULL, last_login INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id), UNIQUE KEY uq_username (username), KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS guitars (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, user_id INT UNSIGNED NOT NULL, slug VARCHAR(40) NOT NULL, name VARCHAR(80) NOT NULL,
  brand VARCHAR(80) NULL, type VARCHAR(80) NULL, year SMALLINT NULL, color VARCHAR(9) NOT NULL DEFAULT '#c9a96b',
  pickguard VARCHAR(9) NULL, fretboard VARCHAR(9) NULL, description TEXT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_slug (slug), KEY idx_guitar_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    foreach (['trips', 'books', 'recordings', 'songs'] as $t) {
        try { db()->exec("ALTER TABLE `$t` ADD COLUMN user_id INT UNSIGNED NOT NULL DEFAULT 1"); db()->exec("ALTER TABLE `$t` ADD KEY idx_{$t}_user (user_id)"); } catch (PDOException $e) { /* already there */ }
    }
    // the owner is user 1; logs in with the admin password from _config.php
    global $config;
    $has = db()->query('SELECT COUNT(*) FROM users WHERE id = 1')->fetchColumn();
    if (!$has) {
        db()->prepare("INSERT INTO users (id, username, email, pass_hash, status, created) VALUES (1, ?, '', ?, 'approved', ?)")
            ->execute([(string)($config['owner_username'] ?? 'niben'), (string)$config['admin_hash'], time()]);
    }
}
/** Makes sure the tables are there (one cheap query per request that needs them). */
function users_ready(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->query('SELECT user_id FROM trips LIMIT 0');
        db()->query('SELECT user_id FROM books LIMIT 0');
        db()->query('SELECT user_id FROM recordings LIMIT 0');
        db()->query('SELECT user_id FROM songs LIMIT 0');
        db()->query('SELECT 1 FROM guitars LIMIT 0');
        db()->query('SELECT 1 FROM spotify_state LIMIT 0');
        db()->query('SELECT 1 FROM users WHERE id = 1 LIMIT 1')->fetchColumn() ?: throw new PDOException('no owner');
    } catch (PDOException $e) {
        users_migrate();
    }
}

// ── who is who ────────────────────────────────────────────
/** The logged-in account (0 = nobody). The owner is 1. */
function session_uid(): int {
    return ($_SESSION['expires'] ?? 0) > time() ? (int)($_SESSION['uid'] ?? (!empty($_SESSION['admin']) ? 1 : 0)) : 0;
}
function user_by_id(int $id): ?array {
    users_ready();
    $st = db()->prepare('SELECT id, username, email, status, sections, created, last_login FROM users WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}
function user_by_name(string $name): ?array {
    users_ready();
    $st = db()->prepare('SELECT id, username, email, status, sections, created, last_login FROM users WHERE username = ?');
    $st->execute([strtolower($name)]);
    return $st->fetch() ?: null;
}
/** Which room this request is about: the cookie's, else the logged-in user's own, else mine. */
function room_resolve(): int {
    $name = (string)($_COOKIE['niben_room'] ?? '');
    if ($name !== '' && preg_match('~^[a-z0-9_]{3,24}$~', $name)) {
        try {
            $u = user_by_name($name);
            if ($u && $u['status'] === 'approved') return (int)$u['id'];
        } catch (Throwable $e) { /* no table yet: my room */ }
    }
    $s = session_uid();
    return $s > 0 ? $s : 1;
}
/** A logged-in account (the owner or a user) that is allowed to change content. Switches the key/value store to THEIR room. */
function require_user(): int {
    $uid = session_uid();
    if ($uid < 1) fail('Du må logge inn.', 401);
    if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
    users_ready();
    $u = user_by_id($uid);
    if (!$u || $u['status'] !== 'approved') fail('Kontoen er ikke aktiv.', 403);
    $_SESSION['expires'] = time() + 60 * 60 * 8;
    kv_scope($uid);
    return $uid;
}
/** The logged-in account AND the owner of the room being shown (jpdb review etc. use that room's own keys). */
function require_room_owner(): int {
    $room = room_resolve();
    $uid = require_user();
    if ($uid !== $room) fail('Dette er ikke rommet ditt.', 403);
    return $uid;
}
/** Is the logged-in account the owner of the room being shown? (what the "admin" buttons in a room hinge on) */
function viewing_own_room(): bool {
    $s = session_uid();
    return $s > 0 && $s === kv_scope();
}

/** A cookie the page itself can read (the room's id, nothing secret) so browser-side caches are kept per room. */
function room_cookie(int $id): void {
    $_COOKIE['niben_r'] = (string)$id;
    if (PHP_SAPI === 'cli') return;
    setcookie('niben_r', (string)$id, ['expires' => time() + 365 * 86400, 'path' => '/', 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
}

// ── mail ──
/** Where the owner's notices go: `admin_email` in _config.php, else the e-mail saved on the owner's account. */
function owner_email(): string {
    global $config;
    $e = trim((string)($config['admin_email'] ?? ''));
    if ($e === '') { $u = user_by_id(1); $e = trim((string)($u['email'] ?? '')); }
    return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : '';
}
function user_mail(string $to, string $subject, string $text): void {
    try { if ($to !== '' && function_exists('nw_mail')) nw_mail($to, $subject, $text); } catch (Throwable $e) { error_log('niben mail: ' . $e->getMessage()); }
}
function site_url(): string { return function_exists('nw_base') ? preg_replace('~/[^/]*$~', '', nw_base() . '/x') : ''; }
function password_ok(int $uid, string $pw): bool {
    global $config;
    if ($pw === '') return false;
    if ($uid === 1 && !empty($config['admin_hash']) && password_verify($pw, (string)$config['admin_hash'])) return true;
    $st = db()->prepare('SELECT pass_hash FROM users WHERE id = ?');
    $st->execute([$uid]);
    return password_verify($pw, (string)$st->fetchColumn());
}

// ── sections ──────────────────────────────────────────────
function sections_of(?array $u): array {
    $isOwner = $u && (int)$u['id'] === 1;
    $base = $isOwner ? array_fill_keys(ROOM_SECTIONS, true) : USER_DEFAULT_SECTIONS;
    $saved = $u && !empty($u['sections']) ? (json_decode((string)$u['sections'], true) ?: []) : [];
    foreach (ROOM_SECTIONS as $k) if (array_key_exists($k, $saved)) $base[$k] = (bool)$saved[$k];
    if (!$isOwner) foreach (USER_LOCKED_OFF as $k) $base[$k] = false;
    return $base;
}

// ── secrets (API keys) ────────────────────────────────────
function secret_key(): string {
    global $config;
    return hash('sha256', 'niben-keys|' . ($config['db_pass'] ?? '') . '|' . ($config['admin_hash'] ?? ''), true);
}
function secret_enc(string $plain): string {
    $iv = random_bytes(12);
    $ct = openssl_encrypt($plain, 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $ct);
}
function secret_dec(string $blob): ?string {
    $raw = base64_decode($blob, true);
    if ($raw === false || strlen($raw) < 29) return null;
    $out = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $out === false ? null : $out;
}
/** The keys the room's owner has saved (jpdb_key, steam_key, steam_id). Never sent to the browser. */
function room_secrets(): array {
    $uid = kv_scope();
    if (!isset($GLOBALS['room_secrets'][$uid])) {
        $raw = kv_get('secrets');
        $plain = $raw ? secret_dec($raw) : null;
        $GLOBALS['room_secrets'][$uid] = $plain ? (json_decode($plain, true) ?: []) : [];
    }
    return $GLOBALS['room_secrets'][$uid];
}
function room_secrets_save(array $s): void {
    $s = array_filter($s, fn($v) => is_string($v) && $v !== '');
    $GLOBALS['room_secrets'][kv_scope()] = $s;
    kv_set('secrets', $s ? secret_enc(json_encode($s)) : null);
}

// ── validation ────────────────────────────────────────────
function valid_username(string $n): bool { return (bool)preg_match('~^[a-z][a-z0-9_]{2,19}$~', $n) && !in_array($n, RESERVED_NAMES, true); }

function user_public(array $u): array {
    return ['id' => (int)$u['id'], 'username' => $u['username'], 'owner' => (int)$u['id'] === 1];
}

/** One page of approved rooms (the owner's first, then by name) with their photo, door and tagline – two queries however many rooms there are.
 *  `$alsoId` (> 0): that room is always in the page (the one you stand in, so the menu can show it). */
function rooms_page(string $q, int $offset, int $limit, int $alsoId): array {
    $like = '%' . addcslashes($q, '%_\\') . '%';
    $where = $q === '' ? "status = 'approved'" : "status = 'approved' AND username LIKE ?";
    $args = $q === '' ? [] : [$like];
    $cnt = db()->prepare("SELECT COUNT(*) FROM users WHERE $where");
    $cnt->execute($args);
    $total = (int)$cnt->fetchColumn();
    $st = db()->prepare("SELECT id, username FROM users WHERE $where ORDER BY id = 1 DESC, username LIMIT " . (int)$limit . ' OFFSET ' . (int)$offset);
    $st->execute($args);
    $rows = $st->fetchAll();
    if ($alsoId > 0 && $q === '' && !in_array($alsoId, array_map(fn($r) => (int)$r['id'], $rows), true)) {
        $one = db()->prepare("SELECT id, username FROM users WHERE id = ? AND status = 'approved'");
        $one->execute([$alsoId]);
        if ($r = $one->fetch()) $rows[] = $r;
    }
    $keys = [];
    foreach ($rows as $r) { $keys[(int)$r['id'] === 1 ? 'about' : 'u' . (int)$r['id'] . '_about'] = (int)$r['id']; }
    $abouts = [];
    if ($keys) {
        $in = implode(',', array_fill(0, count($keys), '?'));
        $kv = db()->prepare("SELECT k, v FROM spotify_state WHERE k IN ($in)");
        $kv->execute(array_keys($keys));
        foreach ($kv->fetchAll() as $row) $abouts[$keys[$row['k']]] = json_decode((string)$row['v'], true) ?: [];
    }
    $list = [];
    foreach ($rows as $r) {
        $a = $abouts[(int)$r['id']] ?? [];
        $list[] = ['username' => $r['username'], 'owner' => (int)$r['id'] === 1, 'photo' => $a['bilde'] ?? null, 'door' => $a['bilder']['door'] ?? null, 'tagline' => $a['tagline'] ?? ''];
    }
    return ['rooms' => $list, 'total' => $total];
}

function users_handle(string $action, bool $post): void {
    switch ($action) {

    case 'user_register': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        users_ready();
        rl_or_fail('reg:' . client_ip(), 5, 3600, 'For mange nye kontoer herfra. Prøv igjen senere.');
        $b = body();
        if (!empty($b['website'])) out(['ok' => true, 'pending' => true]); // a hidden field only robots fill in
        $name = strtolower(trim((string)($b['username'] ?? '')));
        $email = strtolower(trim((string)($b['email'] ?? '')));
        $pw = (string)($b['password'] ?? '');
        if (!valid_username($name)) fail('Brukernavnet må være 3–20 tegn: små bokstaver, tall og _ (begynn med en bokstav).');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) fail('Det ser ikke ut som en e-postadresse.');
        if (strlen($pw) < 8) fail('Passordet må være minst 8 tegn.');
        if (strlen($pw) > 200) fail('Passordet er for langt.');
        $dup = db()->prepare('SELECT username, email FROM users WHERE username = ? OR email = ?');
        $dup->execute([$name, $email]);
        foreach ($dup->fetchAll() as $r) fail($r['username'] === $name ? 'Brukernavnet er tatt.' : 'Den e-postadressen har allerede en konto.');
        db()->prepare("INSERT INTO users (username, email, pass_hash, status, created) VALUES (?, ?, ?, 'pending', ?)")
            ->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT), time()]);
        user_mail(owner_email(), 'Ny konto venter på godkjenning: ' . $name, "Hei!\n\n$name ($email) har bedt om en konto.\n\nGodkjenn eller avslå den under Admin → Brukere:\n" . site_url() . "/#/admin\n\nSkal $name bruke musikk, må du også legge til e-posten til Spotify-kontoen hennes i Spotify-dashboardet (User Management).");
        out(['ok' => true, 'pending' => true]);
    }

    case 'user_login': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        users_ready();
        $pdo = db();
        $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY')->execute();
        $q = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > NOW() - INTERVAL 15 MINUTE');
        $q->execute([client_ip()]);
        if ((int)$q->fetchColumn() >= 8) fail('For mange forsøk. Vent 15 minutter.', 429);
        $b = body();
        $who = strtolower(trim((string)($b['username'] ?? '')));
        $pw = (string)($b['password'] ?? '');
        $st = $pdo->prepare('SELECT id, username, pass_hash, status FROM users WHERE username = ? OR (email = ? AND email <> \'\')');
        $st->execute([$who, $who]);
        $u = $st->fetch();
        // (the same time and the same message whether the user exists or not)
        $ok = $u && password_verify($pw, (string)$u['pass_hash']);
        if (!$ok) {
            $pdo->prepare('INSERT INTO login_attempts (ip) VALUES (?)')->execute([client_ip()]);
            usleep(400000);
            fail('Feil brukernavn eller passord.', 401);
        }
        if ($u['status'] === 'pending') fail('Kontoen din venter på godkjenning. Du får tilgang så snart den er godkjent.', 403);
        if ($u['status'] !== 'approved') fail('Kontoen er ikke aktiv.', 403);
        session_regenerate_id(true);
        $id = (int)$u['id'];
        $_SESSION['uid'] = $id;
        $_SESSION['admin'] = $id === 1;
        $_SESSION['expires'] = time() + 60 * 60 * 8;
        $pdo->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([time(), $id]);
        if ($id === 1) vi_mark_me();
        setcookie('niben_room', '', ['expires' => time() - 3600, 'path' => '/']); // logged in: your own room first
        room_cookie($id);
        out(['ok' => true, 'user' => ['id' => $id, 'username' => $u['username'], 'owner' => $id === 1]]);
    }

    case 'rooms': {
        // the rooms to choose between in the menu: the owner's first, then the first approved users (and the one you stand in). The whole
        // list can be long: the hall asks for it a page at a time (rooms_find)
        users_ready();
        $scope = kv_scope();
        $page = rooms_page('', 0, 24, $scope);
        $cur = user_by_id($scope);
        out(['rooms' => $page['rooms'], 'total' => $page['total'], 'current' => $cur ? $cur['username'] : null]);
    }

    case 'rooms_find': {
        // a page of rooms, matching a search: { q, offset, limit (at most 48) }
        users_ready();
        $b = body();
        $page = rooms_page(mb_substr(trim((string)($b['q'] ?? '')), 0, 40), max(0, (int)($b['offset'] ?? 0)), max(1, min(48, (int)($b['limit'] ?? 12))), 0);
        out($page);
    }

    case 'room_set': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        users_ready();
        $name = strtolower(trim((string)(body()['username'] ?? '')));
        $u = $name !== '' ? user_by_name($name) : null;
        if (!$u || $u['status'] !== 'approved') fail('Fant ikke det rommet.', 404);
        setcookie('niben_room', $u['username'], ['expires' => time() + 30 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
        room_cookie((int)$u['id']);
        out(['ok' => true, 'username' => $u['username']]);
    }

    case 'me_settings': {
        $uid = require_user();
        $u = user_by_id($uid);
        if ($post) {
            $b = body();
            if (isset($b['sections']) && is_array($b['sections'])) {
                $cur = sections_of($u);
                foreach (ROOM_SECTIONS as $k) if (array_key_exists($k, $b['sections'])) $cur[$k] = (bool)$b['sections'][$k];
                if ($uid !== 1) foreach (USER_LOCKED_OFF as $k) $cur[$k] = false;
                db()->prepare('UPDATE users SET sections = ? WHERE id = ?')->execute([json_encode($cur), $uid]);
            }
            $s = room_secrets();
            foreach (['jpdb_key' => 40, 'steam_key' => 64] as $k => $max) {
                if (!array_key_exists($k, $b)) continue;
                $v = trim((string)$b[$k]);
                if ($v === '') unset($s[$k]);
                elseif (preg_match('~^[A-Za-z0-9_-]{16,' . $max . '}$~', $v)) $s[$k] = $v;
                else fail($k === 'jpdb_key' ? 'jpdb-nøkkelen ser ikke riktig ut (kopier den fra jpdb.io → Settings → API).' : 'Steam-nøkkelen ser ikke riktig ut.');
            }
            if (array_key_exists('steam_id', $b)) {
                $v = trim((string)$b['steam_id']);
                if (preg_match('~/profiles/(\d{17})~', $v, $m)) $v = $m[1];
                if ($v === '') unset($s['steam_id']);
                elseif (preg_match('~^\d{17}$~', $v)) $s['steam_id'] = $v;
                else fail('Bruk den 17-sifrede Steam-ID-en, eller lenken til profilen din (…/profiles/7656…).');
            }
            if (array_key_exists('github_user', $b)) {
                $v = trim((string)$b['github_user']);
                if (preg_match('~github\.com/([A-Za-z0-9-]+)~', $v, $m)) $v = $m[1];
                $v = ltrim($v, '@');
                if ($v === '') unset($s['github_user']);
                elseif (preg_match('~^[A-Za-z0-9-]{1,39}$~', $v)) $s['github_user'] = $v;
                else fail('GitHub-navnet ser ikke riktig ut (bare bokstaver, tall og bindestrek).');
            }
            if (array_key_exists('lastfm_key', $b)) {
                $v = trim((string)$b['lastfm_key']);
                if ($v === '') kv_del('lastfm_key');
                elseif (preg_match('~^[a-f0-9]{32}$~i', $v)) kv_set('lastfm_key', $v);
                else fail('Last.fm-nøkkelen er 32 tegn (last.fm/api → «API key»).');
            }
            room_secrets_save($s);
            $u = user_by_id($uid);
        }
        $s = room_secrets();
        $cfgJp = $uid === 1 ? (function_exists('jp_config') && jp_config() !== null) : !empty($s['jpdb_key']);
        out([
            'user' => user_public($u), 'email' => $u['email'],
            'sections' => sections_of($u), 'locked' => $uid === 1 ? [] : USER_LOCKED_OFF,
            'keys' => ['jpdb' => $cfgJp, 'steam_id' => $s['steam_id'] ?? ($uid === 1 ? 'fra oppsettet' : null), 'steam_key' => !empty($s['steam_key']),
                'github_user' => $uid === 1 ? gh_user() : ($s['github_user'] ?? null), 'lastfm' => (string)kv_get('lastfm_key') !== '',
                'spotify_app' => sp_site_config() ? 'site' : null],
            'spotify' => ['connected' => (bool)kv_get('refresh_token'), 'denied' => sp_denied(), 'redirect' => sp_redirect_uri()],
        ]);
    }

    case 'user_forgot': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        users_ready();
        rl_or_fail('fp:' . client_ip(), 5, 3600, 'For mange forsøk. Prøv igjen senere.');
        $who = strtolower(trim((string)(body()['who'] ?? '')));
        if ($who !== '') {
            db()->exec('CREATE TABLE IF NOT EXISTS pw_resets (user_id INT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL, expires INT UNSIGNED NOT NULL, PRIMARY KEY (token_hash), KEY (user_id)) ENGINE=InnoDB');
            $st = db()->prepare("SELECT id, username, email FROM users WHERE id > 1 AND status = 'approved' AND (username = ? OR email = ?) LIMIT 1");
            $st->execute([$who, $who]);
            if ($u = $st->fetch()) {
                $tok = bin2hex(random_bytes(20));
                db()->prepare('DELETE FROM pw_resets WHERE user_id = ? OR expires < ?')->execute([$u['id'], time()]);
                db()->prepare('INSERT INTO pw_resets (user_id, token_hash, expires) VALUES (?, ?, ?)')->execute([$u['id'], hash('sha256', $tok), time() + 3600]);
                user_mail((string)$u['email'], 'Nytt passord', "Hei " . $u['username'] . "!\n\nTrykk på lenka for å velge et nytt passord (gjelder i én time):\n" . site_url() . '/#/admin?reset=' . $tok . "\n\nHvis det ikke var du som ba om det, kan du ignorere denne e-posten.");
            }
        }
        out(['ok' => true]); // (the same answer whether the account exists or not)
    }

    case 'user_reset': {
        if (!$post) fail('Bruk POST.', 405);
        if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 403);
        users_ready();
        rl_or_fail('rp:' . client_ip(), 10, 3600, 'For mange forsøk. Prøv igjen senere.');
        $b = body();
        $tok = (string)($b['token'] ?? ''); $pw = (string)($b['password'] ?? '');
        if (strlen($pw) < 8 || strlen($pw) > 200) fail('Passordet må være minst 8 tegn.');
        if (!preg_match('~^[a-f0-9]{40}$~', $tok)) fail('Lenka er ugyldig eller utløpt. Be om en ny.', 400);
        try {
            $st = db()->prepare('SELECT user_id FROM pw_resets WHERE token_hash = ? AND expires > ?');
            $st->execute([hash('sha256', $tok), time()]);
            $uid = (int)$st->fetchColumn();
        } catch (PDOException $e) { $uid = 0; }
        if ($uid < 2) fail('Lenka er ugyldig eller utløpt. Be om en ny.', 400);
        db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $uid]);
        db()->prepare('DELETE FROM pw_resets WHERE user_id = ?')->execute([$uid]);
        out(['ok' => true]);
    }

    case 'me_email': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $b = body();
        $email = strtolower(trim((string)($b['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) fail('Det ser ikke ut som en e-postadresse.');
        if (!password_ok($uid, (string)($b['password'] ?? ''))) { usleep(400000); fail('Passordet stemmer ikke.', 401); }
        $dup = db()->prepare('SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?');
        $dup->execute([$email, $uid]);
        if ((int)$dup->fetchColumn()) fail('Den e-postadressen har allerede en konto.');
        db()->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$email, $uid]);
        out(['ok' => true, 'email' => $email]);
    }

    case 'me_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        if ($uid === 1) fail('Hovedrommet kan ikke slettes her.', 400);
        if (!password_ok($uid, (string)(body()['password'] ?? ''))) { usleep(400000); fail('Passordet stemmer ikke.', 401); }
        users_delete($uid);
        $_SESSION = [];
        setcookie('niben_room', '', ['expires' => time() - 3600, 'path' => '/']);
        room_cookie(1);
        out(['ok' => true]);
    }

    case 'me_password': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $b = body();
        $st = db()->prepare('SELECT pass_hash FROM users WHERE id = ?');
        $st->execute([$uid]);
        if (!password_verify((string)($b['old'] ?? ''), (string)$st->fetchColumn())) { usleep(400000); fail('Det gamle passordet stemmer ikke.', 401); }
        $new = (string)($b['new'] ?? '');
        if (strlen($new) < 8 || strlen($new) > 200) fail('Det nye passordet må være minst 8 tegn.');
        if ($uid === 1) fail('Admin-passordet byttes med ./setup.sh.', 400);
        db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $uid]);
        out(['ok' => true]);
    }

    // ── the owner's: approve accounts ──
    case 'admin_users': {
        require_admin();
        users_ready();
        $rows = db()->query('SELECT id, username, email, status, created, last_login FROM users ORDER BY id = 1 DESC, status = \'pending\' DESC, created DESC LIMIT 500')->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $c = fn(string $t) => (int)db()->query("SELECT COUNT(*) FROM `$t` WHERE user_id = " . $r['id'])->fetchColumn();
            $r['counts'] = ['trips' => $c('trips'), 'books' => $c('books'), 'recordings' => $c('recordings'), 'songs' => $c('songs')];
        }
        unset($r);
        out(['users' => $rows]);
    }

    case 'admin_user_set': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        users_ready();
        $b = body();
        $id = (int)($b['id'] ?? 0);
        $do = (string)($b['do'] ?? '');
        if ($id < 2) fail('Den kontoen kan ikke endres her.');
        $u = user_by_id($id) ?? fail('Fant ikke brukeren.', 404);
        if ($do === 'approve' || $do === 'enable') {
            db()->prepare("UPDATE users SET status = 'approved' WHERE id = ?")->execute([$id]);
            if ($u['status'] !== 'approved') user_mail((string)$u['email'], 'Kontoen din er godkjent', "Hei " . $u['username'] . "!\n\nKontoen din er godkjent. Du kan logge inn nå:\n" . site_url() . "/#/admin\n\nDet er ditt eget rom – styr det fra Admin.");
        }
        elseif ($do === 'disable') db()->prepare("UPDATE users SET status = 'disabled' WHERE id = ?")->execute([$id]);
        elseif ($do === 'delete') users_delete($id);
        else fail('Ukjent valg.');
        out(['ok' => true]);
    }
    }
}

/** Removes an account with everything it owns (content, photos / audio files, settings). */
function users_delete(int $id): void {
    $pdo = db();
    $st = $pdo->prepare('SELECT p.path FROM trip_photos p JOIN trips t ON t.id = p.trip_id WHERE t.user_id = ?');
    $st->execute([$id]);
    foreach ($st->fetchAll() as $p) delete_upload($p['path']);
    $st = $pdo->prepare('SELECT audio_path FROM recordings WHERE user_id = ? AND audio_path IS NOT NULL');
    $st->execute([$id]);
    foreach ($st->fetchAll() as $r) delete_upload($r['audio_path']);
    foreach (['trips', 'books', 'recordings', 'songs', 'guitars'] as $t) $pdo->prepare("DELETE FROM `$t` WHERE user_id = ?")->execute([$id]);
    foreach (['guestbook', 'practice', 'plays'] as $t) { try { $pdo->prepare("DELETE FROM `$t` WHERE user_id = ?")->execute([$id]); } catch (PDOException $e) { /* not created yet */ } }
    $about = json_decode((string)(function () use ($id) { $s = kv_scope(); kv_scope($id); $v = kv_get('about'); kv_scope($s); return $v; })(), true) ?: [];
    if (!empty($about['bilde'])) delete_upload($about['bilde']);
    $pdo->prepare('DELETE FROM spotify_state WHERE k LIKE ?')->execute(['u' . $id . '\\_%']);
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
}

/** A user's guitars (my own are in data.json, with 3D models; theirs are drawn from colours). */
function guitars_handle(string $action, bool $post): void {
    if (!$post) fail('Bruk POST.', 405);
    $uid = require_user();
    $b = body();
    $hex = fn($v) => (is_string($v) && preg_match('~^#[0-9a-fA-F]{6}$~', $v)) ? strtolower($v) : null;
    switch ($action) {
    case 'guitar_save': {
        $name = str_or_null($b['name'] ?? null, 80) ?? fail('Gi gitaren et navn.');
        $vals = [$name, str_or_null($b['brand'] ?? null, 80), str_or_null($b['type'] ?? null, 80), int_or_null($b['year'] ?? null, 1900, 2200), $hex($b['color'] ?? null) ?? '#c9a96b', $hex($b['pickguard'] ?? null), $hex($b['fretboard'] ?? null), str_or_null($b['description'] ?? null, 4000)];
        $slug = (string)($b['id'] ?? '');
        if ($slug !== '') {
            $st = db()->prepare('UPDATE guitars SET name=?, brand=?, type=?, year=?, color=?, pickguard=?, fretboard=?, description=? WHERE slug=? AND user_id=?');
            $st->execute([...$vals, $slug, $uid]);
            if (!$st->rowCount()) { $own = db()->prepare('SELECT 1 FROM guitars WHERE slug=? AND user_id=?'); $own->execute([$slug, $uid]); if (!$own->fetchColumn()) fail('Den gitaren er ikke din.', 403); }
        } else {
            $n = db()->prepare('SELECT COUNT(*) FROM guitars WHERE user_id=?');
            $n->execute([$uid]);
            if ((int)$n->fetchColumn() >= 12) fail('Du kan ha opptil 12 gitarer.');
            $slug = 'g' . bin2hex(random_bytes(5));
            db()->prepare('INSERT INTO guitars (user_id, slug, name, brand, type, year, color, pickguard, fretboard, description) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$uid, $slug, ...$vals]);
        }
        out(['ok' => true, 'id' => $slug]);
    }
    case 'guitar_delete': {
        $slug = (string)($b['id'] ?? '');
        $st = db()->prepare('SELECT 1 FROM guitars WHERE slug=? AND user_id=?');
        $st->execute([$slug, $uid]);
        if (!$st->fetchColumn()) fail('Den gitaren er ikke din.', 403);
        $rs = db()->prepare('SELECT audio_path FROM recordings WHERE guitar=? AND user_id=? AND audio_path IS NOT NULL');
        $rs->execute([$slug, $uid]);
        foreach ($rs->fetchAll() as $r) delete_upload($r['audio_path']);
        db()->prepare('DELETE FROM recordings WHERE guitar=? AND user_id=?')->execute([$slug, $uid]);
        db()->prepare('DELETE FROM guitars WHERE slug=? AND user_id=?')->execute([$slug, $uid]);
        out(['ok' => true]);
    }
    }
}
