<?php
// Milestones: things worth showing on the home page when they happen – a new guitar recording, a finished book,
// an anime I can follow, a song I have learned. Kept as a short list in the key/value table (newest first).
// Automatic ones are added where the thing happens (saving a recording or a book, jpdb coverage); the rest by hand in Admin.

const MS_TYPES = ['recording', 'book', 'anime', 'song', 'trip', 'other'];

/** A trip that has started (or is over) in the last 30 days is a milestone – checked whenever the list is read, so a trip entered in advance shows up on the day it begins. */
function ms_trips(): void {
    try {
        $rows = db()->query("SELECT id, country, place, title, date_from, date_to, year FROM trips WHERE date_from IS NOT NULL AND date_from <= CURDATE() AND date_from >= CURDATE() - INTERVAL 30 DAY")->fetchAll();
        foreach ($rows as $r) ms_add('trip:' . $r['id'], 'trip', trim(($r['place'] ?: $r['country']) . ($r['place'] && $r['country'] ? ', ' . $r['country'] : '')), (string)$r['title'], null, strtotime($r['date_from'] . ' 12:00') ?: time());
    } catch (Throwable $e) {}
    // recordings: the date on the recording (Gitar → opptak) decides – one made in the last 30 days is "just released"
    try {
        $rows = db()->query("SELECT id, guitar, title, recorded_on FROM recordings WHERE recorded_on IS NOT NULL AND recorded_on <= CURDATE() AND recorded_on >= CURDATE() - INTERVAL 30 DAY")->fetchAll();
        foreach ($rows as $r) ms_add('rec:' . $r['id'], 'recording', (string)$r['title'], 'Nytt gitaropptak', null, strtotime($r['recorded_on'] . ' 12:00') ?: time());
    } catch (Throwable $e) {}
}

function ms_all(): array {
    $l = json_decode(kv_get('milestones') ?: '[]', true);
    return is_array($l) ? $l : [];
}
/** Adds one – once: the same key is never added twice (editing a book again doesn't repeat it). */
function ms_add(string $key, string $type, string $title, string $sub = '', ?string $image = null, ?int $t = null, ?string $url = null): void {
    try {
        $l = ms_all();
        foreach ($l as $m) if (($m['key'] ?? '') === $key) return;
        array_unshift($l, ['key' => $key, 'type' => in_array($type, MS_TYPES, true) ? $type : 'other', 'title' => mb_substr($title, 0, 200), 'sub' => mb_substr($sub, 0, 200), 'image' => $image, 'url' => $url, 't' => $t ?: time()]);
        usort($l, fn($a, $b) => ($b['t'] ?? 0) <=> ($a['t'] ?? 0));
        kv_set('milestones', json_encode(array_slice($l, 0, 60), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } catch (Throwable $e) {}
}

function ms_handle(string $action, bool $post): void {
    switch ($action) {
    case 'milestones':
        ms_trips();
        out(['items' => array_slice(ms_all(), 0, 12)]);
    case 'milestone_add': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $title = trim((string)($b['title'] ?? ''));
        if ($title === '') fail('Skriv hva du klarte.');
        $img = trim((string)($b['image'] ?? ''));
        if ($img !== '' && !preg_match('~^https://~', $img)) $img = '';
        ms_add('manual:' . bin2hex(random_bytes(4)), (string)($b['type'] ?? 'other'), $title, trim((string)($b['sub'] ?? '')), $img ?: null);
        out(['ok' => true, 'items' => array_slice(ms_all(), 0, 12)]);
    }
    case 'milestone_delete': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $k = (string)($b['key'] ?? '');
        kv_set('milestones', json_encode(array_values(array_filter(ms_all(), fn($m) => ($m['key'] ?? '') !== $k)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'items' => array_slice(ms_all(), 0, 12)]);
    }
    }
}

// ── Database tidy-up (Admin → Oversikt → Database) ──
// Only throw-away data is ever removed: cached answers (a row whose value is {t, d} and older than 35 days, or from an
// old version of a cache), old login attempts / rate counters, and visits older than 400 days. Content (trips, books,
// recordings, songs, photos), settings and the milestones are never touched.
const DB_OLD_CACHE = ['cache_albums_v3', 'cache_queue', 'cache_albums', 'cache_albums_v2'];
function db_old_cache_keys(): array {
    $out = [];
    foreach (db()->query("SELECT k, v, LENGTH(v) AS n FROM spotify_state")->fetchAll() as $r) {
        $k = (string)$r['k'];
        $old = in_array($k, DB_OLD_CACHE, true) || preg_match('~^(tracks[12]_|artist0_|tempo0_)~', $k);
        if (!$old) {
            $j = json_decode((string)$r['v'], true);
            $old = is_array($j) && count($j) === 2 && isset($j['t'], $j['d']) && is_int($j['t']) && $j['t'] < time() - 35 * 86400;
        }
        if ($old) $out[] = ['k' => $k, 'n' => (int)$r['n']];
    }
    return $out;
}
function db_status(): array {
    $pdo = db();
    $tables = [];
    foreach ($pdo->query("SELECT TABLE_NAME t, TABLE_ROWS r, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024) kb FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC")->fetchAll() as $r)
        $tables[] = ['name' => $r['t'], 'rows' => (int)$r['r'], 'kb' => (int)$r['kb']];
    $old = db_old_cache_keys();
    $cnt = function (string $sql) use ($pdo) { try { return (int)$pdo->query($sql)->fetchColumn(); } catch (Throwable $e) { return 0; } };
    return [
        'tables' => $tables,
        'total_kb' => array_sum(array_column($tables, 'kb')),
        'junk' => [
            'cache' => ['rows' => count($old), 'kb' => (int)round(array_sum(array_column($old, 'n')) / 1024)],
            'logins' => $cnt('SELECT COUNT(*) FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY'),
            'limits' => $cnt('SELECT COUNT(*) FROM rate_limits WHERE t < ' . (time() - 86400)),
            'visits' => $cnt('SELECT COUNT(*) FROM visits WHERE day < CURDATE() - INTERVAL 400 DAY'),
        ],
    ];
}
function db_clean(): array {
    $pdo = db();
    $r = ['cache' => 0, 'logins' => 0, 'limits' => 0, 'visits' => 0];
    $del = $pdo->prepare('DELETE FROM spotify_state WHERE k = ?');
    foreach (db_old_cache_keys() as $x) { $del->execute([$x['k']]); $r['cache'] += $del->rowCount(); }
    foreach ([['logins', 'DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL 1 DAY'], ['limits', 'DELETE FROM rate_limits WHERE t < ' . (time() - 86400)], ['visits', 'DELETE FROM visits WHERE day < CURDATE() - INTERVAL 400 DAY']] as [$k, $sql]) {
        try { $r[$k] = (int)$pdo->exec($sql); } catch (Throwable $e) {}
    }
    try { foreach (['spotify_state', 'translations', 'visits', 'rate_limits', 'login_attempts'] as $t) $pdo->exec("OPTIMIZE TABLE $t"); } catch (Throwable $e) {}
    return $r;
}
