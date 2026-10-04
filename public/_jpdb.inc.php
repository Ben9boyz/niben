<?php
// jpdb.io for the Japanese corner. The API key (public/_jpdb.php, made by jpdb-setup.sh) stays on the
// server: visitors get statistics and a word of the day, the admin gets a review queue and can grade
// cards (the grade goes straight to jpdb, like reviewing there).
// Uses http_req / sp_cached / kv_del from _spotify.inc.php.

function jp_config(): ?array {
    static $c = false;
    if ($c === false) {
        $f = __DIR__ . '/_jpdb.php';
        $c = is_file($f) ? require $f : null;
    }
    return $c;
}

/** Calls the jpdb API. Returns [status, decoded body]. */
function jp_api(string $endpoint, array $body): array {
    $key = jp_config()['api_key'] ?? null;
    if (!$key) return [0, null];
    [$status, $res] = http_req('POST', 'https://jpdb.io/api/v1/' . $endpoint, [
        'Authorization: Bearer ' . $key,
        'Content-Type: application/json',
    ], json_encode($body));
    return [$status, json_decode((string)$res, true)];
}

const JP_FIELDS = ['vid', 'sid', 'spelling', 'reading', 'meanings_chunks', 'part_of_speech', 'pitch_accent', 'frequency_rank', 'card_state', 'due_at'];

function jp_card(array $r): array {
    [$vid, $sid, $spelling, $reading, $chunks, $pos, $pitch, $freq, $state, $due] = $r;
    return [
        'vid' => $vid, 'sid' => $sid,
        'spelling' => $spelling, 'reading' => $reading,
        'meanings' => array_map(fn($c) => array_slice($c, 0, 4), array_slice($chunks ?? [], 0, 4)),
        'pos' => array_values(array_unique(array_merge(...array_map(fn($p) => (array)$p, $pos ?? [[]])))),
        'pitch' => $pitch[0] ?? null,
        'freq' => $freq,
        'state' => $state ?? [],
        'due' => $due,
    ];
}

/** Every word in the user's own decks with its card info (deduplicated). */
function jp_all_cards(): ?array {
    [$s, $j] = jp_api('list-user-decks', ['fields' => ['id', 'name', 'vocabulary_count', 'vocabulary_known_coverage', 'vocabulary_in_progress_coverage', 'word_count', 'is_built_in']]);
    if ($s !== 200) return null;
    $decks = [];
    $pairs = [];
    foreach ($j['decks'] ?? [] as [$id, $name, $count, $known, $prog, $occ, $builtIn]) {
        $decks[] = ['id' => $id, 'name' => $name, 'words' => $count, 'known' => round((float)$known, 1), 'learning' => round((float)$prog, 1), 'occ' => (int)$occ, 'builtin' => (bool)$builtIn];
        [$ds, $dj] = jp_api('deck/list-vocabulary', ['id' => $id]);
        if ($ds !== 200) continue;
        foreach ($dj['vocabulary'] ?? [] as $p) $pairs[$p[0] . ':' . $p[1]] = $p;
    }
    $cards = [];
    foreach (array_chunk(array_values($pairs), 500) as $chunk) {
        [$ls, $lj] = jp_api('lookup-vocabulary', ['list' => $chunk, 'fields' => JP_FIELDS]);
        if ($ls !== 200) return null;
        foreach ($lj['vocabulary_info'] ?? [] as $r) if ($r) $cards[] = jp_card($r);
    }
    return ['decks' => $decks, 'cards' => $cards];
}

// ── anime: the built-in decks (added from jpdb's library) that are anime, one per show ──

/** "Sono Bisque Doll wa Koi wo Suru - Episode 1" → "Sono Bisque Doll wa Koi wo Suru" */
function jp_show_title(string $name): string {
    return trim(preg_replace('/\s*[-–:]\s*(episode|ep\.?|volume|vol\.?|chapter|part)\s*\d+.*$/iu', '', $name));
}

function jp_norm(string $s): string { return preg_replace('/[^\p{L}\p{N}]+/u', '', mb_strtolower($s)); }

/** The show on AniList (cover, titles, link), or null if the title isn't an anime. Cached for 30 days. */
function jp_anilist(string $title): ?array {
    $key = 'jp_al_' . md5($title);
    $raw = kv_get($key);
    if ($raw) {
        $c = json_decode($raw, true);
        if ($c && ($c['t'] ?? 0) > time() - 30 * 86400) return $c['d'];
    }
    $q = 'query($s:String){Page(perPage:5){media(search:$s,type:ANIME){id siteUrl seasonYear episodes title{romaji english native} synonyms coverImage{extraLarge large color}}}}';
    [$status, $res] = http_req('POST', 'https://graphql.anilist.co', ['Content-Type: application/json', 'Accept: application/json'], json_encode(['query' => $q, 'variables' => ['s' => $title]]));
    if ($status !== 200) return $raw ? (json_decode($raw, true)['d'] ?? null) : null; // try again next time
    $want = jp_norm($title);
    $hit = null;
    foreach (json_decode((string)$res, true)['data']['Page']['media'] ?? [] as $m) {
        $names = array_filter(array_merge(array_values($m['title'] ?? []), $m['synonyms'] ?? []));
        foreach ($names as $n) {
            $n = jp_norm($n);
            if ($n !== '' && ($n === $want || (mb_strlen($n) > 5 && (str_contains($want, $n) || str_contains($n, $want))))) { $hit = $m; break 2; }
        }
    }
    $d = $hit ? [
        'anilist' => $hit['id'],
        'url' => $hit['siteUrl'],
        'en' => $hit['title']['english'] ?? null,
        'native' => $hit['title']['native'] ?? null,
        'year' => $hit['seasonYear'] ?? null,
        'episodes' => $hit['episodes'] ?? null,
        'cover' => $hit['coverImage']['extraLarge'] ?? $hit['coverImage']['large'] ?? null,
        'color' => $hit['coverImage']['color'] ?? null,
    ] : null;
    kv_set($key, json_encode(['t' => time(), 'd' => $d], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $d;
}

/** Anime among the decks, best coverage first. Coverage is weighted by how many words each episode has. */
function jp_anime(array $decks): array {
    $shows = [];
    foreach ($decks as $d) {
        if (!$d['builtin']) continue;
        $t = jp_show_title($d['name']);
        $s = &$shows[$t];
        $s['title'] = $t;
        $s['decks'][] = $d['id'];
        $w = max(1, $d['occ']);
        $s['w'] = ($s['w'] ?? 0) + $w;
        $s['k'] = ($s['k'] ?? 0) + $d['known'] * $w;
        $s['l'] = ($s['l'] ?? 0) + $d['learning'] * $w;
        unset($s);
    }
    $out = [];
    foreach ($shows as $t => $s) {
        $al = jp_anilist($t);
        if (!$al) continue;
        $out[] = ['title' => $t, 'parts' => count($s['decks']), 'known' => round($s['k'] / $s['w'], 1), 'learning' => round($s['l'] / $s['w'], 1)] + $al;
    }
    usort($out, fn($a, $b) => $b['known'] <=> $a['known']);
    return $out;
}

function jp_is(array $c, string ...$states): bool { return (bool)array_intersect($states, $c['state']); }

function jp_handle(string $action, bool $post): void {
    if (!jp_config()) out(['configured' => false]);

    switch ($action) {
    case 'jpdb_public': {
        // statistics + word of the day for everyone (cached for 10 minutes)
        $data = sp_cached('jp_public_v2', 600, function () {
            $all = jp_all_cards();
            if (!$all) return null;
            $cards = $all['cards'];
            $count = ['due' => 0, 'learning' => 0, 'known' => 0, 'new' => 0];
            foreach ($cards as $c) {
                if (jp_is($c, 'blacklisted', 'redundant')) continue;
                if (jp_is($c, 'due', 'failed')) $count['due']++;
                elseif (jp_is($c, 'known', 'never-forget')) $count['known']++;
                elseif (jp_is($c, 'learning')) $count['learning']++;
                elseif (jp_is($c, 'new')) $count['new']++;
            }
            // word of the day: one of the words being learned, the same all day
            $pool = array_values(array_filter($cards, fn($c) => !jp_is($c, 'new', 'blacklisted', 'redundant', 'locked')));
            if (!$pool) $pool = array_values(array_filter($cards, fn($c) => !jp_is($c, 'blacklisted', 'redundant')));
            usort($pool, fn($a, $b) => $a['vid'] <=> $b['vid']);
            $word = $pool ? $pool[crc32(date('Y-m-d')) % count($pool)] : null;
            if ($word) unset($word['due']);
            $decks = array_map(fn($d) => array_diff_key($d, ['occ' => 1, 'builtin' => 1]), $all['decks']);
            return ['decks' => $decks, 'anime' => jp_anime($all['decks']), 'count' => $count, 'word' => $word, 'at' => time()];
        });
        if (!$data) fail('Fikk ikke kontakt med jpdb.', 502);
        out(['configured' => true] + $data);
    }

    case 'jpdb_queue': {
        // review queue for the admin: due cards (oldest first), then up to `new` new cards
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $newLimit = max(0, min(50, (int)(body()['new'] ?? 10)));
        $all = jp_all_cards();
        if (!$all) fail('Fikk ikke kontakt med jpdb.', 502);
        $due = array_values(array_filter($all['cards'], fn($c) => jp_is($c, 'due', 'failed') && !jp_is($c, 'locked', 'blacklisted', 'suspended')));
        usort($due, fn($a, $b) => ($a['due'] ?? 0) <=> ($b['due'] ?? 0));
        $new = array_slice(array_values(array_filter($all['cards'], fn($c) => $c['state'] === ['new'])), 0, $newLimit);
        out(['due' => $due, 'new' => $new]);
    }

    case 'jpdb_review': {
        // grade one card on jpdb
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = body();
        $grade = (string)($b['grade'] ?? '');
        if (!in_array($grade, ['nothing', 'something', 'hard', 'okay', 'easy'], true)) fail('Ugyldig vurdering.');
        $vid = (int)($b['vid'] ?? 0);
        $sid = (int)($b['sid'] ?? 0);
        if ($vid <= 0 || $sid <= 0) fail('Ugyldig kort.');
        [$s, $j] = jp_api('review', ['vid' => $vid, 'sid' => $sid, 'grade' => $grade]);
        if ($s !== 200) fail('jpdb svarte: ' . ($j['error_message'] ?? $s), 502);
        kv_del('jp_public_v2');
        // the card's new state
        [$ls, $lj] = jp_api('lookup-vocabulary', ['list' => [[$vid, $sid]], 'fields' => ['card_state', 'due_at']]);
        $info = $lj['vocabulary_info'][0] ?? null;
        out(['ok' => true, 'state' => $info[0] ?? null, 'due' => $info[1] ?? null]);
    }
    }
}
