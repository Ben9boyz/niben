<?php
// Guestbook (visitors write, I approve first), the Japanese practice calendar, the backup download, the listening
// log behind the year summary ("Året"), and daily snapshots of Steam hours / jpdb words so a year can show growth.

function ex_tables(): void {
    static $done = false;
    if ($done) return;
    $pdo = db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS guestbook (id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(60) NOT NULL, msg VARCHAR(600) NOT NULL, t INT UNSIGNED NOT NULL, status VARCHAR(10) NOT NULL DEFAULT \'pending\', PRIMARY KEY (id), KEY (status, t)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $pdo->exec('CREATE TABLE IF NOT EXISTS practice (day DATE NOT NULL, n INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (day)) ENGINE=InnoDB');
    // every room has its own guestbook and practice calendar (user_id; 1 = the owner, where everything from before belongs)
    try { $pdo->query('SELECT user_id FROM guestbook LIMIT 0'); } catch (PDOException $e) {
        $pdo->exec('ALTER TABLE guestbook ADD COLUMN user_id INT UNSIGNED NOT NULL DEFAULT 1, ADD KEY idx_gb_user (user_id)');
    }
    try { $pdo->query('SELECT user_id FROM practice LIMIT 0'); } catch (PDOException $e) {
        $pdo->exec('ALTER TABLE practice ADD COLUMN user_id INT UNSIGNED NOT NULL DEFAULT 1, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, day)');
    }
    $pdo->exec('CREATE TABLE IF NOT EXISTS plays (played_at INT UNSIGNED NOT NULL, uri VARCHAR(80) NOT NULL, name VARCHAR(200) NOT NULL, artist VARCHAR(200) NULL, album_uri VARCHAR(80) NULL, album VARCHAR(200) NULL, image VARCHAR(255) NULL, ms INT UNSIGNED NULL, PRIMARY KEY (played_at, uri), KEY (album_uri)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    try { $pdo->query('SELECT user_id FROM plays LIMIT 0'); } catch (PDOException $e) {
        $pdo->exec('ALTER TABLE plays ADD COLUMN user_id INT UNSIGNED NOT NULL DEFAULT 1, DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, played_at, uri)');
    }
    $done = true;
}

// ── practice calendar ──
function ex_practice_hit(): void {
    try { ex_tables(); db()->exec('INSERT INTO practice (user_id, day, n) VALUES (' . kv_scope() . ', CURDATE(), 1) ON DUPLICATE KEY UPDATE n = n + 1'); } catch (Throwable $e) {}
}
function ex_practice(): array {
    ex_tables();
    $rows = db()->query('SELECT day, n FROM practice WHERE user_id = ' . kv_scope() . ' AND day >= CURDATE() - INTERVAL 370 DAY ORDER BY day')->fetchAll();
    $days = [];
    foreach ($rows as $r) $days[$r['day']] = (int)$r['n'];
    // streak: consecutive days up to today (today may still be empty – then up to yesterday)
    $streak = 0; $d = strtotime('today');
    if (empty($days[date('Y-m-d', $d)])) $d = strtotime('yesterday');
    while (!empty($days[date('Y-m-d', $d)])) { $streak++; $d = strtotime('-1 day', $d); }
    $best = 0; $run = 0; $prev = null;
    foreach (array_keys($days) as $day) {
        $run = ($prev && strtotime($day) - strtotime($prev) === 86400) ? $run + 1 : 1;
        $best = max($best, $run); $prev = $day;
    }
    return ['days' => $days, 'streak' => $streak, 'best' => $best, 'total' => array_sum($days), 'active' => count($days)];
}

// ── listening log (from Spotify's "recently played", 50 at a time, so nothing is missed even when the site is closed) ──
function ex_sync_plays(): void {
    try {
        if (!sp_has_scope('user-read-recently-played')) return;
        if (time() - (int)kv_get('plays_sync') < 1500) return;
        kv_set('plays_sync', (string)time());
        [$s, $j] = sp_api('GET', '/me/player/recently-played?limit=50');
        if ($s !== 200) return;
        ex_tables();
        $st = db()->prepare('INSERT IGNORE INTO plays (user_id, played_at, uri, name, artist, album_uri, album, image, ms) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($j['items'] ?? [] as $it) {
            $t = $it['track'] ?? null;
            if (!$t || empty($t['uri'])) continue;
            $at = strtotime($it['played_at'] ?? '') ?: 0;
            if (!$at) continue;
            $al = $t['album'] ?? [];
            $st->execute([kv_scope(), $at, $t['uri'], mb_substr($t['name'] ?? '', 0, 200), mb_substr(implode(', ', array_map(fn($x) => $x['name'], $t['artists'] ?? [])), 0, 200), $al['uri'] ?? null, mb_substr($al['name'] ?? '', 0, 200), sp_img($al['images'] ?? [], 300), (int)($t['duration_ms'] ?? 0)]);
        }
    } catch (Throwable $e) {}
}

// ── daily snapshots ──
function ex_snap(string $key, array $v): void {
    try {
        $l = json_decode(kv_get($key) ?: '[]', true); if (!is_array($l)) $l = [];
        $today = date('Y-m-d');
        if ($l && ($l[count($l) - 1]['d'] ?? '') === $today) return;
        $l[] = ['d' => $today] + $v;
        kv_set($key, json_encode(array_slice($l, -800)));
    } catch (Throwable $e) {}
}

// ── the year ──
function ex_wrapped(int $year): array {
    ex_tables();
    $pdo = db();
    $from = strtotime("$year-01-01 00:00:00"); $to = strtotime(($year + 1) . '-01-01 00:00:00');
    $out = ['year' => $year];
    $u = kv_scope(); // (an int: this room)
    // music
    $q = $pdo->prepare('SELECT COUNT(*) n, COALESCE(SUM(ms),0) ms FROM plays WHERE user_id = ' . $u . ' AND played_at >= ? AND played_at < ?'); $q->execute([$from, $to]);
    $tot = $q->fetch();
    $first = (int)$pdo->query('SELECT MIN(played_at) FROM plays WHERE user_id = ' . $u)->fetchColumn();
    $q = $pdo->prepare('SELECT name, artist, image, COUNT(*) n FROM plays WHERE user_id = ' . $u . ' AND played_at >= ? AND played_at < ? GROUP BY uri, name, artist, image ORDER BY n DESC, MAX(played_at) DESC LIMIT 5'); $q->execute([$from, $to]);
    $tracks = $q->fetchAll();
    $q = $pdo->prepare('SELECT album, MAX(artist) artist, MAX(image) image, album_uri, COUNT(*) n FROM plays WHERE user_id = ' . $u . ' AND played_at >= ? AND played_at < ? AND album_uri IS NOT NULL GROUP BY album_uri, album ORDER BY n DESC LIMIT 5'); $q->execute([$from, $to]);
    $albums = $q->fetchAll();
    $q = $pdo->prepare('SELECT artist, MAX(image) image, COUNT(*) n FROM plays WHERE user_id = ' . $u . ' AND played_at >= ? AND played_at < ? AND artist IS NOT NULL GROUP BY artist ORDER BY n DESC LIMIT 5'); $q->execute([$from, $to]);
    $artists = $q->fetchAll();
    $out['music'] = ['plays' => (int)$tot['n'], 'minutes' => (int)round(((int)$tot['ms']) / 60000), 'since' => $first ?: null, 'tracks' => $tracks, 'albums' => $albums, 'artists' => $artists, 'logging' => sp_has_scope('user-read-recently-played')];
    // books finished
    $q = $pdo->prepare('SELECT title, author, cover_url, pages, rating FROM books WHERE user_id = ' . $u . ' AND read_on IS NOT NULL AND YEAR(read_on) = ? ORDER BY read_on'); $q->execute([$year]);
    $books = $q->fetchAll();
    $out['books'] = ['count' => count($books), 'pages' => array_sum(array_map(fn($b) => (int)$b['pages'], $books)), 'list' => array_slice($books, 0, 12), 'best' => (function ($b) { usort($b, fn($x, $y) => ((int)$y['rating']) <=> ((int)$x['rating'])); return $b && (int)$b[0]['rating'] > 0 ? $b[0] : null; })($books)];
    // travel
    $q = $pdo->prepare('SELECT t.id, t.country, t.place, t.title, (SELECT COUNT(*) FROM trip_photos p WHERE p.trip_id = t.id) photos FROM trips t WHERE t.user_id = ' . $u . ' AND (t.date_from IS NOT NULL AND YEAR(t.date_from) = ?) OR (t.date_from IS NULL AND t.year = ?) ORDER BY t.date_from'); $q->execute([$year, $year]);
    $trips = $q->fetchAll();
    $out['travel'] = ['trips' => count($trips), 'countries' => array_values(array_unique(array_column($trips, 'country'))), 'photos' => array_sum(array_map(fn($t) => (int)$t['photos'], $trips)), 'list' => array_slice($trips, 0, 8)];
    // recordings made
    $q = $pdo->prepare('SELECT COUNT(*) FROM recordings WHERE user_id = ' . $u . ' AND recorded_on IS NOT NULL AND YEAR(recorded_on) = ?'); $q->execute([$year]);
    $out['guitar'] = ['recordings' => (int)$q->fetchColumn()];
    // games: all-time top (Steam) + growth since the first snapshot of the year
    $snaps = json_decode(kv_get('st_snaps') ?: '[]', true) ?: [];
    $ys = array_values(array_filter($snaps, fn($s) => substr($s['d'], 0, 4) === (string)$year));
    $out['games'] = ['hours_now' => $snaps ? end($snaps)['hours'] : null, 'gained' => count($ys) > 1 ? round(end($ys)['hours'] - $ys[0]['hours']) : null, 'since' => $ys ? $ys[0]['d'] : null, 'top' => array_slice((function () { $l = function_exists('st_library') && st_config() ? (st_library()['top'] ?? []) : []; return array_map(fn($g) => ['appid' => $g['appid'], 'name' => $g['name'], 'hours' => $g['hours']], $l); })(), 0, 3)];
    // Japanese: words known, growth since the first snapshot of the year, days practised
    $js = json_decode(kv_get('jp_snaps') ?: '[]', true) ?: [];
    $yj = array_values(array_filter($js, fn($s) => substr($s['d'], 0, 4) === (string)$year));
    $q = $pdo->prepare('SELECT COUNT(*) d, COALESCE(SUM(n),0) n FROM practice WHERE user_id = ' . $u . ' AND YEAR(day) = ?'); $q->execute([$year]);
    $pr = $q->fetch();
    $out['japanese'] = ['known' => $js ? end($js)['known'] : null, 'gained' => count($yj) > 1 ? end($yj)['known'] - $yj[0]['known'] : null, 'since' => $yj ? $yj[0]['d'] : null, 'days' => (int)$pr['d'], 'reviews' => (int)$pr['n']];
    return $out;
}

function ex_handle(string $action, bool $post): void {
    switch ($action) {
    case 'guestbook_list': {
        ex_tables();
        $st = db()->prepare("SELECT id, name, msg, t FROM guestbook WHERE user_id = ? AND status = 'approved' ORDER BY t DESC LIMIT 80");
        $st->execute([kv_scope()]);
        out(['items' => $st->fetchAll()]);
    }
    case 'guestbook_add': {
        if (!$post || ($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 400);
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        if (!empty($b['website'])) out(['ok' => true]); // a bot filled the hidden field: pretend it worked
        $name = trim(preg_replace('~\s+~u', ' ', strip_tags((string)($b['name'] ?? ''))));
        $msg = trim(preg_replace("~[ \t]+~u", ' ', strip_tags((string)($b['message'] ?? ''))));
        if (mb_strlen($name) < 1 || mb_strlen($name) > 60) fail('Skriv navnet ditt (maks 60 tegn).');
        if (mb_strlen($msg) < 2 || mb_strlen($msg) > 600) fail('Skriv en hilsen (2–600 tegn).');
        if (preg_match('~https?://|www\.~i', $msg)) fail('Lenker er ikke tillatt i hilsener.');
        rl_or_fail('gb:' . client_ip(), 3, 3600, 'For mange hilsener – prøv igjen senere.');
        ex_tables();
        db()->prepare("INSERT INTO guestbook (user_id, name, msg, t, status) VALUES (?, ?, ?, ?, 'pending')")->execute([kv_scope(), $name, $msg, time()]);
        out(['ok' => true, 'pending' => true]);
    }
    case 'admin_guestbook': {
        $uid = require_room_owner(); ex_tables();
        $st = db()->prepare('SELECT id, name, msg, t, status FROM guestbook WHERE user_id = ? ORDER BY (status = \'pending\') DESC, t DESC LIMIT 200');
        $st->execute([$uid]);
        out(['items' => $st->fetchAll()]);
    }
    case 'admin_guestbook_set': {
        $uid = require_room_owner(); ex_tables();
        if (!$post) fail('Bruk POST.', 405);
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $id = (int)($b['id'] ?? 0);
        if ($id < 1) fail('Ugyldig hilsen.');
        if (($b['do'] ?? '') === 'approve') db()->prepare("UPDATE guestbook SET status = 'approved' WHERE id = ? AND user_id = ?")->execute([$id, $uid]);
        elseif (($b['do'] ?? '') === 'delete') db()->prepare('DELETE FROM guestbook WHERE id = ? AND user_id = ?')->execute([$id, $uid]);
        else fail('Ukjent valg.');
        out(['ok' => true]);
    }
    case 'practice_calendar': out(ex_practice());
    case 'wrapped': {
        $y = (int)($_GET['year'] ?? date('Y'));
        if ($y < 2000 || $y > (int)date('Y')) $y = (int)date('Y');
        ex_sync_plays();
        out(sp_cached('wrapped_' . $y, is_admin() ? 60 : 1800, fn() => ex_wrapped($y)) ?? ['year' => $y]);
    }
    case 'admin_backup': {
        require_admin();
        $pdo = db();
        $dump = ['made' => date('c'), 'about' => 'niben.no – innholdet (reiser, bilder-referanser, bøker, opptak, sanger) + innstillinger. Bildene og lydfilene selv ligger i uploads/ og må lastes ned for seg.'];
        foreach (['trips', 'trip_photos', 'books', 'recordings', 'songs', 'guestbook', 'practice'] as $t) {
            try { $dump['tables'][$t] = $pdo->query("SELECT * FROM `$t`")->fetchAll(); } catch (Throwable $e) { $dump['tables'][$t] = []; }
        }
        foreach (['about', 'milestones', 'home_place', 'st_best_friend', 'lock_seconds', 'st_snaps', 'jp_snaps'] as $k) $dump['settings'][$k] = kv_get($k);
        header('Content-Disposition: attachment; filename="niben-backup-' . date('Y-m-d') . '.json"');
        out($dump);
    }
    }
}
