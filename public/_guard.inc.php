<?php
// Protection against floods and misuse: a request counter per IP (and per expensive action), kept in
// the database in fixed time windows. The admin isn't counted. If the table can't be made, nothing is
// blocked (better a working site than a locked one).

/** Counts one hit for $key in a window of $seconds. Returns true while under $limit. */
function rl_hit(string $key, int $limit, int $seconds): bool {
    $win = intdiv(time(), $seconds);
    $k = substr(hash('sha256', $key), 0, 40); // IPs aren't stored as such
    try {
        $sql = 'INSERT INTO rate_limits (k, n, win, t) VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE n = IF(win = VALUES(win), n + 1, 1), win = VALUES(win), t = VALUES(t)';
        $args = [$k, $win, time()];
        try {
            db()->prepare($sql)->execute($args);
        } catch (PDOException $e) {
            db()->exec('CREATE TABLE IF NOT EXISTS rate_limits (k CHAR(40) NOT NULL, n INT UNSIGNED NOT NULL, win INT UNSIGNED NOT NULL, t INT UNSIGNED NOT NULL, PRIMARY KEY (k)) ENGINE=InnoDB');
            db()->prepare($sql)->execute($args);
        }
        $st = db()->prepare('SELECT n FROM rate_limits WHERE k = ?');
        $st->execute([$k]);
        if (random_int(1, 500) === 1) db()->prepare('DELETE FROM rate_limits WHERE t < ?')->execute([time() - 86400]); // old counters
        return (int)$st->fetchColumn() <= $limit;
    } catch (Throwable $e) {
        return true;
    }
}

/** Stops the request with 429 when $key has been hit more than $limit times in $seconds. */
function rl_or_fail(string $key, int $limit, int $seconds, string $msg = 'For mange forespørsler – vent litt og prøv igjen.'): void {
    if (!rl_hit($key, $limit, $seconds)) {
        header('Retry-After: ' . $seconds);
        fail($msg, 429);
    }
}

// every API request: at most 240 a minute per IP (the site itself needs far fewer)
function guard_request(string $action): void {
    if (is_admin()) return;
    rl_or_fail('ip:' . client_ip(), 240, 60);
}
