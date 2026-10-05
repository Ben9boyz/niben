<?php
// The queue, kept by us instead of Spotify (Spotify's queue can only be added to – no deleting, no reordering – and
// adding a whole album song by song through it was unreliable: only the first few songs went in).
//
// We keep an ordered list of what plays next ("plan"): first what I have queued ("nq" songs), then the rest of the
// album / playlist that is playing. Every change is sent to Spotify as ONE request: "keep playing this song, from where
// it is, then continue with exactly this list". So one call carries a whole album (up to 99 songs), and the list
// can be changed in any way: add, remove, reorder. The page shows it grouped by album.

const QP_KEY = 'queue_plan';

/** What is playing now (uncached), or null. */
function qp_state(): ?array {
    [$s, $j] = sp_api('GET', '/me/player?additional_types=track');
    if ($s !== 200 || empty($j['item']) || ($j['currently_playing_type'] ?? 'track') !== 'track') return null;
    return [
        'uri' => (string)$j['item']['uri'], 'progress' => (int)($j['progress_ms'] ?? 0), 'playing' => !empty($j['is_playing']),
        'context' => $j['context']['uri'] ?? null, 'shuffle' => !empty($j['shuffle_state']), 'device' => $j['device']['id'] ?? null,
    ];
}

/** A song in the shape the page needs. */
function qp_item(array $t, ?array $album = null): array {
    $al = $album ?? ($t['album'] ?? []);
    return [
        'uri' => (string)($t['uri'] ?? ''), 'name' => (string)($t['name'] ?? ''),
        'artist' => implode(', ', array_map(fn($x) => $x['name'], $t['artists'] ?? [])),
        'ms' => (int)($t['duration_ms'] ?? 0), 'no' => $t['track_number'] ?? null, 'disc' => $t['disc_number'] ?? null,
        'album' => (string)($al['name'] ?? ''), 'album_uri' => $al['uri'] ?? null,
        'album_artist' => implode(', ', array_map(fn($x) => $x['name'], $al['artists'] ?? [])),
        'img' => sp_img($al['images'] ?? [], 64), 'album_image' => sp_img($al['images'] ?? [], 300),
    ];
}
function qp_from_sp_track(array $t): array { // from sp_track()'s shape (what sp_tracks() returns)
    return [
        'uri' => (string)($t['uri'] ?? ''), 'name' => (string)($t['name'] ?? ''), 'artist' => (string)($t['artist'] ?? ''), 'ms' => (int)($t['ms'] ?? 0),
        'no' => $t['n'] ?? null, 'disc' => null,
        'album' => (string)($t['album'] ?? ''), 'album_uri' => $t['album_uri'] ?? null, 'album_artist' => (string)($t['album_artist'] ?? ''),
        'img' => $t['img'] ?? null, 'album_image' => $t['album_image'] ?? null,
    ];
}

/** All the songs of an album, as items (cached 6 h). */
function qp_album_items(string $id): array {
    $res = sp_cached('qpalb_' . $id, 21600, function () use ($id) {
        [$s, $a] = sp_api('GET', "/albums/{$id}");
        if ($s !== 200 || !is_array($a)) return null;
        $items = [];
        foreach ($a['tracks']['items'] ?? [] as $t) $items[] = qp_item($t, $a);
        $next = $a['tracks']['next'] ?? null;
        for ($off = 50; $next && $off < 300; $off += 50) {
            [$s2, $j] = sp_api('GET', "/albums/{$id}/tracks?limit=50&offset={$off}");
            if ($s2 !== 200) break;
            foreach ($j['items'] ?? [] as $t) $items[] = qp_item($t, $a);
            $next = $j['next'] ?? null;
        }
        return $items;
    });
    return $res ?: [];
}

/** Songs by uri (for single songs added to the queue). */
function qp_tracks(array $uris): array {
    $ids = [];
    foreach ($uris as $u) if (preg_match('~^spotify:track:([A-Za-z0-9]{10,40})$~', (string)$u, $m)) $ids[] = $m[1];
    $out = [];
    foreach (array_chunk($ids, 20) as $chunk) {
        [$s, $j] = sp_api('GET', '/tracks?ids=' . implode(',', $chunk));
        if ($s !== 200) continue;
        foreach ($j['tracks'] ?? [] as $t) if ($t) $out[$t['uri']] = qp_item($t);
    }
    $ordered = [];
    foreach ($uris as $u) if (isset($out[$u])) $ordered[] = $out[$u];
    return $ordered;
}

/** What follows the current song in the album / playlist that is playing (or Spotify's own queue when that can't be known). */
function qp_rest(array $cur): array {
    $ctx = (string)($cur['context'] ?? '');
    if (!$cur['shuffle'] && preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', $ctx, $m)) {
        $all = qp_album_items($m[1]);
    } elseif (!$cur['shuffle'] && preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', $ctx, $m)) {
        $all = array_map('qp_from_sp_track', (sp_tracks('playlist', $m[1])['tracks'] ?? []));
    } else $all = null;
    if ($all) {
        $i = array_search($cur['uri'], array_column($all, 'uri'), true);
        if ($i !== false) return array_slice($all, $i + 1, 98);
    }
    [$s, $j] = sp_api('GET', '/me/player/queue');
    $out = [];
    if ($s === 200) foreach (array_slice($j['queue'] ?? [], 0, 40) as $t) if ($t && ($t['type'] ?? 'track') === 'track') $out[] = qp_item($t);
    return $out;
}

/** The plan, brought up to date: what has played is dropped; a different song than expected = start over from its context. */
function qp_load(?array $cur): array {
    $plan = json_decode((string)kv_get(QP_KEY), true);
    if (!is_array($plan) || !isset($plan['items'])) $plan = ['items' => [], 'nq' => 0, 'for' => null];
    if (!$cur) return $plan;
    $before = json_encode($plan);
    $uris = array_column($plan['items'], 'uri');
    $i = array_search($cur['uri'], $uris, true);
    if ($i !== false) {
        $plan['items'] = array_slice($plan['items'], $i + 1);
        $plan['nq'] = max(0, (int)$plan['nq'] - ($i + 1));
    } elseif ($plan['for'] !== $cur['uri'] || !$plan['items']) {
        $plan = ['items' => qp_rest($cur), 'nq' => 0, 'for' => $cur['uri']];
    }
    $plan['for'] = $cur['uri'];
    if (json_encode($plan) !== $before) kv_set(QP_KEY, json_encode($plan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $plan;
}
function qp_store(array $plan): void { kv_set(QP_KEY, json_encode($plan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); kv_del('cache_qget', 'cache_queue', 'cache_queue4'); }

/** Tell Spotify: keep this song, then play exactly this list. */
function qp_apply(array $cur, array $items): bool {
    $uris = array_values(array_filter(array_slice(array_column($items, 'uri'), 0, 99), fn($u) => preg_match('~^spotify:track:~', (string)$u)));
    $q = $cur['device'] ? '?device_id=' . rawurlencode((string)$cur['device']) : '';
    [$s] = sp_api('PUT', '/me/player/play' . $q, ['uris' => array_merge([$cur['uri']], $uris), 'offset' => ['position' => 0], 'position_ms' => $cur['progress']]);
    if ($s < 300 && !$cur['playing']) sp_api('PUT', '/me/player/pause' . $q);
    kv_del('cache_now');
    return $s < 300;
}

function qp_clean_items(array $in): array {
    $out = [];
    foreach (array_slice($in, 0, 99) as $x) {
        if (!is_array($x) || !preg_match('~^spotify:track:[A-Za-z0-9]{10,40}$~', (string)($x['uri'] ?? ''))) continue;
        $out[] = [
            'uri' => $x['uri'], 'name' => mb_substr((string)($x['name'] ?? ''), 0, 200), 'artist' => mb_substr((string)($x['artist'] ?? ''), 0, 200),
            'ms' => (int)($x['ms'] ?? 0), 'no' => isset($x['no']) ? (int)$x['no'] : null, 'disc' => isset($x['disc']) ? (int)$x['disc'] : null,
            'album' => mb_substr((string)($x['album'] ?? ''), 0, 200), 'album_uri' => preg_match('~^spotify:album:[A-Za-z0-9]{10,40}$~', (string)($x['album_uri'] ?? '')) ? $x['album_uri'] : null,
            'album_artist' => mb_substr((string)($x['album_artist'] ?? ''), 0, 200),
            'img' => is_string($x['img'] ?? null) ? mb_substr($x['img'], 0, 255) : null, 'album_image' => is_string($x['album_image'] ?? null) ? mb_substr($x['album_image'], 0, 255) : null,
        ];
    }
    return $out;
}

function queue_handle(string $action, bool $post): void {
    switch ($action) {
    case 'queue_get': {
        // anyone may look (cached for 4 seconds)
        $r = sp_cached('cache_qget', 4, function () {
            $cur = qp_state();
            $plan = qp_load($cur);
            return ['items' => $plan['items'], 'nq' => (int)$plan['nq'], 'now' => $cur['uri'] ?? null];
        });
        out($r ?? ['items' => [], 'nq' => 0, 'now' => null]);
    }
    case 'queue_add': {
        // { album: 'spotify:album:…' } or { tracks: ['spotify:track:…', …] }, optional next: true (before the rest of what I queued)
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        @set_time_limit(60);
        $b = body();
        $cur = qp_state();
        if (!$cur) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        $add = [];
        if (!empty($b['playlist'])) {
            if (!preg_match('~^spotify:playlist:([A-Za-z0-9]{10,40})$~', (string)$b['playlist'], $m)) fail('Ugyldig spilleliste.');
            $add = array_values(array_filter(array_map('qp_from_sp_track', (sp_tracks('playlist', $m[1])['tracks'] ?? [])), fn($x) => preg_match('~^spotify:track:~', $x['uri'])));
            if (!$add) fail('Fant ingen låter i spillelisten.', 404);
        } elseif (!empty($b['album'])) {
            if (!preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', (string)$b['album'], $m)) fail('Ugyldig album.');
            $add = qp_album_items($m[1]);
            if (!$add) fail('Fant ingen låter i albumet.', 404);
        } else {
            $add = qp_tracks(array_slice((array)($b['tracks'] ?? []), 0, 50));
            if (!$add) fail('Ugyldig låt.');
        }
        $plan = qp_load($cur);
        $at = !empty($b['next']) ? 0 : (int)$plan['nq'];
        array_splice($plan['items'], $at, 0, $add);
        $plan['nq'] = (int)$plan['nq'] + count($add);
        $plan['items'] = array_slice($plan['items'], 0, 99);
        $plan['nq'] = min((int)$plan['nq'], count($plan['items']));
        $plan['for'] = $cur['uri'];
        qp_store($plan);
        if (!qp_apply($cur, $plan['items'])) fail('Spotify tok ikke imot køen (prøv igjen om litt).', 502);
        out(['ok' => true, 'added' => count($add), 'items' => $plan['items'], 'nq' => $plan['nq']]);
    }
    case 'queue_save': {
        // the whole list in its new order: { items: [...], nq } – reordered, with things removed
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = body();
        $cur = qp_state();
        if (!$cur) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        $items = qp_clean_items((array)($b['items'] ?? []));
        $plan = ['items' => $items, 'nq' => max(0, min((int)($b['nq'] ?? 0), count($items))), 'for' => $cur['uri']];
        qp_store($plan);
        if (!qp_apply($cur, $items)) fail('Spotify tok ikke imot køen (prøv igjen om litt).', 502);
        out(['ok' => true, 'items' => $items, 'nq' => $plan['nq']]);
    }
    }
}
