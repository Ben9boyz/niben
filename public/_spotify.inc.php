<?php
/**
 * Spotify-integrasjon for niben.no (inkluderes av api.php).
 *
 * - Admin kobler til Spotify én gang (OAuth). Refresh-tokenet lagres i databasen.
 * - Besøkende ser lagrede album, spillelister og hva som spilles nå (hurtiglagret på serveren).
 * - Bare admin kan starte avspilling – og etter et bytte er det låst i 10 minutter.
 *
 * Tilgang til Spotify-appen ligger i _spotify.php (lages av ./spotify-setup.sh).
 */

const SP_LOCK_SECONDS = 600;
const SP_SCOPES = 'user-library-read playlist-read-private playlist-read-collaborative user-read-currently-playing user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private user-library-modify playlist-modify-private playlist-modify-public user-read-recently-played user-top-read ugc-image-upload';

/** Every room connects through the site's Spotify app (_spotify.php): its own Spotify account, its own tokens. */
function sp_site_config(): ?array {
    static $c = false;
    if ($c === false) {
        $f = __DIR__ . '/_spotify.php';
        $c = is_file($f) ? require $f : null;
    }
    return $c;
}
function sp_config(): ?array {
    return sp_site_config();
}

function sp_redirect_uri(): string {
    return 'https://' . ($_SERVER['HTTP_HOST'] ?? 'niben.no') . '/spotify-callback.php';
}

// ── tiny key/value store in MySQL ─────────────────────────
function sp_schema(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS spotify_state (
        k VARCHAR(40) NOT NULL, v MEDIUMTEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (k)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}
// Every room has its own settings: with several users the keys are prefixed "u<id>_" (the owner, id 1, keeps the plain keys, so
// nothing already saved moves). kv_scope() says whose room this request is about (see _users.inc.php).
function kv_scope(?int $uid = null): int {
    if ($uid !== null) $GLOBALS['kv_uid'] = $uid;
    return (int)($GLOBALS['kv_uid'] ?? 1);
}
function kv_key(string $k): string {
    $u = kv_scope();
    if ($u === 1) return $k;
    $p = 'u' . $u . '_';
    return strlen($p . $k) <= 40 ? $p . $k : $p . substr(md5($k), 0, 40 - strlen($p)); // (the column is 40 characters)
}
function kv_get(string $k): ?string {
    $st = db()->prepare('SELECT v FROM spotify_state WHERE k=?');
    $st->execute([kv_key($k)]);
    $v = $st->fetchColumn();
    return $v === false ? null : $v;
}
function kv_set(string $k, ?string $v): void {
    db()->prepare('INSERT INTO spotify_state (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')->execute([kv_key($k), $v]);
}
function kv_del(string ...$keys): void {
    $st = db()->prepare('DELETE FROM spotify_state WHERE k=?');
    foreach ($keys as $k) $st->execute([kv_key($k)]);
}

require_once __DIR__ . '/_net.inc.php'; // http_req()

// ── tokens ───────────────────────────────────────────────
function sp_token_request(array $params): ?array {
    $c = sp_config();
    [$status, $body] = http_req('POST', 'https://accounts.spotify.com/api/token', [
        'Authorization: Basic ' . base64_encode($c['client_id'] . ':' . $c['client_secret']),
        'Content-Type: application/x-www-form-urlencoded',
    ], http_build_query($params));
    $json = json_decode($body, true);
    if ($status !== 200 || empty($json['access_token'])) {
        error_log('niben spotify token: ' . $status . ' ' . substr($body, 0, 300));
        return null;
    }
    kv_set('access_token', $json['access_token']);
    kv_set('access_expires', (string)(time() + (int)($json['expires_in'] ?? 3600) - 60));
    if (!empty($json['refresh_token'])) kv_set('refresh_token', $json['refresh_token']);
    if (!empty($json['scope'])) kv_set('scopes', $json['scope']);
    return $json;
}

function sp_access_token(bool $force = false): ?string {
    $refresh = kv_get('refresh_token');
    if (!$refresh) return null;
    $tok = kv_get('access_token');
    if (!$force && $tok && (int)kv_get('access_expires') > time()) return $tok;
    $json = sp_token_request(['grant_type' => 'refresh_token', 'refresh_token' => $refresh]);
    return $json['access_token'] ?? null;
}

/** Calls the Spotify Web API. Returns [status, decoded body]. */
function sp_api(string $method, string $path, ?array $body = null): array {
    for ($try = 0; $try < 2; $try++) {
        $tok = sp_access_token($try > 0);
        if (!$tok) return [401, null];
        $headers = ['Authorization: Bearer ' . $tok];
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        [$status, $res] = http_req($method, 'https://api.spotify.com/v1' . $path, $headers, $body !== null ? json_encode($body) : null);
        if ($status !== 401) return [$status, $res === '' ? null : json_decode($res, true)];
    }
    return [401, null];
}

/** Did the admin's Spotify login include this permission? (older logins lack the ones added later) */
function sp_has_scope(string $scope): bool {
    return in_array($scope, explode(' ', (string)kv_get('scopes')), true);
}
const SP_RECONNECT = 'Koble til Spotify på nytt (Admin → Koble til Spotify) for å få lov til å lagre.';

// ── data shaping ──────────────────────────────────────────
function sp_img(array $images, int $want = 300): ?string {
    if (!$images) return null;
    usort($images, fn($a, $b) => abs(($a['width'] ?? 0) - $want) <=> abs(($b['width'] ?? 0) - $want));
    return $images[0]['url'] ?? null;
}

function sp_cached(string $key, int $ttl, callable $fetch) {
    $raw = kv_get($key);
    if ($raw) {
        $c = json_decode($raw, true);
        if ($c && ($c['t'] ?? 0) > time() - $ttl) return $c['d'];
    }
    $d = $fetch();
    if ($d !== null) kv_set($key, json_encode(['t' => time(), 'd' => $d], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    elseif ($raw) return json_decode($raw, true)['d'] ?? null; // keep stale data if Spotify hiccups
    return $d;
}

function sp_albums(): ?array {
    return sp_cached('cache_albums_v4', 1800, function () {
        $out = [];
        for ($offset = 0; $offset < 1000; $offset += 50) {
            [$s, $j] = sp_api('GET', '/me/albums?limit=50&offset=' . $offset);
            if ($s !== 200) return $out ?: null;
            foreach ($j['items'] ?? [] as $it) {
                $a = $it['album'] ?? null;
                if (!$a) continue;
                $out[] = [
                    'id' => $a['id'],
                    'uri' => $a['uri'],
                    'name' => $a['name'],
                    'artist' => implode(', ', array_map(fn($x) => $x['name'], $a['artists'] ?? [])),
                    'artist_id' => $a['artists'][0]['id'] ?? null,
                    'year' => substr((string)($a['release_date'] ?? ''), 0, 4),
                    'image' => sp_img($a['images'] ?? [], 300),
                    'image_large' => sp_img($a['images'] ?? [], 640),
                    'thumb' => sp_img($a['images'] ?? [], 64),
                    'url' => $a['external_urls']['spotify'] ?? null,
                    'tracks' => $a['total_tracks'] ?? null,
                    'added' => !empty($it['added_at']) ? strtotime($it['added_at']) : null,
                ];
            }
            if (empty($j['next'])) break;
        }
        return $out;
    });
}

function sp_playlists(): ?array {
    return sp_cached('cache_playlists_v3', 1800, function () {
        $out = [];
        [$ms, $me] = sp_api('GET', '/me');
        $meId = $ms === 200 ? (string)($me['id'] ?? '') : '';
        for ($offset = 0; $offset < 500; $offset += 50) {
            [$s, $j] = sp_api('GET', '/me/playlists?limit=50&offset=' . $offset);
            if ($s !== 200) return $out ?: null;
            foreach ($j['items'] ?? [] as $p) {
                if (!$p) continue;
                $out[] = [
                    'id' => $p['id'],
                    'uri' => $p['uri'],
                    'name' => $p['name'],
                    'owner' => $p['owner']['display_name'] ?? null,
                    // my own (or shared) lists – the ones a song can be added to
                    'editable' => $meId === '' ? null : (($p['owner']['id'] ?? '') === $meId || !empty($p['collaborative'])),
                    'image' => sp_img($p['images'] ?? [], 300),
                    'thumb' => sp_img($p['images'] ?? [], 64),
                    'count' => $p['items']['total'] ?? $p['tracks']['total'] ?? null,
                    'url' => $p['external_urls']['spotify'] ?? null,
                ];
            }
            if (empty($j['next'])) break;
        }
        return $out;
    });
}

function sp_now(): ?array {
    return sp_cached('cache_now', 5, function () {
        // the full player state (also tells whether shuffle is on)
        [$s, $j] = sp_api('GET', '/me/player?additional_types=track,episode');
        if ($s === 204 || !$j || empty($j['item'])) return ['playing' => false];
        if ($s !== 200) return null;
        $it = $j['item'];
        $album = $it['album'] ?? $it['show'] ?? [];
        $playing = (bool)($j['is_playing'] ?? false);
        $dev = $j['device'] ?? [];
        // playing through the page's own player (the "niben.no" device) and that page has been closed:
        // Spotify keeps saying "playing" for a while – if the device is gone from the list, it isn't
        if ($playing && ($dev['name'] ?? '') === 'niben.no') {
            [$ds, $dj] = sp_api('GET', '/me/player/devices');
            if ($ds === 200 && !in_array($dev['id'] ?? '', array_column($dj['devices'] ?? [], 'id'), true)) $playing = false;
        }
        return [
            'playing' => $playing,
            'device' => $dev['name'] ?? null,
            'device_type' => $dev['type'] ?? null,
            'volume' => $dev['volume_percent'] ?? null,
            'repeat' => $j['repeat_state'] ?? 'off',
            'shuffle' => (bool)($j['shuffle_state'] ?? false),
            'progress_ms' => (int)($j['progress_ms'] ?? 0),
            'duration_ms' => (int)($it['duration_ms'] ?? 0),
            'name' => $it['name'] ?? '',
            'artist' => implode(', ', array_map(fn($x) => $x['name'], $it['artists'] ?? [])) ?: ($album['publisher'] ?? ''),
            'album' => $album['name'] ?? '',
            'album_uri' => $album['uri'] ?? null, // (so the name can open the album page)
            'artist_id' => $it['artists'][0]['id'] ?? null,
            'image' => sp_img($album['images'] ?? [], 300),
            'image_large' => sp_img($album['images'] ?? [], 640),
            'uri' => $it['uri'] ?? null,
            'context' => $j['context']['uri'] ?? null,
            'url' => $it['external_urls']['spotify'] ?? null,
            'at' => time(),
        ];
    });
}

function sp_track(array $t): array {
    $al = $t['album'] ?? null;
    $out = [
        'uri' => $t['uri'] ?? null,
        'name' => $t['name'] ?? '',
        'artist' => implode(', ', array_map(fn($x) => $x['name'], $t['artists'] ?? [])),
        'artist_id' => $t['artists'][0]['id'] ?? null,
        'ms' => (int)($t['duration_ms'] ?? 0),
        'n' => $t['track_number'] ?? null,
        'disc' => $t['disc_number'] ?? null, // albums with 2+ discs: the numbers start over on each
        'img' => sp_img($al['images'] ?? [], 64), // tiny cover (playlists; album tracks have none)
    ];
    if ($al && !empty($al['uri'])) { // so a song can open its album
        $out += [
            'album' => $al['name'] ?? '', 'album_uri' => $al['uri'], 'album_id' => $al['id'] ?? null,
            'album_artist' => implode(', ', array_map(fn($x) => $x['name'], $al['artists'] ?? [])),
            'album_image' => sp_img($al['images'] ?? [], 300), 'album_image_large' => sp_img($al['images'] ?? [], 640),
            'album_url' => $al['external_urls']['spotify'] ?? null,
        ];
    }
    return $out;
}

/** An artist and their albums (admin; cached 6 h). By id, or – when only the name is known – found by search. */
function sp_artist(string $id, string $name): ?array {
    if ($id === '' && $name !== '') {
        [$s, $j] = sp_api('GET', '/search?type=artist&limit=1&q=' . rawurlencode(mb_substr($name, 0, 100)));
        $id = $s === 200 ? (string)($j['artists']['items'][0]['id'] ?? '') : '';
    }
    if (!preg_match('~^[A-Za-z0-9]{10,40}$~', $id)) return null;
    $res = sp_cached("artist2_{$id}", 21600, function () use ($id) {
        [$s, $a] = sp_api('GET', "/artists/{$id}");
        if ($s !== 200) return null;
        $albums = []; $seen = [];
        $add = function (array $x) use (&$albums, &$seen) {
            $key = mb_strtolower($x['name'] ?? '');
            if (!$x || !isset($x['id']) || isset($seen[$key])) return; // the same record re-released in several markets
            $seen[$key] = 1;
            $albums[] = [
                'id' => $x['id'], 'uri' => $x['uri'], 'name' => $x['name'],
                'artist' => implode(', ', array_map(fn($y) => $y['name'], $x['artists'] ?? [])),
                'year' => substr((string)($x['release_date'] ?? ''), 0, 4), 'type' => $x['album_type'] ?? 'album',
                'image' => sp_img($x['images'] ?? [], 300), 'image_large' => sp_img($x['images'] ?? [], 640), 'thumb' => sp_img($x['images'] ?? [], 64),
                'url' => $x['external_urls']['spotify'] ?? null, 'tracks' => $x['total_tracks'] ?? null,
            ];
        };
        // Spotify has lowered the page size for apps in development mode, so a too-big "limit" is refused (400):
        // try 50, then 20, then 10, and read as many pages as it takes.
        foreach ([50, 20, 10] as $lim) {
            $ok = true;
            for ($offset = 0; $offset < 200; $offset += $lim) {
                [$s2, $j] = sp_api('GET', "/artists/{$id}/albums?include_groups=album,single&limit={$lim}&offset={$offset}");
                if ($s2 !== 200) { $ok = false; if ($offset === 0 && $s2 === 400) continue 2; break; }
                foreach ($j['items'] ?? [] as $x) $add($x);
                if (empty($j['next'])) break;
            }
            if ($ok || $albums) break;
        }
        // still nothing (the endpoint is closed to this app?): look the artist's albums up by searching for them
        if (!$albums) {
            $nm = (string)($a['name'] ?? '');
            for ($offset = 0; $nm !== '' && $offset < 40; $offset += 10) {
                [$s3, $j] = sp_api('GET', '/search?type=album&limit=10&offset=' . $offset . '&q=' . rawurlencode('artist:"' . mb_substr($nm, 0, 80) . '"'));
                if ($s3 !== 200) break;
                $items = $j['albums']['items'] ?? [];
                foreach ($items as $x) {
                    if (!in_array($id, array_map(fn($y) => $y['id'] ?? '', $x['artists'] ?? []), true)) continue;
                    if (($x['album_type'] ?? '') === 'compilation') continue;
                    $add($x);
                }
                if (count($items) < 10) break;
            }
        }
        if (!$albums) return ['_empty' => true, 'id' => $a['id'], 'uri' => $a['uri'], 'name' => $a['name'], 'genres' => array_slice($a['genres'] ?? [], 0, 4), 'image' => sp_img($a['images'] ?? [], 300), 'image_large' => sp_img($a['images'] ?? [], 640), 'url' => $a['external_urls']['spotify'] ?? null, 'albums' => []];
        usort($albums, fn($p, $q) => strcmp($q['year'], $p['year']));
        return [
            'id' => $a['id'], 'uri' => $a['uri'], 'name' => $a['name'], 'genres' => array_slice($a['genres'] ?? [], 0, 4),
            'image' => sp_img($a['images'] ?? [], 300), 'image_large' => sp_img($a['images'] ?? [], 640),
            'url' => $a['external_urls']['spotify'] ?? null, 'albums' => $albums,
        ];
    });
    // an empty answer is not remembered – try again next time (the old code cached "no albums" for 6 hours)
    if (is_array($res) && !empty($res['_empty'])) kv_del("artist2_{$id}");
    return $res;
}

/** Track list for an album or playlist (fetched on demand, cached for 6 hours). */
function sp_tracks(string $type, string $id): array {
    $data = sp_cached("tracks5_{$type}_{$id}", 21600, function () use ($type, $id) {
        $out = [];
        // read page after page; the next page starts after what we actually GOT (if Spotify hands out fewer than the
        // 50 we ask for, jumping 50 ahead would skip songs – the cause of albums with only their first few songs)
        for ($offset = 0, $guard = 0; $offset < 1000 && $guard < 60; $guard++) {
            $path = $type === 'album'
                ? "/albums/{$id}/tracks?limit=50&offset={$offset}"
                : "/playlists/{$id}/items?limit=50&offset={$offset}";
            [$s, $j] = sp_api('GET', $path);
            if ($s === 403 || $s === 404) return ['hidden' => true, 'tracks' => []];
            if ($s !== 200) return $out ? ['tracks' => $out] : null;
            $got = $j['items'] ?? [];
            foreach ($got as $it) {
                $t = $type === 'album' ? $it : ($it['item'] ?? $it['track'] ?? null);
                if ($t && !empty($t['uri'])) $out[] = sp_track($t);
            }
            if (empty($j['next']) || !$got) break;
            $offset += count($got);
        }
        return ['tracks' => $out];
    });
    return $data ?? ['tracks' => [], 'error' => true];
}

/** The albums I listened to last (newest first, 10 kept): remembered on the server so every device sees the same stack
 *  on the 3D table. Called whenever somebody asks what's playing; only writes when the album changes. */
function sp_note_recent(?array $now): array {
    if (function_exists('ex_sync_plays')) ex_sync_plays(); // the listening log behind "Året"
    $list = json_decode(kv_get('recent_albums') ?: '[]', true);
    if (!is_array($list)) $list = [];
    $ctx = (string)($now['context'] ?? '');
    if ($now && !empty($now['playing']) && str_starts_with($ctx, 'spotify:album:') && (($list[0]['uri'] ?? '') !== $ctx)) {
        $list = array_values(array_filter($list, fn($a) => ($a['uri'] ?? '') !== $ctx));
        array_unshift($list, ['uri' => $ctx, 'name' => $now['album'] ?? '', 'artist' => $now['artist'] ?? '', 'image' => $now['image'] ?? null, 'image_large' => $now['image_large'] ?? null]);
        $list = array_slice($list, 0, 10);
        kv_set('recent_albums', json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    return $list;
}

function sp_lock_clear(): void {
    kv_set('lock_until', '0');
    kv_del('lock_album', 'lock_started');
}

/** Has the album that started the lock been heard to the end – or has the music gone on to something else? */
function sp_album_finished(string $album, array $now): bool {
    // playing something that isn't this album any more (another album, autoplay, a radio …): done
    if ((string)($now['context'] ?? '') !== $album) return true;
    // still in it: done when the LAST song has played to its end (or has stopped there)
    if (!preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', $album, $m)) return false;
    $tracks = sp_tracks('album', $m[1])['tracks'] ?? [];
    $last = $tracks ? ($tracks[count($tracks) - 1]['uri'] ?? null) : null;
    if (!$last || (string)($now['uri'] ?? '') !== $last) return false;
    $dur = (int)($now['duration_ms'] ?? 0);
    $pos = (int)($now['progress_ms'] ?? 0);
    return empty($now['playing']) || ($dur > 0 && $pos >= $dur - 4000);
}

function sp_lock_until(): int {
    $lock = (int)(kv_get('lock_until') ?? 0);
    if ($lock <= time()) return $lock;
    // a short grace period right after starting, since Spotify can report "nothing" (or the old song) for a
    // moment before the music begins
    $started = (int)(kv_get('lock_started') ?? 0);
    if (($started ?: $lock - sp_lock_seconds()) > time() - 20) return $lock;
    $now = sp_now();
    if ($now === null) return $lock;
    // nothing playing at all → the lock is lifted
    if (empty($now['name'])) { sp_lock_clear(); return 0; }
    // an album that has been heard to the end (or left for something else) → lifted
    $album = (string)(kv_get('lock_album') ?? '');
    if ($album !== '' && sp_album_finished($album, $now)) { sp_lock_clear(); return 0; }
    return $lock;
}
/** How long a play locks switching, in seconds (set by the admin; 0 = no lock). */
function sp_lock_seconds(): int { $v = kv_get('lock_seconds'); return $v === null ? SP_LOCK_SECONDS : max(0, (int)$v); }

// ── actions ───────────────────────────────────────────────
function sp_handle(string $action, bool $post): void {
    if ($action === 'spotify_callback') kv_scope(session_uid() ?: 1); // (a plain redirect: no room cookie rules here)
    $c = sp_config();
    if (!$c) out(['connected' => false, 'configured' => false]);
    sp_schema();

    switch ($action) {
    case 'spotify_public': {
        $connected = (bool)kv_get('refresh_token');
        if (!$connected) out(['configured' => true, 'connected' => false]);
        out([
            'configured' => true,
            'connected' => true,
            'now' => sp_now(),
            'albums' => sp_albums() ?? [],
            'playlists' => sp_playlists() ?? [],
            'lock_until' => sp_lock_until(),
            'lock_seconds' => sp_lock_seconds(),
            'server_time' => time(),
        ]);
    }

    case 'spotify_now': {
        // tiny response for frequent polling – the album/playlist lists are fetched rarely
        if (!kv_get('refresh_token')) out(['configured' => true, 'connected' => false]);
        $__now = sp_now();
        out(['configured' => true, 'connected' => true, 'now' => $__now, 'recent' => sp_note_recent($__now), 'lock_until' => sp_lock_until(), 'lock_seconds' => sp_lock_seconds(), 'server_time' => time()]);
    }

    case 'spotify_tracks': {
        if (!kv_get('refresh_token')) out(['tracks' => []]);
        $type = (string)($_GET['type'] ?? '');
        $id = (string)($_GET['id'] ?? '');
        if (!in_array($type, ['album', 'playlist'], true) || !preg_match('~^[A-Za-z0-9]{10,40}$~', $id)) fail('Ugyldig forespørsel.');
        // visitors: only what's in my library (any other id would cost a call to Spotify and a cache row);
        // the admin also opens albums/playlists found by search
        if (!viewing_own_room()) {
            $mine = array_column($type === 'album' ? (sp_albums() ?? []) : (sp_playlists() ?? []), 'id');
            $ctx = (string)(sp_now()['context'] ?? ''); // and whatever is playing right now
            if ($ctx !== '') $mine[] = substr($ctx, strrpos($ctx, ':') + 1);
            if (!in_array($id, $mine, true)) fail('Ukjent ' . ($type === 'album' ? 'album' : 'spilleliste') . '.', 404);
        }
        out(sp_tracks($type, $id));
    }

    case 'spotify_tempo': {
        $id = (string)($_GET['id'] ?? '');
        if (!preg_match('~^[A-Za-z0-9]{10,40}$~', $id)) fail('Ugyldig forespørsel.');
        // visitors: only the song that is playing right now (anything else would cost calls to Spotify / Deezer)
        if (!viewing_own_room() && (string)(sp_now()['uri'] ?? '') !== 'spotify:track:' . $id) out(['bpm' => 0]);
        $t = sp_tempo($id);
        out(['bpm' => (float)($t['bpm'] ?? 0)]);
    }

    case 'spotify_artist': {
        if (!viewing_own_room()) fail('Logg inn for å åpne artister.', 401);
        $r = sp_artist((string)($_GET['id'] ?? ''), trim((string)($_GET['name'] ?? '')));
        if (!$r) fail('Fant ikke artisten.', 404);
        out($r);
    }

    case 'spotify_login': {
        // reached by navigating the browser here, so no custom header – session + state protect it
        if (!viewing_own_room()) fail('Logg inn i ditt eget rom først.', 401);
        $state = bin2hex(random_bytes(16));
        $_SESSION['sp_state'] = $state;
        header('Content-Type: text/html; charset=utf-8');
        header('Location: https://accounts.spotify.com/authorize?' . http_build_query([
            'response_type' => 'code',
            'client_id' => $c['client_id'],
            'scope' => SP_SCOPES,
            'redirect_uri' => sp_redirect_uri(),
            'state' => $state,
        ]), true, 302);
        exit;
    }

    case 'spotify_callback': {
        header('Content-Type: text/html; charset=utf-8');
        $ok = session_uid() > 0
            && !empty($_GET['code'])
            && !empty($_SESSION['sp_state'])
            && hash_equals($_SESSION['sp_state'], (string)($_GET['state'] ?? ''));
        unset($_SESSION['sp_state']);
        if ($ok) {
            $ok = (bool)sp_token_request([
                'grant_type' => 'authorization_code',
                'code' => (string)$_GET['code'],
                'redirect_uri' => sp_redirect_uri(),
            ]);
            if ($ok) kv_del('cache_albums_v3', 'cache_playlists_v3', 'cache_now');
        }
        header('Location: /#/lytte?spotify=' . ($ok ? 'ok' : 'feil'), true, 302);
        exit;
    }

    case 'spotify_disconnect': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        kv_del('refresh_token', 'scopes', 'access_token', 'access_expires', 'cache_albums_v3', 'cache_playlists_v3', 'cache_now');
        out(['connected' => false]);
    }

    case 'spotify_refresh': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        kv_del('cache_albums_v3', 'cache_playlists_v3', 'cache_now');
        out(['ok' => true]);
    }

    case 'spotify_lock': {
        // change the lock length for the next play. A running lock can't be changed or lifted.
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $lock = sp_lock_until();
        if ($lock > time()) {
            out(['error' => 'Låsen er på – den kan endres om ' . ceil(($lock - time()) / 60) . ' min.', 'lock_until' => $lock, 'lock_seconds' => sp_lock_seconds(), 'server_time' => time()], 423);
        }
        $sec = (int)(body()['seconds'] ?? -1);
        if ($sec < 0 || $sec > 3 * 3600) fail('Ugyldig låsetid.');
        kv_set('lock_seconds', (string)$sec);
        out(['ok' => true, 'lock_seconds' => $sec, 'lock_until' => $lock, 'server_time' => time()]);
    }

    case 'spotify_control': {
        // pause / resume / seek / next / previous on whatever device is playing (admin).
        // Pausing always works; seeking and skipping are locked like switching.
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $op = (string)(body()['op'] ?? '');
        $lock = sp_lock_until();
        if (in_array($op, ['seek', 'next', 'previous'], true) && $lock > time()) out(['error' => 'Låst – hør ferdig', 'lock_until' => $lock, 'server_time' => time()], 423);
        if ($op === 'pause') [$s, $j] = sp_api('PUT', '/me/player/pause');
        elseif ($op === 'resume') {
            [$s, $j] = sp_api('PUT', '/me/player/play');
            // nothing active (Spotify forgets an idle device): hand playback to the asked-for device, or any
            $dev = (string)(body()['device'] ?? '');
            if ($s === 404) {
                if ($dev === '' || !preg_match('~^[A-Za-z0-9]{20,64}$~', $dev)) {
                    [$ds, $dj] = sp_api('GET', '/me/player/devices');
                    $dev = (string)(array_values(array_filter($dj['devices'] ?? [], fn($d) => empty($d['is_restricted'])))[0]['id'] ?? '');
                }
                if ($dev !== '') [$s, $j] = sp_api('PUT', '/me/player', ['device_ids' => [$dev], 'play' => true]);
            }
        }
        elseif ($op === 'seek') [$s, $j] = sp_api('PUT', '/me/player/seek?position_ms=' . max(0, (int)(body()['ms'] ?? 0)));
        elseif ($op === 'next') [$s, $j] = sp_api('POST', '/me/player/next');
        elseif ($op === 'previous') [$s, $j] = sp_api('POST', '/me/player/previous');
        elseif ($op === 'shuffle') [$s, $j] = sp_api('PUT', '/me/player/shuffle?state=' . (!empty(body()['state']) ? 'true' : 'false'));
        else fail('Ukjent handling.');
        if ($s === 404 && $op === 'pause') out(['ok' => true]); // nothing playing – already paused
        if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_now');
        out(['ok' => true]);
    }

    case 'spotify_token': {
        // short-lived access token for the in-browser player (Web Playback SDK) – admin only
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $tok = sp_access_token();
        if (!$tok) fail('Spotify er ikke koblet til.', 401);
        $scopes = explode(' ', (string)kv_get('scopes'));
        out([
            'token' => $tok,
            'expires' => (int)kv_get('access_expires'),
            'streaming' => in_array('streaming', $scopes, true),
        ]);
    }

    case 'spotify_search': {
        // search all of Spotify for albums and tracks (admin only – it spends the app's request quota)
        if (!viewing_own_room()) fail('Logg inn for å søke i hele Spotify.', 401);
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2) out(['albums' => [], 'tracks' => [], 'playlists' => []]);
        [$s, $j] = sp_api('GET', '/search?type=album,track,playlist,artist&limit=10&q=' . rawurlencode(mb_substr($q, 0, 100)));
        if ($s === 429) fail('For mange søk – vent litt.', 429);
        if ($s === 401) out(['error' => 'Spotify-tilkoblingen har gått ut. Koble til på nytt.', 'code' => 'reconnect'], 409);
        if ($s !== 200) fail('Spotify svarte med feil (' . $s . ').', 502);
        $albums = [];
        foreach ($j['albums']['items'] ?? [] as $a) {
            if (!$a) continue;
            $albums[] = [
                'id' => $a['id'], 'uri' => $a['uri'], 'name' => $a['name'],
                'artist' => implode(', ', array_map(fn($x) => $x['name'], $a['artists'] ?? [])),
                'year' => substr((string)($a['release_date'] ?? ''), 0, 4),
                'image' => sp_img($a['images'] ?? [], 300), 'image_large' => sp_img($a['images'] ?? [], 640), 'thumb' => sp_img($a['images'] ?? [], 64),
                'url' => $a['external_urls']['spotify'] ?? null, 'tracks' => $a['total_tracks'] ?? null,
            ];
        }
        $tracks = [];
        foreach ($j['tracks']['items'] ?? [] as $t) {
            if (!$t) continue;
            $tracks[] = sp_track($t) + [
                'album' => $t['album']['name'] ?? '', 'album_uri' => $t['album']['uri'] ?? null,
                'album_artist' => implode(', ', array_map(fn($x) => $x['name'], $t['album']['artists'] ?? [])),
                'album_image' => sp_img($t['album']['images'] ?? [], 300), 'album_image_large' => sp_img($t['album']['images'] ?? [], 640),
                'album_url' => $t['album']['external_urls']['spotify'] ?? null,
            ];
        }
        $artists = [];
        foreach ($j['artists']['items'] ?? [] as $a) {
            if (!$a || empty($a['id'])) continue;
            $artists[] = ['id' => $a['id'], 'name' => $a['name'] ?? '', 'image' => sp_img($a['images'] ?? [], 160), 'genres' => array_slice($a['genres'] ?? [], 0, 2)];
        }
        $playlists = [];
        foreach ($j['playlists']['items'] ?? [] as $p) {
            if (!$p || empty($p['uri'])) continue; // Spotify leaves holes (null) in this list
            $playlists[] = [
                'id' => $p['id'], 'uri' => $p['uri'], 'name' => $p['name'] ?? '',
                'owner' => $p['owner']['display_name'] ?? '',
                'image' => sp_img($p['images'] ?? [], 300), 'thumb' => sp_img($p['images'] ?? [], 64),
                'count' => $p['tracks']['total'] ?? ($p['items']['total'] ?? null),
                'url' => $p['external_urls']['spotify'] ?? null,
            ];
        }
        out(['albums' => $albums, 'tracks' => $tracks, 'playlists' => array_slice($playlists, 0, 8), 'artists' => array_slice($artists, 0, 6)]);
    }

    case 'spotify_save': {
        // put an album in the library (it then shows up on the record shelf)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $uri = (string)(body()['uri'] ?? '');
        if (!preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', $uri, $m)) fail('Ugyldig album.');
        if (!sp_has_scope('user-library-modify')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        // Spotify's "save albums" endpoint; the newer library endpoint as a fallback
        [$s, $j] = sp_api('PUT', '/me/albums?ids=' . $m[1]);
        if ($s >= 400 && $s !== 401) [$s, $j] = sp_api('PUT', '/me/library?uris=' . rawurlencode($uri));
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s === 403) fail('Spotify sa nei til å lagre albumet (' . ($j['error']['message'] ?? '403') . ').', 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_albums_v3', 'cache_albums_v4');
        out(['ok' => true]);
    }

    case 'spotify_unsave': {
        // take an album out of the library again
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $uri = (string)(body()['uri'] ?? '');
        if (!preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', $uri, $m)) fail('Ugyldig album.');
        if (!sp_has_scope('user-library-modify')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        [$s, $j] = sp_api('DELETE', '/me/albums?ids=' . $m[1]);
        if ($s >= 400 && $s !== 401) [$s, $j] = sp_api('DELETE', '/me/library?uris=' . rawurlencode($uri));
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_albums_v3', 'cache_albums_v4');
        out(['ok' => true]);
    }

    case 'spotify_follow': {
        // save someone else's playlist to my library (it then shows up among my playlists / on the iPod)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $pl = (string)(body()['playlist'] ?? '');
        if (!preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', $pl, $m)) fail('Ugyldig spilleliste.');
        if (!sp_has_scope('playlist-modify-public') && !sp_has_scope('playlist-modify-private')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        [$s, $j] = sp_api('PUT', '/playlists/' . $m[1] . '/followers', ['public' => false]);
        if ($s >= 400 && $s !== 401) [$s, $j] = sp_api('PUT', '/me/library?uris=' . rawurlencode($pl));
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . '): ' . ($j['error']['message'] ?? ''), 502);
        kv_del('cache_playlists_v3');
        out(['ok' => true]);
    }

    case 'spotify_playlist_create': {
        // a new, empty playlist of my own (private)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $name = mb_substr(trim((string)(body()['name'] ?? '')), 0, 100);
        if ($name === '') fail('Gi spillelisten et navn.');
        if (!sp_has_scope('playlist-modify-private') && !sp_has_scope('playlist-modify-public')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        $payload = ['name' => $name, 'public' => false, 'description' => 'Laget på niben.no'];
        [$s, $j] = sp_api('POST', '/me/playlists', $payload); // (the newer path)
        if ($s >= 400 && $s !== 401) {
            [$ms, $me] = sp_api('GET', '/me');
            if ($ms === 200 && !empty($me['id'])) [$s, $j] = sp_api('POST', '/users/' . rawurlencode($me['id']) . '/playlists', $payload);
        }
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300 || empty($j['uri'])) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_playlists_v3', 'cache_playlists_v4');
        out(['ok' => true, 'uri' => $j['uri'], 'name' => $j['name'] ?? $name]);
    }

    case 'spotify_playlist_image': {
        // my own picture on one of my playlists (multipart: playlist, file). Spotify wants a square JPEG under 256 kB as base64, and a
        // login that includes "ugc-image-upload" – so the picture is cropped and squeezed here first.
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $pl = (string)($_POST['playlist'] ?? '');
        if (!preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', $pl, $m)) fail('Ugyldig spilleliste.');
        if (!sp_has_scope('ugc-image-upload')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        $f = $_FILES['file'] ?? null;
        if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('Fikk ikke bildet.');
        if (($f['size'] ?? 0) > 12 * 1024 * 1024) fail('Bildet er for stort.', 413);
        if (!function_exists('imagecreatefromstring')) fail('Serveren kan ikke behandle bilder (GD mangler).', 500);
        $im = @imagecreatefromstring((string)file_get_contents($f['tmp_name']));
        if (!$im) fail('Det er ikke et bilde jeg kan lese.');
        $w = imagesx($im); $h = imagesy($im); $side = min($w, $h);
        $sq = imagecreatetruecolor(480, 480);
        imagecopyresampled($sq, $im, 0, 0, intdiv($w - $side, 2), intdiv($h - $side, 2), 480, 480, $side, $side);
        $b64 = '';
        foreach ([88, 78, 68, 58, 48] as $q) {
            ob_start(); imagejpeg($sq, null, $q); $b64 = base64_encode((string)ob_get_clean());
            if (strlen($b64) <= 250000) break;
        }
        if (strlen($b64) > 256000) fail('Bildet ble for stort selv etter komprimering – prøv et enklere bilde.');
        $tok = sp_access_token();
        if (!$tok) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        [$s, $res] = http_req('PUT', 'https://api.spotify.com/v1/playlists/' . $m[1] . '/images', ['Authorization: Bearer ' . $tok, 'Content-Type: image/jpeg'], $b64);
        if ($s === 401 || $s === 403) out(['error' => 'Spotify ville ikke ta imot bildet (' . $s . '). Er det din egen spilleliste? Ellers: koble til Spotify på nytt.', 'code' => 'scope'], 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_playlists_v3', 'cache_playlists_v4');
        out(['ok' => true]);
    }

    case 'spotify_playlist_delete': {
        // "delete" a playlist = stop following it (Spotify never really deletes them – it only takes it out of my library)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $pl = (string)(body()['playlist'] ?? '');
        if (!preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', $pl, $m)) fail('Ugyldig spilleliste.');
        if (!sp_has_scope('playlist-modify-public') && !sp_has_scope('playlist-modify-private')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        [$s, $j] = sp_api('DELETE', '/playlists/' . $m[1] . '/followers');
        if ($s >= 400 && $s !== 401) [$s, $j] = sp_api('DELETE', '/me/library?uris=' . rawurlencode($pl));
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_playlists_v3', 'cache_playlists_v4');
        // and out of my folders
        $d = sp_groups_load();
        if (isset($d['assign'][$pl])) { unset($d['assign'][$pl]); $d['auto'] = array_values(array_diff($d['auto'] ?? [], [$pl])); kv_set('groups', json_encode($d, JSON_UNESCAPED_UNICODE)); }
        out(['ok' => true]);
    }

    case 'spotify_playlist_add': {
        // add a song to one of my playlists
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $pl = (string)(body()['playlist'] ?? '');
        $track = (string)(body()['uri'] ?? '');
        if (!preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', $pl, $m)) fail('Ugyldig spilleliste.');
        if (!preg_match('~^spotify:track:[A-Za-z0-9]{10,40}$~', $track)) fail('Ugyldig låt.');
        if (!sp_has_scope('playlist-modify-private')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        // "add items to playlist": the newer /items path first (reading uses it too), the old /tracks path as a fallback
        [$s, $j] = sp_api('POST', '/playlists/' . $m[1] . '/items', ['uris' => [$track]]);
        if ($s >= 400 && $s !== 401) {
            [$s2, $j2] = sp_api('POST', '/playlists/' . $m[1] . '/tracks', ['uris' => [$track]]);
            if ($s2 < 300) [$s, $j] = [$s2, $j2];
        }
        if ($s === 403) out(['error' => 'Spotify sier nei – du kan bare legge til i lister du har laget selv (eller som er samarbeidslister).', 'code' => 'forbidden'], 403);
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_playlists_v3', 'cache_playlists_v4', 'tracks2_playlist_' . $m[1], 'tracks4_playlist_' . $m[1], 'tracks5_playlist_' . $m[1]);
        out(['ok' => true]);
    }

    case 'spotify_play': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $lock = sp_lock_until();
        if ($lock > time()) {
            out(['error' => 'Låst – du kan bytte om ' . ceil(($lock - time()) / 60) . ' min.', 'lock_until' => $lock, 'server_time' => time()], 423);
        }
        $uri = (string)(body()['uri'] ?? '');
        if (!preg_match('~^spotify:(album|playlist|track):[A-Za-z0-9]{10,40}$~', $uri, $m)) fail('Ugyldig Spotify-lenke.');
        $payload = $m[1] === 'track' ? ['uris' => [$uri]] : ['context_uri' => $uri];
        // optionally start at a given track inside the album/playlist
        $start = (string)(body()['track'] ?? '');
        if ($start !== '' && $m[1] !== 'track') {
            if (!preg_match('~^spotify:track:[A-Za-z0-9]{10,40}$~', $start)) fail('Ugyldig låt.');
            $payload['offset'] = ['uri' => $start];
        }

        // play on a specific device, e.g. the browser player on niben.no
        $device = (string)(body()['device'] ?? '');
        if ($device !== '' && !preg_match('~^[A-Za-z0-9]{20,64}$~', $device)) fail('Ugyldig enhet.');
        // an album is played in order from its start (or from the chosen song). A shuffle left on – e.g. from
        // the iPod – would otherwise start it in the middle of the album and jump around
        $isAlbum = $m[1] === 'album';
        $shuffleOff = fn() => sp_api('PUT', '/me/player/shuffle?state=false' . ($device !== '' ? '&device_id=' . rawurlencode($device) : ''));
        if ($isAlbum) {
            if (!isset($payload['offset'])) $payload['offset'] = ['position' => 0];
            $shuffleOff(); // best effort: there may be no active device yet
        }
        // fallback: when the asked-for device can't be reached, play on another of my devices instead
        $fallback = !empty(body()['fallback']);
        $playOn = function (string $dev) use ($payload) {
            $r = sp_api('PUT', '/me/player/play' . ($dev !== '' ? '?device_id=' . rawurlencode($dev) : ''), $payload);
            // Spotify has short hiccups (5xx): one more try
            if ($r[0] >= 500) { usleep(600000); $r = sp_api('PUT', '/me/player/play' . ($dev !== '' ? '?device_id=' . rawurlencode($dev) : ''), $payload); }
            return $r;
        };
        $usedName = null;
        [$s, $j] = $playOn($device);
        if ($s === 404 && $device !== '') {
            // a fresh browser player isn't always known to Spotify yet (especially when nothing else is
            // playing): wait until it shows up in the device list, hand playback over to it, then play
            $deadline = microtime(true) + 7;
            while ($s === 404 && microtime(true) < $deadline) {
                [$ds, $dj] = sp_api('GET', '/me/player/devices');
                $known = in_array($device, array_column($dj['devices'] ?? [], 'id'), true);
                if ($known) {
                    sp_api('PUT', '/me/player', ['device_ids' => [$device], 'play' => false]);
                    usleep(400000);
                    [$s, $j] = $playOn($device);
                }
                if ($s === 404) usleep(600000);
            }
            if ($s === 404 && !$fallback) out(['error' => 'Spotify finner ikke avspilleren på siden.', 'code' => 'device_missing'], 409);
        }
        if ($s === 404) {
            // no (reachable) device: wake the most likely other one – the active one first, then a computer,
            // then a phone, then anything else that may be controlled
            [$ds, $dj] = sp_api('GET', '/me/player/devices');
            $devices = array_values(array_filter($dj['devices'] ?? [], fn($d) => empty($d['is_restricted']) && ($d['id'] ?? '') !== $device));
            $rank = fn($d) => (!empty($d['is_active']) ? 0 : 10) + (['Computer' => 0, 'Smartphone' => 1, 'Speaker' => 2][$d['type'] ?? ''] ?? 3);
            usort($devices, fn($a, $b) => $rank($a) <=> $rank($b));
            if (!$devices) out(['error' => 'Ingen Spotify-enhet er åpen. Åpne Spotify på mobilen eller Macen og prøv igjen.', 'code' => 'no_device'], 409);
            foreach ($devices as $d) {
                sp_api('PUT', '/me/player', ['device_ids' => [$d['id']], 'play' => false]);
                usleep(300000);
                [$s, $j] = $playOn($d['id']);
                if ($s < 300) { $usedName = $d['name'] ?? 'en annen enhet'; break; }
            }
        }
        if ($s === 403) {
            $reason = $j['error']['reason'] ?? '';
            fail($reason === 'PREMIUM_REQUIRED' ? 'Avspilling krever Spotify Premium.' : 'Spotify tillot ikke avspillingen akkurat nå (' . ($j['error']['message'] ?? $reason ?: '403') . ').', 403);
        }
        if ($s === 401) out(['error' => 'Spotify-tilkoblingen har gått ut. Koble til på nytt.', 'code' => 'reconnect'], 409);
        if ($s === 404) out(['error' => 'Fant ingen Spotify-enhet som svarte. Åpne Spotify et sted og prøv igjen.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . '): ' . ($j['error']['message'] ?? 'ukjent'), 502);

        if ($isAlbum) $shuffleOff(); // again now that the device is certainly the active one
        $until = time() + sp_lock_seconds();
        kv_set('lock_until', (string)$until);
        kv_set('lock_started', (string)time());
        kv_set('lock_album', $isAlbum ? $uri : ''); // an album: the lock goes off when it has been heard to the end
        kv_del('cache_now');
        out(['ok' => true, 'lock_until' => $until, 'server_time' => time(), 'device_name' => $usedName]);
    }
    }
}
