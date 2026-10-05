<?php
// "Oppdag": albums (and songs) I recommend, plus suggestions for good albums that are NOT in my library.
//  - picks: I paste a Spotify link (album or song) with a short note → shown on the Oppdag page for everybody.
//  - recs: found with Last.fm: the artists most like the ones I have the most of → their best-known albums that I
//    don't have → looked up on Spotify (for the cover and a link). Needs a free Last.fm API key (set in Oppdag).
//    Refreshed by me (button) – visitors only see what was found last time.

const DC_PICKS = 'discover_picks';
const DC_RECS = 'discover_recs';

function dc_first_artist(string $s): string { return trim(explode(',', $s)[0]); }
function dc_norm(string $s): string {
    $t = function_exists('iconv') ? (@iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s) : $s;
    return preg_replace('~[^a-z0-9]+~', '', mb_strtolower($t));
}

function dc_lastfm(string $method, array $params): ?array {
    $key = (string)kv_get('lastfm_key');
    if ($key === '') return null;
    $q = http_build_query($params + ['method' => $method, 'api_key' => $key, 'format' => 'json', 'autocorrect' => 1]);
    [$s, $res] = http_req('GET', 'https://ws.audioscrobbler.com/2.0/?' . $q);
    if ($s !== 200) return null;
    $j = json_decode((string)$res, true);
    return is_array($j) && empty($j['error']) ? $j : null;
}

function dc_shape_album(array $x): array {
    return [
        'id' => $x['id'], 'uri' => $x['uri'], 'type' => 'album', 'name' => $x['name'],
        'artist' => implode(', ', array_map(fn($y) => $y['name'], $x['artists'] ?? [])),
        'artist_id' => $x['artists'][0]['id'] ?? null,
        'year' => substr((string)($x['release_date'] ?? ''), 0, 4),
        'image' => sp_img($x['images'] ?? [], 300), 'image_large' => sp_img($x['images'] ?? [], 640), 'thumb' => sp_img($x['images'] ?? [], 64),
        'url' => $x['external_urls']['spotify'] ?? null, 'tracks' => $x['total_tracks'] ?? null,
    ];
}

/** Spotify link or uri → ['album'|'track', id] */
function dc_parse(string $s): ?array {
    $s = trim($s);
    if (preg_match('~(?:open\.spotify\.com/(?:intl-[a-z]+/)?|spotify:)(album|track)[/:]([A-Za-z0-9]{10,40})~', $s, $m)) return [$m[1], $m[2]];
    return null;
}

/** Suggestions I have hidden (their Spotify uris) – they never come back, not even after "Finn nye forslag". */
function dc_hidden(): array { $l = json_decode((string)kv_get('discover_hidden'), true); return is_array($l) ? $l : []; }

function dc_recs_build(): array {
    @set_time_limit(120);
    $lib = sp_albums() ?: [];
    if (!$lib) return ['error' => 'Fant ingen album i biblioteket ditt – koble til Spotify først.'];
    // my taste: the artists I have most albums by
    $count = []; $have = []; $haveArtist = [];
    foreach ($lib as $a) {
        $ar = dc_first_artist((string)($a['artist'] ?? ''));
        if ($ar === '') continue;
        $count[$ar] = ($count[$ar] ?? 0) + 1;
        $have[dc_norm($ar . '|' . ($a['name'] ?? ''))] = 1;
        $haveArtist[dc_norm($ar)] = 1;
    }
    arsort($count);
    $seeds = array_slice($count, 0, 6, true);
    if (!dc_lastfm('artist.getsimilar', ['artist' => (string)array_key_first($seeds), 'limit' => 1])) {
        return ['error' => (string)kv_get('lastfm_key') === '' ? 'Legg inn en Last.fm-nøkkel først.' : 'Last.fm svarte ikke – sjekk nøkkelen.'];
    }
    // similar artists (that I don't have anything by), scored by how close they are and how much I have of the seed
    $cand = [];
    foreach ($seeds as $seed => $n) {
        $j = dc_lastfm('artist.getsimilar', ['artist' => $seed, 'limit' => 8]);
        foreach ($j['similarartists']['artist'] ?? [] as $s) {
            $name = (string)($s['name'] ?? '');
            if ($name === '' || isset($haveArtist[dc_norm($name)])) continue;
            $c = &$cand[$name];
            $c['score'] = ($c['score'] ?? 0) + (float)($s['match'] ?? 0) * (1 + log($n + 0.0));
            $c['why'][$seed] = 1;
            unset($c);
        }
    }
    uasort($cand, fn($a, $b) => $b['score'] <=> $a['score']);
    $cand = array_slice($cand, 0, 12, true);
    // their best-known albums → Spotify
    $out = []; $seen = [];
    foreach ($cand as $name => $c) {
        $j = dc_lastfm('artist.gettopalbums', ['artist' => $name, 'limit' => 5]);
        $got = 0;
        foreach ($j['topalbums']['album'] ?? [] as $al) {
            $title = (string)($al['name'] ?? '');
            if ($title === '' || $title === '(null)' || $got >= 2) continue;
            if (isset($have[dc_norm($name . '|' . $title)])) continue;
            [$s, $r] = sp_api('GET', '/search?type=album&limit=5&q=' . rawurlencode('album:"' . mb_substr($title, 0, 80) . '" artist:"' . mb_substr($name, 0, 60) . '"'));
            if ($s !== 200) continue;
            foreach ($r['albums']['items'] ?? [] as $x) {
                if (($x['album_type'] ?? '') === 'compilation') continue;
                if (dc_norm(dc_first_artist(implode(', ', array_map(fn($y) => $y['name'], $x['artists'] ?? [])))) !== dc_norm($name)) continue;
                if (isset($seen[$x['id']])) continue;
                $seen[$x['id']] = 1;
                $row = dc_shape_album($x);
                $row['why'] = 'Ligner på ' . implode(', ', array_slice(array_keys($c['why']), 0, 2));
                $row['score'] = round($c['score'], 2);
                $out[] = $row; $got++;
                break;
            }
        }
    }
    usort($out, fn($a, $b) => $b['score'] <=> $a['score']);
    $hid = array_flip(dc_hidden());
    $out = array_values(array_filter($out, fn($r) => !isset($hid[$r['uri'] ?? ''])));
    return ['recs' => array_slice($out, 0, 30), 'at' => time()];
}

function dc_handle(string $action, bool $post): void {
    switch ($action) {
    case 'discover_get': {
        $picks = json_decode((string)kv_get(DC_PICKS), true) ?: [];
        $recs = json_decode((string)kv_get(DC_RECS), true) ?: ['recs' => [], 'at' => 0];
        out(['picks' => $picks, 'recs' => $recs['recs'] ?? [], 'at' => $recs['at'] ?? 0, 'hasKey' => (string)kv_get('lastfm_key') !== '']);
    }
    case 'discover_daily': {
        // "Dagens plate": picked ONCE per day on the server, so it is the same on every device (and doesn't change when
        // the library does). A record from my library, plus one of the Last.fm suggestions ("Anbefalt i dag").
        $today = date('Y-m-d');
        $d = json_decode((string)kv_get('daily_pick'), true);
        if (!is_array($d) || ($d['d'] ?? '') !== $today) {
            $lib = sp_albums() ?: [];
            $uri = $lib ? ($lib[hexdec(substr(md5($today), 0, 8)) % count($lib)]['uri'] ?? null) : null;
            $recs = (json_decode((string)kv_get(DC_RECS), true) ?: [])['recs'] ?? [];
            $rec = $recs ? $recs[hexdec(substr(md5($today . 'rec'), 0, 8)) % count($recs)] : null;
            $d = ['d' => $today, 'uri' => $uri, 'rec' => $rec];
            if ($uri || $rec) kv_set('daily_pick', json_encode($d, JSON_UNESCAPED_UNICODE)); // (nothing to pick from yet: ask again next time)
        }
        out($d);
    }
    case 'discover_add': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = body();
        $p = dc_parse((string)($b['url'] ?? ''));
        if (!$p) fail('Det der ser ikke ut som en Spotify-lenke til et album eller en låt.');
        [$type, $id] = $p;
        [$s, $x] = sp_api('GET', "/{$type}s/{$id}");
        if ($s !== 200 || !is_array($x)) fail('Fikk ikke hentet det fra Spotify (' . $s . ').', 502);
        $row = $type === 'album' ? dc_shape_album($x) : [
            'id' => $x['id'], 'uri' => $x['uri'], 'type' => 'track', 'name' => $x['name'],
            'artist' => implode(', ', array_map(fn($y) => $y['name'], $x['artists'] ?? [])),
            'artist_id' => $x['artists'][0]['id'] ?? null,
            'album' => $x['album']['name'] ?? '', 'album_uri' => $x['album']['uri'] ?? null,
            'year' => substr((string)($x['album']['release_date'] ?? ''), 0, 4),
            'image' => sp_img($x['album']['images'] ?? [], 300), 'image_large' => sp_img($x['album']['images'] ?? [], 640), 'thumb' => sp_img($x['album']['images'] ?? [], 64),
            'url' => $x['external_urls']['spotify'] ?? null, 'ms' => (int)($x['duration_ms'] ?? 0),
        ];
        $row['note'] = mb_substr(trim((string)($b['note'] ?? '')), 0, 300);
        $row['t'] = time();
        $picks = json_decode((string)kv_get(DC_PICKS), true) ?: [];
        $picks = array_values(array_filter($picks, fn($q) => ($q['uri'] ?? '') !== $row['uri']));
        array_unshift($picks, $row);
        kv_set(DC_PICKS, json_encode(array_slice($picks, 0, 120), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'pick' => $row]);
    }
    case 'discover_del': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $uri = (string)(body()['uri'] ?? '');
        $picks = json_decode((string)kv_get(DC_PICKS), true) ?: [];
        kv_set(DC_PICKS, json_encode(array_values(array_filter($picks, fn($q) => ($q['uri'] ?? '') !== $uri)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true]);
    }
    case 'discover_hide': {
        // hide a suggestion (an album or song): it leaves the list and today's "Anbefalt i dag" gets another one
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $uri = (string)(body()['uri'] ?? '');
        if (!preg_match('~^spotify:(album|track):[A-Za-z0-9]{10,40}$~', $uri)) fail('Ugyldig uri.');
        $hid = dc_hidden();
        if (!in_array($uri, $hid, true)) $hid[] = $uri;
        kv_set('discover_hidden', json_encode(array_slice($hid, -500)));
        $recs = json_decode((string)kv_get(DC_RECS), true);
        if (is_array($recs)) {
            $recs['recs'] = array_values(array_filter($recs['recs'] ?? [], fn($r) => ($r['uri'] ?? '') !== $uri));
            kv_set(DC_RECS, json_encode($recs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
        $d = json_decode((string)kv_get('daily_pick'), true);
        if (is_array($d) && (($d['rec']['uri'] ?? '') === $uri)) {
            $left = $recs['recs'] ?? [];
            $d['rec'] = $left ? $left[hexdec(substr(md5($d['d'] . $uri), 0, 8)) % count($left)] : null;
            kv_set('daily_pick', json_encode($d, JSON_UNESCAPED_UNICODE));
        }
        out(['ok' => true]);
    }
    case 'discover_key': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $k = trim((string)(body()['key'] ?? ''));
        if ($k !== '' && !preg_match('~^[A-Za-z0-9]{20,64}$~', $k)) fail('Nøkkelen ser ikke riktig ut (32 tegn, bokstaver og tall).');
        if ($k === '') kv_del('lastfm_key'); else kv_set('lastfm_key', $k);
        out(['ok' => true, 'hasKey' => $k !== '']);
    }
    case 'discover_refresh': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $r = dc_recs_build();
        if (isset($r['error'])) fail($r['error'], 400);
        kv_set(DC_RECS, json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'recs' => $r['recs'], 'at' => $r['at']]);
    }
    }
}
