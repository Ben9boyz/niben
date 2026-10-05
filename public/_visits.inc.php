<?php
// Who visits the site: how many different visitors per day (not who they are). A visitor is a hash of the IP address
// and a secret salt – the address itself is never stored. Me (logged in as admin, now or earlier from the same
// address, or a browser that has logged in) is never counted, and the visits already counted from my address are removed.

function vi_table(): void {
    static $done = false;
    if ($done) return;
    db()->exec('CREATE TABLE IF NOT EXISTS visits (day DATE NOT NULL, v CHAR(24) NOT NULL, hits INT UNSIGNED NOT NULL DEFAULT 1, first_path VARCHAR(60) NULL, first_t INT UNSIGNED NOT NULL, last_t INT UNSIGNED NOT NULL, PRIMARY KEY (day, v), KEY (v)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $done = true;
}
function vi_salt(): string {
    $s = kv_get('visit_salt');
    if (!$s) { $s = bin2hex(random_bytes(16)); kv_set('visit_salt', $s); }
    return $s;
}
function vi_id(): string { return substr(hash('sha256', vi_salt() . '|' . client_ip()), 0, 24); }
function vi_ignored(): array {
    $l = json_decode(kv_get('visit_ignore') ?: '[]', true);
    return is_array($l) ? $l : [];
}

/** Called when I log in: this address and this browser are me from now on. */
function vi_mark_me(): void {
    try {
        vi_table();
        $id = vi_id();
        $l = vi_ignored();
        if (!in_array($id, $l, true)) { $l[] = $id; kv_set('visit_ignore', json_encode(array_slice($l, -50))); }
        $st = db()->prepare('DELETE FROM visits WHERE v = ?');
        $st->execute([$id]);
        setcookie('niben_me', '1', ['expires' => time() + 86400 * 365, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Lax']);
    } catch (Throwable $e) {}
}

/** One page view from a browser. Quiet: never an error for the visitor. */
function vi_count(string $path): void {
    try {
        if (is_admin() || !empty($_COOKIE['niben_me'])) return;
        $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        if ($ua === '' || preg_match('~bot|crawl|spider|slurp|preview|curl|wget|python|monitor|headless|lighthouse~i', $ua)) return;
        vi_table();
        $id = vi_id();
        if (in_array($id, vi_ignored(), true)) return;
        $path = substr(preg_replace('~[^A-Za-z0-9/_-]~', '', $path), 0, 60);
        $now = time();
        $st = db()->prepare('INSERT INTO visits (day, v, hits, first_path, first_t, last_t) VALUES (CURDATE(), ?, 1, ?, ?, ?) ON DUPLICATE KEY UPDATE hits = hits + 1, last_t = VALUES(last_t)');
        $st->execute([$id, $path, $now, $now]);
        if (random_int(1, 300) === 1) db()->exec('DELETE FROM visits WHERE day < CURDATE() - INTERVAL 400 DAY');
    } catch (Throwable $e) {}
}

function vi_stats(): array {
    $out = ['days' => [], 'today' => 0, 'week' => 0, 'month' => 0, 'total' => 0, 'returning' => 0, 'hits_today' => 0];
    try {
        vi_table();
        $pdo = db();
        $rows = $pdo->query('SELECT day, COUNT(*) u, SUM(hits) h FROM visits WHERE day >= CURDATE() - INTERVAL 29 DAY GROUP BY day')->fetchAll();
        $by = [];
        foreach ($rows as $r) $by[$r['day']] = ['u' => (int)$r['u'], 'h' => (int)$r['h']];
        for ($i = 29; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-$i day"));
            $out['days'][] = ['day' => $d, 'u' => $by[$d]['u'] ?? 0, 'h' => $by[$d]['h'] ?? 0];
        }
        $out['today'] = $by[date('Y-m-d')]['u'] ?? 0;
        $out['hits_today'] = $by[date('Y-m-d')]['h'] ?? 0;
        $out['week'] = (int)$pdo->query('SELECT COUNT(DISTINCT v) FROM visits WHERE day >= CURDATE() - INTERVAL 6 DAY')->fetchColumn();
        $out['month'] = (int)$pdo->query('SELECT COUNT(DISTINCT v) FROM visits WHERE day >= CURDATE() - INTERVAL 29 DAY')->fetchColumn();
        $out['total'] = (int)$pdo->query('SELECT COUNT(DISTINCT v) FROM visits')->fetchColumn();
        $out['returning'] = (int)$pdo->query('SELECT COUNT(*) FROM (SELECT v FROM visits GROUP BY v HAVING COUNT(DISTINCT day) > 1) x')->fetchColumn();
        $out['first_day'] = $pdo->query('SELECT MIN(day) FROM visits')->fetchColumn() ?: null;
    } catch (Throwable $e) {}
    return $out;
}
