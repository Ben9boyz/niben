<?php
// Hobby modules: a little corner for a hobby (films, running, chess, plants …) that a room can add, name and place.
// A module is an item in the room's decor list ('mod' = which kind) – so it has a place in the room that can be moved around in
// "Rediger rommet" – and its content (the items the person writes down) lives in the key/value table under 'mod_<id>'.
// The kinds themselves (their fields and how they look) are defined in the page (src/lib/modules/catalog.ts); the server only
// checks that a kind looks like a kind and that what is saved is small, flat and made of plain text and numbers.

const MOD_MAX = 24;           // modules per room
const MOD_ITEMS = 600;        // entries per module
const MOD_MAX_BYTES = 240000; // size of one module's content

function mod_data_key(string $id): string { return 'mod_' . $id; }
function mod_find(string $id): ?array {
    foreach (decor_list() as $d) if (($d['id'] ?? '') === $id && !empty($d['mod'])) return $d;
    return null;
}
/** A free place on the floor in front: the first spot (in rows) with no other decor within 0.9 m. */
function mod_free_spot(array $list): array {
    for ($row = 0; $row < 5; $row++) {
        for ($col = 0; $col < 7; $col++) {
            $x = -3.0 + $col * 1.0;
            $z = 3.0 - $row * 0.9;
            $ok = true;
            foreach ($list as $d) if (hypot(($d['x'] ?? 0) - $x, ($d['z'] ?? 0) - $z) < 0.9) { $ok = false; break; }
            if ($ok) return [$x, $z];
        }
    }
    return [0.0, 1.2];
}
function mod_clean_data($in): array {
    $items = [];
    foreach (array_slice((array)($in['items'] ?? []), 0, MOD_ITEMS) as $it) {
        if (!is_array($it)) continue;
        $row = [];
        foreach (array_slice($it, 0, 14, true) as $k => $v) {
            $k = (string)$k;
            if (!preg_match('~^[a-z][a-z0-9_]{0,23}$~i', $k)) continue;
            if (is_bool($v)) $row[$k] = $v;
            elseif (is_numeric($v) && !is_string($v)) $row[$k] = $v + 0;
            else { $s = mb_substr(trim((string)$v), 0, $k === 'route' ? 700 : 400); if ($k === 'route' && !preg_match('~^\d{1,3},\d{1,3}( \d{1,3},\d{1,3})*$~', $s)) continue; if ($s !== '') $row[$k] = $s; }
        }
        if ($row) $items[] = $row;
    }
    $settings = [];
    foreach (array_slice((array)($in['settings'] ?? []), 0, 8, true) as $k => $v) {
        if (preg_match('~^[a-z][a-z0-9_]{0,23}$~i', (string)$k)) $settings[(string)$k] = mb_substr(trim((string)$v), 0, 120);
    }
    return ['items' => $items, 'settings' => (object)$settings];
}

function mod_handle(string $action, bool $post): void {
    switch ($action) {
    case 'mod_get': {
        $id = (string)($_GET['id'] ?? '');
        if (!preg_match('~^[a-f0-9]{10}$~', $id) || !mod_find($id)) fail('Fant ikke modulen.', 404);
        $raw = kv_get(mod_data_key($id));
        out(['data' => $raw ? json_decode($raw, true) : ['items' => [], 'settings' => new stdClass()]]);
    }
    case 'mod_add': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $type = (string)(body()['type'] ?? '');
        if (!preg_match('~^[a-z][a-z0-9_]{1,23}$~', $type)) fail('Ukjent modul.');
        $list = decor_list();
        if (count(array_filter($list, fn($d) => !empty($d['mod']))) >= MOD_MAX) fail('Maks ' . MOD_MAX . ' moduler i rommet.');
        [$x, $z] = mod_free_spot($list);
        $name = mb_substr(trim((string)(body()['name'] ?? '')), 0, 50);
        $item = ['id' => bin2hex(random_bytes(5)), 'file' => '', 'mod' => $type, 'name' => $name, 'x' => $x, 'y' => 0.0, 'z' => $z, 'rot' => 0.0, 'scale' => 1.0, 'visible' => true];
        $list[] = $item;
        decor_store($list);
        out(['ok' => true, 'item' => $item]);
    }
    case 'mod_save': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $id = (string)(body()['id'] ?? '');
        if (!mod_find($id)) fail('Fant ikke modulen.', 404);
        $data = mod_clean_data(body()['data'] ?? []);
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (strlen($json) > MOD_MAX_BYTES) fail('Det er for mye i modulen.');
        kv_set(mod_data_key($id), $json);
        out(['ok' => true, 'data' => $data]);
    }
    case 'mod_remove': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $id = (string)(body()['id'] ?? '');
        if (!mod_find($id)) fail('Fant ikke modulen.', 404);
        decor_store(array_values(array_filter(decor_list(), fn($d) => ($d['id'] ?? '') !== $id)));
        kv_del(mod_data_key($id));
        out(['ok' => true]);
    }
    case 'mod_lookup': {
        // type a title, get suggestions with poster / link (public services that need no key): film, serie, podkast, matrett, art, land
        $src = (string)($_GET['s'] ?? '');
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2 || mb_strlen($q) > 80) out(['results' => []]);
        $enc = rawurlencode($q);
        $h = ['User-Agent: niben.no', 'Accept: application/json'];
        $res = [];
        $get = function (string $url) use ($h) { [$s, $b] = http_req('GET', $url, $h); return $s === 200 ? (json_decode($b, true) ?: []) : []; };
        $big = fn($u) => $u ? preg_replace('~/\d+x\d+bb\.~', '/600x600bb.', (string)$u) : null;
        if ($src === 'film' || $src === 'podkast') {
            $j = $get('https://itunes.apple.com/search?limit=8&country=NO&media=' . ($src === 'film' ? 'movie&entity=movie' : 'podcast&entity=podcast') . '&term=' . $enc);
            foreach ($j['results'] ?? [] as $r) $res[] = ['title' => $r['trackName'] ?? $r['collectionName'] ?? '', 'sub' => trim(substr((string)($r['releaseDate'] ?? ''), 0, 4) . ' ' . ($r['artistName'] ?? '')), 'img' => $big($r['artworkUrl100'] ?? null), 'url' => $r['trackViewUrl'] ?? $r['collectionViewUrl'] ?? null, 'genre' => $r['primaryGenreName'] ?? null, 'note' => $src === 'film' ? mb_substr((string)($r['longDescription'] ?? ''), 0, 380) : ''];
        } elseif ($src === 'serie') {
            foreach (array_slice($get('https://api.tvmaze.com/search/shows?q=' . $enc), 0, 8) as $r) { $x = $r['show'] ?? []; $res[] = ['title' => $x['name'] ?? '', 'sub' => substr((string)($x['premiered'] ?? ''), 0, 4), 'img' => $x['image']['medium'] ?? null, 'url' => $x['url'] ?? null, 'genre' => ($x['genres'][0] ?? null), 'note' => mb_substr(trim(strip_tags((string)($x['summary'] ?? ''))), 0, 380)]; }
        } elseif ($src === 'matrett') {
            foreach (array_slice(($get('https://www.themealdb.com/api/json/v1/1/search.php?s=' . $enc)['meals'] ?? []), 0, 8) as $r) $res[] = ['title' => $r['strMeal'] ?? '', 'sub' => trim(($r['strCategory'] ?? '') . ' · ' . ($r['strArea'] ?? ''), ' ·'), 'img' => $r['strMealThumb'] ?? null, 'url' => $r['strSource'] ?: ($r['strYoutube'] ?? null), 'genre' => $r['strCategory'] ?? null, 'note' => mb_substr((string)($r['strInstructions'] ?? ''), 0, 390)];
        } elseif ($src === 'art') {
            foreach (array_slice($get('https://api.gbif.org/v1/species/suggest?limit=8&q=' . $enc), 0, 8) as $r) $res[] = ['title' => $r['canonicalName'] ?? $r['scientificName'] ?? '', 'sub' => trim(($r['family'] ?? '') . ' ' . ($r['rank'] ?? '')), 'img' => null, 'url' => isset($r['key']) ? 'https://www.gbif.org/species/' . $r['key'] : null, 'genre' => null, 'note' => ''];
        } elseif ($src === 'sted') {
            // places (restaurants, cafés, trails, campsites …) from OpenStreetMap – its rules ask for a name on the request and one question at a time
            $h2 = ['User-Agent: niben.no (hobby pages)', 'Accept: application/json', 'Accept-Language: nb,en'];
            [$st, $b] = http_req('GET', 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=0&q=' . $enc, $h2);
            foreach (array_slice($st === 200 ? (json_decode($b, true) ?: []) : [], 0, 8) as $r) {
                $parts = array_map('trim', explode(',', (string)($r['display_name'] ?? '')));
                $name = (string)($r['name'] ?? '') ?: ($parts[0] ?? '');
                $res[] = ['title' => $name, 'sub' => implode(', ', array_slice($parts, 1, 3)), 'img' => null, 'genre' => null, 'note' => '',
                          'url' => isset($r['lat'], $r['lon']) ? 'https://www.openstreetmap.org/?mlat=' . $r['lat'] . '&mlon=' . $r['lon'] . '#map=17/' . $r['lat'] . '/' . $r['lon'] : null];
            }
        } elseif ($src === 'land') {
            foreach (array_slice($get('https://restcountries.com/v3.1/name/' . $enc . '?fields=name,flags,translations,region'), 0, 8) as $r) $res[] = ['title' => $r['translations']['nob']['common'] ?? $r['name']['common'] ?? '', 'sub' => $r['region'] ?? '', 'img' => $r['flags']['png'] ?? null, 'url' => null, 'genre' => null, 'note' => ''];
        } else fail('Ukjent tjeneste.');
        out(['results' => array_values(array_filter($res, fn($r) => $r['title'] !== ''))]);
    }
    case 'mod_live': {
        // an account on a public service (no key needed): the number the module shows beside the entries
        $provider = (string)($_GET['p'] ?? '');
        if ($provider === 'apod') { // the astronomy picture of the day (NASA's open demo key), kept for six hours
            $raw = kv_get('live_apod');
            $c = $raw ? json_decode($raw, true) : null;
            if ($c && ($c['t'] ?? 0) > time() - 21600) out($c['d']);
            [$s, $b] = http_req('GET', 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', ['User-Agent: niben.no']);
            $j = $s === 200 ? (json_decode($b, true) ?: []) : [];
            if (empty($j['title'])) { if ($c) out($c['d']); fail('NASA svarer ikke akkurat nå.', 502); }
            $d = ['provider' => 'apod', 'title' => $j['title'], 'img' => ($j['media_type'] ?? '') === 'image' ? ($j['url'] ?? null) : ($j['thumbnail_url'] ?? null), 'text' => mb_substr((string)($j['explanation'] ?? ''), 0, 500), 'date' => $j['date'] ?? ''];
            kv_set('live_apod', json_encode(['t' => time(), 'd' => $d], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            out($d);
        }
        $user = strtolower(trim((string)($_GET['u'] ?? '')));
        if (!preg_match('~^[a-z0-9_-]{2,40}$~', $user)) fail('Ugyldig brukernavn.');
        $cacheKey = 'live_' . substr(md5($provider . $user), 0, 20);
        $raw = kv_get($cacheKey);
        $c = $raw ? json_decode($raw, true) : null;
        if ($c && ($c['t'] ?? 0) > time() - 3600) out($c['d']);
        if ($provider === 'chesscom') {
            [$s, $b] = http_req('GET', 'https://api.chess.com/pub/player/' . rawurlencode($user) . '/stats', ['User-Agent: niben.no', 'Accept: application/json']);
            if ($s !== 200) fail('Fant ikke spilleren på chess.com.', 404);
            $j = json_decode($b, true) ?: [];
            $d = ['provider' => 'chesscom', 'user' => $user, 'ratings' => array_filter([
                'Rapid' => $j['chess_rapid']['last']['rating'] ?? null, 'Blitz' => $j['chess_blitz']['last']['rating'] ?? null,
                'Bullet' => $j['chess_bullet']['last']['rating'] ?? null, 'Daglig' => $j['chess_daily']['last']['rating'] ?? null, 'Puzzles' => $j['tactics']['highest']['rating'] ?? null])];
        } elseif ($provider === 'lichess') {
            [$s, $b] = http_req('GET', 'https://lichess.org/api/user/' . rawurlencode($user), ['User-Agent: niben.no', 'Accept: application/json']);
            if ($s !== 200) fail('Fant ikke spilleren på lichess.', 404);
            $j = json_decode($b, true) ?: [];
            $r = [];
            foreach (['rapid' => 'Rapid', 'blitz' => 'Blitz', 'bullet' => 'Bullet', 'classical' => 'Klassisk', 'puzzle' => 'Puzzles'] as $k => $label) if (isset($j['perfs'][$k]['rating'])) $r[$label] = $j['perfs'][$k]['rating'];
            $d = ['provider' => 'lichess', 'user' => $user, 'ratings' => $r, 'games' => $j['count']['all'] ?? null];
        } else fail('Ukjent tjeneste.');
        kv_set($cacheKey, json_encode(['t' => time(), 'd' => $d]));
        out($d);
    }
    }
}
