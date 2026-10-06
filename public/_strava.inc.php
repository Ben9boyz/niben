<?php
// Strava: a room's own Strava account fills its Trening module. The site's Strava app (client id + secret) lives in _strava.php
// next to this file (return ['client_id' => '…', 'client_secret' => '…']); without it the connection simply isn't offered.
// Each room connects its own account; the tokens are kept per room, encrypted.

function strv_config(): ?array {
    static $c = false;
    if ($c === false) { $f = __DIR__ . '/_strava.php'; $c = is_file($f) ? require $f : null; }
    return is_array($c) && !empty($c['client_id']) && !empty($c['client_secret']) ? $c : null;
}
function strv_redirect(): string { return 'https://' . ($_SERVER['HTTP_HOST'] ?? 'niben.no') . '/api.php?action=strava_callback'; }
function strv_tokens(): ?array {
    $raw = kv_get('strava_tokens');
    $plain = $raw ? secret_dec($raw) : null;
    $t = $plain ? json_decode($plain, true) : null;
    return is_array($t) && !empty($t['refresh_token']) ? $t : null;
}
function strv_store(array $t): void { kv_set('strava_tokens', secret_enc(json_encode($t))); }

/** A token that works now (renewed when it has run out). */
function strv_access(): ?string {
    $t = strv_tokens();
    $c = strv_config();
    if (!$t || !$c) return null;
    if (($t['expires_at'] ?? 0) > time() + 60) return $t['access_token'];
    [$s, $b] = http_req('POST', 'https://www.strava.com/oauth/token', ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
        'client_id' => $c['client_id'], 'client_secret' => $c['client_secret'], 'grant_type' => 'refresh_token', 'refresh_token' => $t['refresh_token'],
    ]));
    $j = $s === 200 ? json_decode($b, true) : null;
    if (empty($j['access_token'])) return null;
    strv_store(['access_token' => $j['access_token'], 'refresh_token' => $j['refresh_token'] ?? $t['refresh_token'], 'expires_at' => (int)($j['expires_at'] ?? time() + 3600), 'athlete' => $t['athlete'] ?? '']);
    return $j['access_token'];
}

/** A Strava route (an encoded polyline) as the short drawing the Trening module keeps: at most 44 points in a 0–999 square. */
function strv_route(string $poly): string {
    $pts = [];
    $i = 0; $lat = 0; $lng = 0; $len = strlen($poly);
    while ($i < $len) {
        foreach (['lat', 'lng'] as $which) {
            $shift = 0; $res = 0;
            do { $b = ord($poly[$i++] ?? '?') - 63; $res |= ($b & 0x1f) << $shift; $shift += 5; } while ($b >= 0x20 && $i < $len);
            $d = ($res & 1) ? ~($res >> 1) : ($res >> 1);
            if ($which === 'lat') $lat += $d; else $lng += $d;
        }
        $pts[] = [$lat / 1e5, $lng / 1e5];
    }
    if (count($pts) < 2) return '';
    $k = cos(deg2rad(array_sum(array_column($pts, 0)) / count($pts)));
    $xy = array_map(fn($p) => [$p[1] * $k, $p[0]], $pts);
    $xs = array_column($xy, 0); $ys = array_column($xy, 1);
    $minX = min($xs); $minY = min($ys);
    $span = max(max($xs) - $minX, max($ys) - $minY) ?: 1;
    $n = min(44, count($xy));
    $out = [];
    for ($j = 0; $j < $n; $j++) {
        $p = $xy[(int)round($j * (count($xy) - 1) / max(1, $n - 1))];
        $out[] = (int)round(($p[0] - $minX) / $span * 999) . ',' . (int)round((1 - ($p[1] - $minY) / $span) * 999);
    }
    return implode(' ', $out);
}

const STRV_TYPES = ['Run' => 'Løping', 'TrailRun' => 'Løping', 'VirtualRun' => 'Løping', 'Ride' => 'Sykling', 'VirtualRide' => 'Sykling', 'GravelRide' => 'Sykling', 'MountainBikeRide' => 'Sykling', 'EBikeRide' => 'Sykling',
    'Swim' => 'Svømming', 'Walk' => 'Gåtur', 'Hike' => 'Fottur', 'AlpineSki' => 'Ski', 'NordicSki' => 'Ski', 'BackcountrySki' => 'Ski', 'WeightTraining' => 'Styrke', 'Crossfit' => 'Styrke', 'Yoga' => 'Yoga'];

/** Strava activities → entries of a Trening module (`sid` = Strava's id, so nothing comes in twice). */
function strv_entry(array $a): array {
    $e = ['sid' => (string)($a['id'] ?? ''), 'date' => substr((string)($a['start_date_local'] ?? ''), 0, 10), 't' => mb_substr((string)($a['name'] ?? ''), 0, 120),
          'kat' => STRV_TYPES[$a['sport_type'] ?? $a['type'] ?? ''] ?? 'Annet'];
    if (($a['distance'] ?? 0) > 0) $e['km'] = round($a['distance'] / 1000, 2);
    if (($a['moving_time'] ?? 0) > 0) $e['min'] = (int)round($a['moving_time'] / 60);
    if (($a['total_elevation_gain'] ?? 0) > 0) $e['hm'] = (int)round($a['total_elevation_gain']);
    if (!empty($a['average_heartrate'])) $e['puls'] = (int)round($a['average_heartrate']);
    $route = strv_route((string)($a['map']['summary_polyline'] ?? ''));
    if ($route !== '') $e['route'] = $route;
    return $e;
}

function strava_handle(string $action, bool $post): void {
    switch ($action) {
    case 'strava_status': {
        $t = strv_tokens();
        out(['configured' => (bool)strv_config(), 'connected' => (bool)$t, 'athlete' => $t['athlete'] ?? null]);
    }
    case 'strava_login': {
        // reached by navigating the browser here (no custom header) – the session and a state value protect it
        $c = strv_config();
        if (!$c) fail('Strava er ikke satt opp på denne siden.', 503);
        if (!viewing_own_room()) fail('Logg inn i ditt eget rom først.', 401);
        $_SESSION['st_state'] = bin2hex(random_bytes(16));
        header('Location: https://www.strava.com/oauth/authorize?' . http_build_query(['client_id' => $c['client_id'], 'response_type' => 'code', 'redirect_uri' => strv_redirect(),
            'approval_prompt' => 'auto', 'scope' => 'read,activity:read', 'state' => $_SESSION['st_state']]), true, 302);
        exit;
    }
    case 'strava_callback': {
        $c = strv_config();
        $ok = $c && session_uid() > 0 && !empty($_GET['code']) && !empty($_SESSION['st_state']) && hash_equals($_SESSION['st_state'], (string)($_GET['state'] ?? ''))
            && str_contains((string)($_GET['scope'] ?? ''), 'activity:read');
        unset($_SESSION['st_state']);
        if ($ok) {
            kv_scope(session_uid()); // (my own room, whatever room the cookie says)
            [$s, $b] = http_req('POST', 'https://www.strava.com/oauth/token', ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
                'client_id' => $c['client_id'], 'client_secret' => $c['client_secret'], 'code' => (string)$_GET['code'], 'grant_type' => 'authorization_code',
            ]));
            $j = $s === 200 ? json_decode($b, true) : null;
            $ok = !empty($j['refresh_token']);
            if ($ok) strv_store(['access_token' => $j['access_token'], 'refresh_token' => $j['refresh_token'], 'expires_at' => (int)$j['expires_at'],
                'athlete' => trim(($j['athlete']['firstname'] ?? '') . ' ' . ($j['athlete']['lastname'] ?? ''))]);
        }
        header('Location: /#/admin?strava=' . ($ok ? 'ok' : 'feil'), true, 302);
        exit;
    }
    case 'strava_disconnect': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        if (($tok = strv_access()) !== null) http_req('POST', 'https://www.strava.com/oauth/deauthorize', ['Authorization: Bearer ' . $tok]);
        kv_del('strava_tokens');
        out(['connected' => false]);
    }
    case 'strava_sync': {
        // new activities into one of my Trening modules: { id }
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        rl_or_fail('strava:' . kv_scope(), 6, 60, 'Strava hentes høyst noen ganger i minuttet – prøv igjen straks.');
        $id = (string)(body()['id'] ?? '');
        $mod = mod_find($id);
        if (!$mod || ($mod['mod'] ?? '') !== 'trening') fail('Fant ikke treningsmodulen.', 404);
        $tok = strv_access();
        if (!$tok) fail('Koble til Strava først (Admin → Tilkoblinger).', 409);
        $raw = kv_get(mod_data_key($id));
        $data = $raw ? json_decode($raw, true) : ['items' => [], 'settings' => []];
        $items = $data['items'] ?? [];
        $have = array_flip(array_filter(array_map(fn($e) => (string)($e['sid'] ?? ''), $items)));
        $after = (int)($data['settings']['strava_after'] ?? 0);
        $added = 0;
        for ($page = 1; $page <= 4; $page++) {
            [$s, $b] = http_req('GET', 'https://www.strava.com/api/v3/athlete/activities?per_page=50&page=' . $page . ($after ? '&after=' . $after : ''), ['Authorization: Bearer ' . $tok]);
            if ($s === 429) fail('Strava ber oss vente litt – prøv igjen om et kvarter.', 429);
            if ($s !== 200) fail('Strava svarte ' . $s . '.', 502);
            $list = json_decode($b, true) ?: [];
            foreach ($list as $a) {
                $e = strv_entry($a);
                if ($e['sid'] === '' || isset($have[$e['sid']])) continue;
                $items[] = $e; $have[$e['sid']] = true; $added++;
            }
            if (count($list) < 50) break;
        }
        usort($items, fn($x, $y) => strcmp((string)($x['date'] ?? ''), (string)($y['date'] ?? '')));
        $items = array_slice($items, -MOD_ITEMS);
        $settings = (array)($data['settings'] ?? []);
        $settings['strava_after'] = (string)(time() - 3 * 86400); // (a little overlap: an activity uploaded late still comes)
        $settings['strava_at'] = (string)time();
        $clean = mod_clean_data(['items' => $items, 'settings' => $settings]);
        kv_set(mod_data_key($id), json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'added' => $added, 'data' => $clean]);
    }
    }
}
