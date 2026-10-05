<?php
// More of the Spotify player: the queue, my devices (switch / volume), repeat, liked songs.
// Kept apart from _spotify.inc.php (uses its sp_api / sp_cached / kv_del).

function sp_more_handle(string $action, bool $post): bool {
    $id = fn(string $uri, string $type) => preg_match('~^spotify:' . $type . ':([A-Za-z0-9]{10,40})$~', $uri, $m) ? $m[1] : null;
    switch ($action) {
    case 'spotify_queue': {
        // what's coming up (anyone may look – cached for 10 seconds)
        $q = sp_cached('cache_queue', 10, function () {
            [$s, $j] = sp_api('GET', '/me/player/queue');
            if ($s !== 200) return ['tracks' => []];
            $out = [];
            foreach (array_slice($j['queue'] ?? [], 0, 20) as $t) {
                if (!$t) continue;
                $album = $t['album'] ?? $t['show'] ?? [];
                $out[] = ['uri' => $t['uri'] ?? null, 'name' => $t['name'] ?? '', 'artist' => implode(', ', array_map(fn($x) => $x['name'], $t['artists'] ?? [])),
                    'img' => sp_img($album['images'] ?? [], 64), 'ms' => (int)($t['duration_ms'] ?? 0)];
            }
            return ['tracks' => $out];
        });
        out($q ?? ['tracks' => []]);
    }
    case 'spotify_devices': {
        require_admin();
        [$s, $j] = sp_api('GET', '/me/player/devices');
        if ($s !== 200) fail('Fikk ikke hentet enhetene.', 502);
        $out = array_map(fn($d) => ['id' => $d['id'], 'name' => $d['name'], 'type' => $d['type'], 'active' => !empty($d['is_active']),
            'volume' => $d['volume_percent'] ?? null, 'restricted' => !empty($d['is_restricted'])], $j['devices'] ?? []);
        out(['devices' => $out]);
    }
    case 'spotify_transfer': {
        // move playback to one of my devices (keeps playing if it was)
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $dev = (string)(body()['device'] ?? '');
        if (!preg_match('~^[A-Za-z0-9]{20,64}$~', $dev)) fail('Ugyldig enhet.');
        [$s, $j] = sp_api('PUT', '/me/player', ['device_ids' => [$dev], 'play' => !empty(body()['play'])]);
        if ($s >= 300) fail('Spotify kunne ikke flytte avspillingen (' . $s . ').', 502);
        kv_del('cache_now');
        out(['ok' => true]);
    }
    case 'spotify_volume': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $v = max(0, min(100, (int)(body()['percent'] ?? 50)));
        [$s, $j] = sp_api('PUT', '/me/player/volume?volume_percent=' . $v);
        if ($s === 403) fail('Denne enheten lar seg ikke styre volumet på.', 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        out(['ok' => true]);
    }
    case 'spotify_repeat': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $state = (string)(body()['state'] ?? 'off');
        if (!in_array($state, ['off', 'context', 'track'], true)) fail('Ugyldig valg.');
        [$s, $j] = sp_api('PUT', '/me/player/repeat?state=' . $state);
        if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_now');
        out(['ok' => true]);
    }
    case 'spotify_enqueue': {
        // put a song next in the queue (doesn't switch what's playing, so the lock doesn't apply)
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $uri = (string)(body()['uri'] ?? '');
        if (!$id($uri, 'track')) fail('Ugyldig låt.');
        [$s, $j] = sp_api('POST', '/me/player/queue?uri=' . rawurlencode($uri));
        if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_queue');
        out(['ok' => true]);
    }
    case 'spotify_liked': {
        // is the song saved in my "Liked songs"? (GET ?uri=) – and save / remove it (POST)
        require_admin();
        $uri = (string)($post ? (body()['uri'] ?? '') : ($_GET['uri'] ?? ''));
        $tid = $id($uri, 'track');
        if (!$tid) fail('Ugyldig låt.');
        if (!$post) {
            [$s, $j] = sp_api('GET', '/me/tracks/contains?ids=' . $tid);
            out(['liked' => $s === 200 && !empty($j[0])]);
        }
        if (!sp_has_scope('user-library-modify')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        $on = !empty(body()['on']);
        [$s, $j] = sp_api($on ? 'PUT' : 'DELETE', '/me/tracks?ids=' . $tid);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        out(['ok' => true, 'liked' => $on]);
    }
    }
    return false;
}
