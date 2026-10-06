<?php
// More of the Spotify player: the queue, my devices (switch / volume), repeat, liked songs.
// Kept apart from _spotify.inc.php (uses its sp_api / sp_cached / kv_del).


// ── groups: my albums and playlists sorted into a few groups of my own ("Jobb og fokus", "Trening" …) ──
const SP_DEFAULT_GROUPS = [
    ['id' => 'fokus', 'name' => 'Jobb og fokus'],
    ['id' => 'jazz', 'name' => 'Jazz fusion', 'parent' => 'fokus'], // a folder inside "Jobb og fokus"
    ['id' => 'trening', 'name' => 'Trening'],
    ['id' => 'rolig', 'name' => 'Rolig'],
    ['id' => 'annet', 'name' => 'Annet'],
];

function sp_groups_load(): array {
    $raw = kv_get('groups');
    $d = $raw ? json_decode($raw, true) : null;
    if (!is_array($d) || empty($d['groups'])) $d = ['groups' => SP_DEFAULT_GROUPS, 'assign' => [], 'auto' => []];
    $d['assign'] = $d['assign'] ?? [];
    $d['auto'] = $d['auto'] ?? [];
    $d['why'] = $d['why'] ?? [];
    return $d;
}

/** A first guess at where something belongs, from its name (and artist). Rough – I move the wrong ones myself. */
function sp_guess_group(string $text, array $ids, string $fallback): string {
    $t = mb_strtolower($text);
    $rules = [
        'fokus' => ['fokus', 'focus', 'study', 'studer', 'jobb', 'work', 'lofi', 'lo-fi', 'ambient', 'instrumental', 'piano', 'soundtrack', 'score', 'motion picture', 'ost', 'klassisk', 'classical', 'konsentrasjon', 'concentration', 'deep work'],
        'trening' => ['trening', 'workout', 'gym', 'løp', 'run', 'running', 'cardio', 'pump', 'hiit'],
        'rolig' => ['rolig', 'chill', 'sleep', 'søvn', 'relax', 'søndag', 'morgen', 'calm', 'akustisk', 'acoustic', 'kveld', 'natt', 'mellow'],
    ];
    foreach ($rules as $id => $words) {
        if (!in_array($id, $ids, true)) continue;
        foreach ($words as $w) {
            // short words must stand alone ("run", "ost"); long ones may start a compound ("søndagsmorgen", "treningsmiks")
            $end = mb_strlen($w) <= 4 ? '(?![\p{L}])' : '';
            if (preg_match('/(?<![\p{L}])' . preg_quote($w, '/') . $end . '/u', $t)) return $id;
        }
    }
    return $fallback;
}


/** Genres of the artists on some albums (Spotify): albumUri => [genre, …]. Best effort – empty when Spotify won't tell. */
function sp_album_genres(array $albumUris): array {
    $out = [];
    $albumUris = array_slice(array_values($albumUris), 0, 100);
    $artistsOf = []; // albumUri => [artistId, …]
    foreach (array_chunk($albumUris, 20) as $chunk) {
        $ids = [];
        foreach ($chunk as $u) if (preg_match('~^spotify:album:([A-Za-z0-9]{10,40})$~', $u, $m)) $ids[$m[1]] = $u;
        if (!$ids) continue;
        [$s, $j] = sp_api('GET', '/albums?ids=' . implode(',', array_keys($ids)));
        if ($s !== 200) return $out; // not allowed / not available: leave it to the names
        foreach ($j['albums'] ?? [] as $a) {
            if (!$a || empty($ids[$a['id'] ?? ''])) continue;
            $artistsOf[$ids[$a['id']]] = array_slice(array_column($a['artists'] ?? [], 'id'), 0, 2);
        }
    }
    $genresOfArtist = [];
    $allArtists = array_values(array_unique(array_merge(...array_values($artistsOf ?: [[]]))));
    foreach (array_chunk($allArtists, 50) as $chunk) {
        [$s, $j] = sp_api('GET', '/artists?ids=' . implode(',', array_filter($chunk)));
        if ($s !== 200) return $out;
        foreach ($j['artists'] ?? [] as $ar) if ($ar) $genresOfArtist[$ar['id']] = $ar['genres'] ?? [];
    }
    foreach ($artistsOf as $uri => $artists) {
        $g = [];
        foreach ($artists as $aid) $g = array_merge($g, $genresOfArtist[$aid] ?? []);
        if ($g) $out[$uri] = array_values(array_unique($g));
    }
    return $out;
}

/** A group from a list of genres (null when they say nothing). Returns [groupId, the genre that decided]. */
function sp_guess_by_genres(array $genres, array $ids): ?array {
    $rules = [
        'jazz' => ['jazz fusion', 'fusion', 'jazz'],
        'fokus' => ['ambient', 'lo-fi', 'lofi', 'classical', 'soundtrack', 'score', 'post-rock', 'instrumental', 'new age', 'minimal', 'neo-classical', 'study', 'focus', 'drone'],
        'trening' => ['metal', 'hardcore', 'edm', 'drum and bass', 'dubstep', 'hardstyle', 'workout', 'trap', 'big room'],
        'rolig' => ['acoustic', 'folk', 'singer-songwriter', 'sleep', 'chill', 'easy listening', 'bossa nova', 'mellow'],
    ];
    foreach ($rules as $id => $words) {
        if (!in_array($id, $ids, true)) continue;
        foreach ($words as $w) foreach ($genres as $g) if (str_contains(mb_strtolower($g), $w)) return [$id, $g];
    }
    return null;
}


/** Spotify's audio data for songs (instrumentalness, energy, speechiness, acousticness) – trackId => [...].
 *  Apps made after late 2024 are refused (403); then this answers null and is not asked again for a week. */
/** Tempo (BPM) of a song, so the record on the 3D turntable can spin in time with it. Spotify's audio features when
 *  the app may use them, else Deezer's public track data (found through the song's ISRC). 0 = nobody knows. Cached 30 days. */
function sp_tempo(string $id): ?array {
    return sp_cached("tempo1_{$id}", 30 * 86400, function () use ($id) {
        $f = sp_audio_features([$id]);
        if ($f && !empty($f[$id]['tempo'])) return ['bpm' => round((float)$f[$id]['tempo'], 1), 'from' => 'spotify'];
        [$s, $t] = sp_api('GET', "/tracks/{$id}");
        if ($s !== 200) return null; // Spotify hiccup: try again next time
        $isrc = preg_replace('~[^A-Za-z0-9]~', '', (string)($t['external_ids']['isrc'] ?? ''));
        if ($isrc !== '') {
            [$code, $body] = http_req('GET', 'https://api.deezer.com/track/isrc:' . $isrc, ['Accept: application/json']);
            $j = $code === 200 ? json_decode($body, true) : null;
            if (is_array($j) && (float)($j['bpm'] ?? 0) > 30) return ['bpm' => round((float)$j['bpm'], 1), 'from' => 'deezer'];
            if ($code !== 200 && $code !== 404) return null;
        }
        return ['bpm' => 0, 'from' => 'none'];
    }, true);
}

function sp_audio_features(array $trackIds): ?array {
    if (kv_get('audio_features') === 'no' && time() - (int)kv_get('audio_features_at') < 7 * 86400) return null;
    $trackIds = array_slice(array_values(array_filter($trackIds)), 0, 100);
    if (!$trackIds) return [];
    [$s, $j] = sp_api('GET', '/audio-features?ids=' . implode(',', $trackIds));
    if ($s === 403 || $s === 404 || $s === 410) { kv_set('audio_features', 'no'); kv_set('audio_features_at', (string)time()); return null; }
    if ($s !== 200) return null;
    kv_set('audio_features', 'yes');
    $out = [];
    foreach ($j['audio_features'] ?? [] as $f) if ($f && !empty($f['id'])) $out[$f['id']] = $f;
    return $out;
}

/** A group from the average audio data of some songs: [groupId, why] or null. No singing + calm → focus, loud → training, soft + acoustic → calm. */
function sp_guess_by_audio(array $f, array $ids): ?array {
    $n = count($f);
    if (!$n) return null;
    $avg = fn(string $k) => array_sum(array_column($f, $k)) / $n;
    [$instr, $energy, $speech, $acoustic] = [$avg('instrumentalness'), $avg('energy'), $avg('speechiness'), $avg('acousticness')];
    $why = sprintf('lyd: instr. %.2f, energi %.2f', $instr, $energy);
    if ($speech < 0.33 && $instr > 0.5 && $energy < 0.75 && in_array('fokus', $ids, true)) return ['fokus', $why];
    if ($energy > 0.8 && in_array('trening', $ids, true)) return ['trening', $why];
    if ($energy < 0.4 && $acoustic > 0.5 && in_array('rolig', $ids, true)) return ['rolig', $why];
    return null;
}

/** Look at the sound of a few things whose group is only a guess – a few per visit so it never takes long. */
function sp_refine_by_audio(array &$d, array $ids): bool {
    if (kv_get('audio_features') === 'no' && time() - (int)kv_get('audio_features_at') < 7 * 86400) return false;
    $d['af'] = $d['af'] ?? [];
    $todo = array_slice(array_values(array_filter($d['auto'], fn($u) => empty($d['af'][$u]))), 0, 10);
    $changed = false;
    foreach ($todo as $uri) {
        if (!preg_match('~^spotify:(album|playlist):([A-Za-z0-9]{10,40})$~', $uri, $m)) { $d['af'][$uri] = 1; continue; }
        $tracks = sp_tracks($m[1], $m[2])['tracks'] ?? [];
        $tids = [];
        foreach (array_slice($tracks, 0, 12) as $t) if (preg_match('~^spotify:track:([A-Za-z0-9]{10,40})$~', (string)($t['uri'] ?? ''), $mm)) $tids[] = $mm[1];
        $f = $tids ? sp_audio_features($tids) : [];
        if ($f === null) break; // not allowed: stop for now
        $d['af'][$uri] = 1;
        $changed = true;
        $hit = sp_guess_by_audio($f, $ids);
        if ($hit) { $d['assign'][$uri] = $hit[0]; $d['why'][$uri] = $hit[1]; }
    }
    return $changed;
}

/** The groups + where everything is. Anything seen for the first time gets a guess (and is marked as guessed). */
function sp_groups_state(): array {
    $d = sp_groups_load();
    $ids = array_column($d['groups'], 'id');
    $fallback = in_array('annet', $ids, true) ? 'annet' : (string)end($ids);
    $albums = [];
    $items = [];
    foreach (sp_albums() ?? [] as $a) { $items[$a['uri']] = ($a['name'] ?? '') . ' ' . ($a['artist'] ?? ''); $albums[$a['uri']] = true; }
    foreach (sp_playlists() ?? [] as $p) $items[$p['uri']] = (string)($p['name'] ?? '');
    $new = array_filter(array_keys($items), fn($u) => !(isset($d['assign'][$u]) && in_array($d['assign'][$u], $ids, true)));
    $changed = false;
    if ($new) {
        // first time we see something: Spotify's genres for the artists on new albums, else a guess from the name
        $genres = sp_album_genres(array_values(array_filter($new, fn($u) => isset($albums[$u]))));
        foreach ($new as $uri) {
            $hit = isset($genres[$uri]) ? sp_guess_by_genres($genres[$uri], $ids) : null;
            if ($hit) { $d['assign'][$uri] = $hit[0]; $d['why'][$uri] = mb_substr($hit[1], 0, 40); }
            else $d['assign'][$uri] = sp_guess_group($items[$uri], $ids, $fallback);
            $d['auto'][] = $uri;
        }
        $d['auto'] = array_values(array_unique($d['auto']));
        $changed = true;
    }
    // then the sound itself (instrumentalness, energy …) where Spotify still gives that to this app
    if ($d['auto'] && sp_refine_by_audio($d, $ids)) $changed = true;
    if ($changed) kv_set('groups', json_encode($d, JSON_UNESCAPED_UNICODE));
    unset($d['af']);
    $d['audio'] = kv_get('audio_features') ?: null; // 'yes' / 'no' / not tried yet
    return $d;
}

function sp_more_handle(string $action, bool $post): bool {
    $id = fn(string $uri, string $type) => preg_match('~^spotify:' . $type . ':([A-Za-z0-9]{10,40})$~', $uri, $m) ? $m[1] : null;
    switch ($action) {
    case 'spotify_groups': {
        // the groups and what's in them (anyone may look – it's only names)
        out(sp_groups_state());
    }
    case 'spotify_groups_save': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $d = sp_groups_load();
        $b = body();
        if (isset($b['groups']) && is_array($b['groups'])) {
            $groups = [];
            $seen = [];
            $parents = [];
            foreach (array_slice($b['groups'], 0, 12) as $g) {
                $name = mb_substr(trim((string)($g['name'] ?? '')), 0, 40);
                if ($name === '') continue;
                $gid = substr(preg_replace('~[^a-z0-9-]~', '', strtolower((string)($g['id'] ?? ''))), 0, 24);
                if ($gid === '' || isset($seen[$gid])) $gid = 'g' . bin2hex(random_bytes(3));
                $seen[$gid] = true;
                $g2 = ['id' => $gid, 'name' => $name];
                // the picture on the folder: the cover of an album / playlist in my library, 'none', or automatic (left out)
                // my own picture on the folder (uploaded with spotify_group_image): kept only if it is one of my uploads
                $img = (string)($g['img'] ?? '');
                if (preg_match('~^uploads/photos/[a-f0-9]{20}\.jpg$~', $img)) $g2['img'] = $img;
                $cv = (string)($g['cover'] ?? '');
                if ($cv === 'none' || preg_match('~^spotify:(album|playlist):[A-Za-z0-9]{10,40}$~', $cv)) $g2['cover'] = $cv;
                // a folder inside another (one level only): the parent must be a top-level group listed before it
                $par = substr(preg_replace('~[^a-z0-9-]~', '', strtolower((string)($g['parent'] ?? ''))), 0, 24);
                if ($par !== '' && $par !== $gid && isset($seen[$par]) && empty($parents[$par])) { $g2['parent'] = $par; $parents[$gid] = $par; }
                $groups[] = $g2;
            }
            if (!$groups) fail('Du trenger minst én gruppe.');
            // pictures that are no longer on any folder are deleted
            $keepImg = array_filter(array_column($groups, 'img'));
            foreach ($d['groups'] as $og) if (!empty($og['img']) && !in_array($og['img'], $keepImg, true)) delete_upload($og['img']);
            $d['groups'] = $groups;
            // what was in a group that no longer exists moves to the last one
            $ids = array_column($groups, 'id');
            $last = (string)end($ids);
            foreach ($d['assign'] as $u => $gid) if (!in_array($gid, $ids, true)) $d['assign'][$u] = $last;
        }
        if (isset($b['assign']) && is_array($b['assign'])) {
            $ids = array_column($d['groups'], 'id');
            foreach (array_slice($b['assign'], 0, 400, true) as $uri => $gid) {
                if (!preg_match('~^spotify:(album|playlist):[A-Za-z0-9]{10,40}$~', (string)$uri) || !in_array($gid, $ids, true)) continue;
                $d['assign'][$uri] = $gid;
                $d['auto'] = array_values(array_diff($d['auto'], [$uri])); // I have decided this one
            }
        }
        kv_set('groups', json_encode($d, JSON_UNESCAPED_UNICODE));
        out(['ok' => true] + $d);
    }
    case 'spotify_group_image': {
        // my own picture on a folder (multipart: id, file) – resized like the other photos
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $gid = (string)($_POST['id'] ?? '');
        $d = sp_groups_load();
        $at = null;
        foreach ($d['groups'] as $k => $g) if (($g['id'] ?? '') === $gid) $at = $k;
        if ($at === null) fail('Fant ikke mappa.');
        [$path] = save_photo($_FILES['file'] ?? []);
        if (!empty($d['groups'][$at]['img'])) delete_upload($d['groups'][$at]['img']);
        $d['groups'][$at]['img'] = $path;
        unset($d['groups'][$at]['cover']); // my picture wins
        kv_set('groups', json_encode($d, JSON_UNESCAPED_UNICODE));
        out(['ok' => true] + $d);
    }
    case 'spotify_queue': {
        // what's coming up (anyone may look – cached for 10 seconds)
        $q = sp_cached('cache_queue4', 10, function () {
            [$s, $j] = sp_api('GET', '/me/player/queue');
            if ($s !== 200) return ['tracks' => []];
            $out = [];
            foreach (array_slice($j['queue'] ?? [], 0, 20) as $t) {
                if (!$t) continue;
                $album = $t['album'] ?? $t['show'] ?? [];
                $out[] = ['uri' => $t['uri'] ?? null, 'name' => $t['name'] ?? '', 'artist' => implode(', ', array_map(fn($x) => $x['name'], $t['artists'] ?? [])),
                    'img' => sp_img($album['images'] ?? [], 64), 'ms' => (int)($t['duration_ms'] ?? 0),
                    // which album it is on (the 3D table shows the queued albums as a stack)
                    'album_uri' => $album['uri'] ?? null, 'album' => $album['name'] ?? '', 'no' => $t['track_number'] ?? null, 'disc' => $t['disc_number'] ?? null,
                    'album_artist' => implode(', ', array_map(fn($x) => $x['name'], $album['artists'] ?? [])),
                    'album_image' => sp_img($album['images'] ?? [], 300)];
            }
            return ['tracks' => $out];
        });
        out($q ?? ['tracks' => []]);
    }
    case 'spotify_devices': {
        require_room_owner();
        [$s, $j] = sp_api('GET', '/me/player/devices');
        if ($s !== 200) fail('Fikk ikke hentet enhetene.', 502);
        $out = array_map(fn($d) => ['id' => $d['id'], 'name' => $d['name'], 'type' => $d['type'], 'active' => !empty($d['is_active']),
            'volume' => $d['volume_percent'] ?? null, 'restricted' => !empty($d['is_restricted'])], $j['devices'] ?? []);
        out(['devices' => $out]);
    }
    case 'spotify_transfer': {
        // move playback to one of my devices (keeps playing if it was)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $dev = (string)(body()['device'] ?? '');
        if (!preg_match('~^[A-Za-z0-9]{20,64}$~', $dev)) fail('Ugyldig enhet.');
        [$s, $j] = sp_api('PUT', '/me/player', ['device_ids' => [$dev], 'play' => !empty(body()['play'])]);
        if ($s >= 300) fail('Spotify kunne ikke flytte avspillingen (' . $s . ').', 502);
        kv_del('cache_now');
        out(['ok' => true]);
    }
    case 'spotify_volume': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $v = max(0, min(100, (int)(body()['percent'] ?? 50)));
        [$s, $j] = sp_api('PUT', '/me/player/volume?volume_percent=' . $v);
        if ($s === 403) fail('Denne enheten lar seg ikke styre volumet på.', 403);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        out(['ok' => true]);
    }
    case 'spotify_repeat': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $state = (string)(body()['state'] ?? 'off');
        if (!in_array($state, ['off', 'context', 'track'], true)) fail('Ugyldig valg.');
        [$s, $j] = sp_api('PUT', '/me/player/repeat?state=' . $state);
        if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_now');
        out(['ok' => true]);
    }
    case 'myqueue_get': {
        // my own queue (kept here, edited on the site; the page sends the first song to Spotify just before it is needed)
        require_room_owner();
        $l = json_decode(kv_get('my_queue') ?: '[]', true);
        out(['items' => is_array($l) ? $l : []]);
    }
    case 'myqueue_set': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $in = (array)(body()['items'] ?? []);
        $keep = ['uri', 'name', 'artist', 'img', 'ms', 'album_uri', 'album', 'album_image', 'no', 'disc'];
        $out = [];
        foreach (array_slice($in, 0, 300) as $t) {
            if (!is_array($t) || !is_string($t['uri'] ?? null) || !$id($t['uri'], 'track')) continue;
            $o = [];
            foreach ($keep as $k) if (isset($t[$k]) && (is_scalar($t[$k]))) $o[$k] = is_string($t[$k]) ? mb_substr($t[$k], 0, 300) : $t[$k];
            $out[] = $o;
        }
        kv_set('my_queue', json_encode($out, JSON_UNESCAPED_UNICODE));
        out(['ok' => true, 'count' => count($out)]);
    }
    case 'myqueue_send': {
        // hand Spotify my next song – ONCE. Several pages (Mac, phone, a second tab) run the same logic; the first one wins,
        // the others are told "already sent" so the song doesn't end up in Spotify's queue twice.
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $uri = (string)(body()['uri'] ?? '');
        $after = (string)(body()['after'] ?? '');
        if (!$id($uri, 'track')) fail('Ugyldig låt.');
        $c = json_decode(kv_get('my_queue_sent') ?: 'null', true);
        if (is_array($c) && ($c['uri'] ?? '') === $uri && ($c['after'] ?? '') === $after && time() - (int)($c['t'] ?? 0) < 1500) out(['ok' => true, 'already' => true]);
        kv_set('my_queue_sent', json_encode(['uri' => $uri, 'after' => $after, 't' => time()]));
        [$s, $j] = sp_api('POST', '/me/player/queue?uri=' . rawurlencode($uri));
        if ($s === 404) { kv_del('my_queue_sent'); out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409); }
        if ($s >= 300) { kv_del('my_queue_sent'); fail('Spotify svarte med feil (' . $s . ').', 502); }
        kv_del('cache_queue', 'cache_queue4');
        out(['ok' => true]);
    }
    case 'spotify_enqueue': {
        // put a song next in the queue (doesn't switch what's playing, so the lock doesn't apply)
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $uri = (string)(body()['uri'] ?? '');
        if (!$id($uri, 'track')) fail('Ugyldig låt.');
        [$s, $j] = sp_api('POST', '/me/player/queue?uri=' . rawurlencode($uri));
        if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
        if ($s >= 300) fail('Spotify svarte med feil (' . $s . ').', 502);
        kv_del('cache_queue', 'cache_queue4');
        out(['ok' => true]);
    }
    case 'spotify_enqueue_many': {
        // a whole album (or any list of songs) at the end of the queue, in order, in ONE request from the page.
        // One song at a time with a short pause between, and a second try when Spotify says "slow down" (429).
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        @set_time_limit(120);
        $uris = array_values(array_filter((array)(body()['uris'] ?? []), fn($u) => is_string($u) && $id($u, 'track')));
        $uris = array_slice($uris, 0, 100);
        if (!$uris) fail('Ingen låter å legge til.');
        $added = 0; $failed = [];
        foreach ($uris as $uri) {
            $ok = false;
            for ($try = 0; $try < 4 && !$ok; $try++) {
                [$s, $j] = sp_api('POST', '/me/player/queue?uri=' . rawurlencode($uri));
                if ($s === 404) out(['error' => 'Ingen Spotify-enhet spiller nå.', 'code' => 'no_device'], 409);
                if ($s < 300) { $ok = true; break; }
                if ($s === 429 || $s >= 500) usleep(700000 * ($try + 1)); else break; // slow down / hiccup: wait and try again
            }
            if ($ok) $added++; else $failed[] = $uri;
            usleep(120000);
        }
        kv_del('cache_queue', 'cache_queue4');
        out(['ok' => $added > 0, 'added' => $added, 'total' => count($uris), 'failed' => count($failed)]);
    }
    case 'spotify_liked': {
        // is the song saved in my "Liked songs"? (GET ?uri=) – and save / remove it (POST).
        // Spotify has moved these to /me/library (by uri); the older /me/tracks (by id) is the fallback.
        require_room_owner();
        $uri = (string)($post ? (body()['uri'] ?? '') : ($_GET['uri'] ?? ''));
        $tid = $id($uri, 'track');
        if (!$tid) fail('Ugyldig låt.');
        if (!$post) {
            [$s, $j] = sp_api('GET', '/me/library/contains?uris=' . rawurlencode($uri));
            if ($s !== 200) [$s, $j] = sp_api('GET', '/me/tracks/contains?ids=' . $tid);
            out(['liked' => $s === 200 && !empty($j[0])]);
        }
        if (!sp_has_scope('user-library-modify')) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        $on = !empty(body()['on']);
        $verb = $on ? 'PUT' : 'DELETE';
        [$s, $j] = sp_api($verb, '/me/library?uris=' . rawurlencode($uri));
        if ($s >= 400 && $s !== 401) [$s, $j] = sp_api($verb, '/me/tracks?ids=' . $tid);
        if ($s === 401) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
        if ($s >= 300) {
            $why = (string)($j['error']['message'] ?? '');
            if ($s === 403 && stripos($why, 'scope') !== false) out(['error' => SP_RECONNECT, 'code' => 'scope'], 403);
            fail('Spotify svarte med feil (' . $s . ')' . ($why !== '' ? ': ' . $why : '') . '.', 502);
        }
        out(['ok' => true, 'liked' => $on]);
    }
    }
    return false;
}
