<?php
// Steam for the gaming corner. The API key and Steam ID (public/_steam.php, made by steam-setup.sh)
// stay on the server; visitors get the profile, what's being played right now and the game library.
// Uses http_req / sp_cached from _spotify.inc.php.

function st_config(): ?array {
    static $c = false;
    if ($c === false) {
        $f = __DIR__ . '/_steam.php';
        $c = is_file($f) ? require $f : null;
    }
    return $c;
}

/** GET a Steam Web API method. Returns the decoded body or null. */
function st_api(string $method, array $params = []): ?array {
    $c = st_config();
    if (!$c) return null;
    $q = http_build_query($params + ['key' => $c['api_key'], 'steamid' => $c['steamid']]); // (a given steamid wins – friends)
    [$status, $res] = http_req('GET', 'https://api.steampowered.com/' . $method . '?' . $q);
    return $status === 200 ? json_decode((string)$res, true) : null;
}

const ST_STATES = ['Frakoblet', 'Pålogget', 'Opptatt', 'Borte', 'Snoozer', 'Vil bytte', 'Vil spille'];

/** Profile + what's playing now (changes often – cached briefly). */
function st_profile(): ?array {
    return sp_cached('st_profile', 60, function () {
        $c = st_config();
        $j = st_api('ISteamUser/GetPlayerSummaries/v2/', ['steamids' => $c['steamid']]);
        $p = $j['response']['players'][0] ?? null;
        if (!$p) return null;
        $state = (int)($p['personastate'] ?? 0);
        // how long this session has lasted: the page asks every minute, so remember when this game was first seen
        $gid = !empty($p['gameid']) ? (int)$p['gameid'] : 0;
        $sess = json_decode(kv_get('st_session') ?: '{}', true) ?: [];
        if ($gid && ($sess['appid'] ?? 0) !== $gid) { $sess = ['appid' => $gid, 'since' => time()]; kv_set('st_session', json_encode($sess)); }
        elseif (!$gid && !empty($sess['appid'])) { $sess = []; kv_set('st_session', '{}'); }
        return [
            'name' => $p['personaname'] ?? '',
            'avatar' => $p['avatarfull'] ?? null,
            'url' => $p['profileurl'] ?? null,
            'state' => ST_STATES[$state] ?? 'Pålogget',
            'online' => $state > 0,
            'playing' => $gid ? ['appid' => $gid, 'name' => $p['gameextrainfo'] ?? '', 'since' => $sess['since'] ?? null] : null,
            'last_online' => $p['lastlogoff'] ?? null,
            'since' => $p['timecreated'] ?? null,
        ];
    });
}

/** Library, recently played, level and a few achievement counts (cached for 30 minutes). */
function st_library(): ?array {
    return sp_cached('st_library', 1800, function () {
        $owned = st_api('IPlayerService/GetOwnedGames/v1/', ['include_appinfo' => 1, 'include_played_free_games' => 1]);
        if ($owned === null) return null;
        $games = [];
        foreach ($owned['response']['games'] ?? [] as $g) {
            $games[] = [
                'appid' => (int)$g['appid'],
                'name' => $g['name'] ?? ('App ' . $g['appid']),
                'hours' => round(($g['playtime_forever'] ?? 0) / 60, 1),
                'recent' => round(($g['playtime_2weeks'] ?? 0) / 60, 1),
                'last' => $g['rtime_last_played'] ?? 0,
                'win' => round(($g['playtime_windows_forever'] ?? 0) / 60, 1),
                'mac' => round(($g['playtime_mac_forever'] ?? 0) / 60, 1),
                'linux' => round(($g['playtime_linux_forever'] ?? 0) / 60, 1),
            ];
        }
        usort($games, fn($a, $b) => $b['hours'] <=> $a['hours']);
        $total = array_sum(array_column($games, 'hours'));
        $played = count(array_filter($games, fn($g) => $g['hours'] > 0));

        // the last few games played, most recent first
        $byLast = array_values(array_filter($games, fn($g) => $g['last'] > 0));
        usort($byLast, fn($a, $b) => $b['last'] <=> $a['last']);
        $recent = array_slice($byLast, 0, 6);
        // achievements for those (games without achievements just don't get a count)
        foreach ($recent as &$g) {
            $a = st_api('ISteamUserStats/GetPlayerAchievements/v1/', ['appid' => $g['appid']]);
            $list = $a['playerstats']['achievements'] ?? null;
            if ($list) $g['ach'] = ['done' => count(array_filter($list, fn($x) => !empty($x['achieved']))), 'total' => count($list)];
        }
        unset($g);

        $lvl = st_api('IPlayerService/GetSteamLevel/v1/');
        $twoWeeks = round(array_sum(array_column($games, 'recent')), 1);
        $platform = ['win' => round(array_sum(array_column($games, 'win'))), 'mac' => round(array_sum(array_column($games, 'mac'))), 'linux' => round(array_sum(array_column($games, 'linux')))];
        // the favourite genres, from the store pages of the most played games (each page is kept for 30 days)
        $gen = [];
        foreach (array_slice($games, 0, 14) as $g) {
            $d = st_app($g['appid']);
            foreach ($d['genres'] ?? [] as $x) $gen[$x] = ($gen[$x] ?? 0) + $g['hours'];
        }
        arsort($gen);
        $genres = [];
        foreach (array_slice($gen, 0, 6, true) as $k => $v) $genres[] = ['name' => $k, 'hours' => round($v)];
        return [
            'two_weeks' => $twoWeeks,
            'backlog' => count($games) - $played,
            'platform' => $platform,
            'genres' => $genres,
            'longest' => $games ? ['appid' => $games[0]['appid'], 'name' => $games[0]['name'], 'hours' => $games[0]['hours']] : null,
            'count' => count($games),
            'played' => $played,
            'hours' => round($total),
            'level' => $lvl['response']['player_level'] ?? null,
            'recent' => $recent,
            'top' => array_slice($games, 0, 60),
            'hidden' => !isset($owned['response']['games']), // game details are private on Steam
        ];
    });
}

/** The store page of a game (genres, a short text, who made it). Kept for 30 days. */
function st_app(int $appid): array {
    $d = sp_cached("st_app_$appid", 30 * 86400, function () use ($appid) {
        [$s, $res] = http_req('GET', 'https://store.steampowered.com/api/appdetails?appids=' . $appid . '&l=english&cc=no');
        if ($s !== 200) return null;
        $j = json_decode((string)$res, true);
        $x = $j[$appid]['data'] ?? null;
        if (!$x) return ['genres' => []]; // no store page (removed / tool): remember that too
        return [
            'genres' => array_map(fn($g) => $g['description'], array_slice($x['genres'] ?? [], 0, 4)),
            'text' => mb_substr(trim(strip_tags((string)($x['short_description'] ?? ''))), 0, 260),
            'dev' => implode(', ', array_slice($x['developers'] ?? [], 0, 2)),
            'year' => substr((string)($x['release_date']['date'] ?? ''), -4),
            'score' => $x['metacritic']['score'] ?? null,
        ];
    });
    return $d ?? ['genres' => []];
}

/** What is going on in the game being played now: how many play it, the latest news and my newest unlocks. */
function st_live(int $appid): array {
    return sp_cached("st_live_$appid", 300, function () use ($appid) {
        $out = ['info' => st_app($appid)];
        $n = st_api('ISteamUserStats/GetNumberOfCurrentPlayers/v1/', ['appid' => $appid]);
        $out['players'] = $n['response']['player_count'] ?? null;
        $news = st_api('ISteamNews/GetNewsForApp/v2/', ['appid' => $appid, 'count' => 1, 'maxlength' => 260]);
        $it = $news['appnews']['newsitems'][0] ?? null;
        if ($it) $out['news'] = ['title' => $it['title'] ?? '', 'text' => trim(strip_tags(preg_replace('~\[[^\]]*\]~', '', (string)($it['contents'] ?? '')))), 'url' => $it['url'] ?? null, 'date' => $it['date'] ?? null];
        $out['ach'] = st_unlocks($appid, 4);
        return $out;
    }) ?? [];
}

/** My latest unlocked achievements in a game, with names and icons, and how rare they are. */
function st_unlocks(int $appid, int $limit): array {
    $mine = st_api('ISteamUserStats/GetPlayerAchievements/v1/', ['appid' => $appid, 'l' => 'english']);
    $list = $mine['playerstats']['achievements'] ?? [];
    $done = array_values(array_filter($list, fn($a) => !empty($a['achieved'])));
    usort($done, fn($a, $b) => ($b['unlocktime'] ?? 0) <=> ($a['unlocktime'] ?? 0));
    $done = array_slice($done, 0, $limit);
    if (!$done) return [];
    $schema = st_api('ISteamUserStats/GetSchemaForGame/v2/', ['appid' => $appid, 'l' => 'english']);
    $meta = [];
    foreach ($schema['game']['availableGameStats']['achievements'] ?? [] as $a) $meta[$a['name']] = $a;
    [$s, $res] = http_req('GET', 'https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=' . $appid);
    $pct = [];
    foreach (($s === 200 ? json_decode((string)$res, true) : [])['achievementpercentages']['achievements'] ?? [] as $a) $pct[$a['name']] = round((float)$a['percent'], 1);
    $out = [];
    foreach ($done as $a) {
        $m = $meta[$a['apiname']] ?? [];
        $out[] = ['name' => $a['name'] ?? ($m['displayName'] ?? $a['apiname']), 'text' => $a['description'] ?? ($m['description'] ?? ''), 'icon' => $m['icon'] ?? null, 'at' => $a['unlocktime'] ?? 0, 'rarity' => $pct[$a['apiname']] ?? null];
    }
    return $out;
}

/** Friends: who is online and playing what – and the "best friend": the one who plays the same games as me. */
function st_friends(): ?array {
    return sp_cached('st_friends', 600, function () {
        $c = st_config();
        $fl = st_api('ISteamUser/GetFriendList/v1/', ['relationship' => 'friend']);
        $friends = $fl['friendslist']['friends'] ?? null;
        if ($friends === null) return ['hidden' => true]; // the friends list is private
        usort($friends, fn($a, $b) => ($a['friend_since'] ?? 0) <=> ($b['friend_since'] ?? 0));
        $friends = array_slice($friends, 0, 100);
        $since = []; foreach ($friends as $f) $since[$f['steamid']] = (int)($f['friend_since'] ?? 0);
        $ids = array_keys($since);
        $sum = $ids ? st_api('ISteamUser/GetPlayerSummaries/v2/', ['steamids' => implode(',', $ids)]) : null;
        $players = [];
        foreach ($sum['response']['players'] ?? [] as $p) {
            $st = (int)($p['personastate'] ?? 0);
            $players[$p['steamid']] = ['id' => $p['steamid'], 'name' => $p['personaname'] ?? '', 'avatar' => $p['avatarfull'] ?? null, 'url' => $p['profileurl'] ?? null,
                'online' => $st > 0, 'state' => ST_STATES[$st] ?? '', 'playing' => $p['gameextrainfo'] ?? null, 'appid' => !empty($p['gameid']) ? (int)$p['gameid'] : null,
                'since' => $since[$p['steamid']] ?? 0, 'last' => (int)($p['lastlogoff'] ?? 0)];
        }
        // my games: appid => hours
        $mine = [];
        foreach ((st_library()['top'] ?? []) as $g) $mine[$g['appid']] = $g;
        // best friend: set best_friend (a Steam ID) in _steam.php, else the friend with the most hours in MY most played games
        $best = $c['best_friend'] ?? null;
        $scores = [];
        if (!$best) {
            foreach (array_slice(array_keys($players), 0, 30) as $id) {
                $o = sp_cached("st_fg_$id", 6 * 3600, function () use ($id) {
                    $r = st_api('IPlayerService/GetOwnedGames/v1/', ['steamid' => $id, 'include_played_free_games' => 1]);
                    if (!isset($r['response']['games'])) return ['private' => true];
                    $m = []; foreach ($r['response']['games'] as $g) if (($g['playtime_forever'] ?? 0) > 0) $m[$g['appid']] = round($g['playtime_forever'] / 60, 1);
                    return ['games' => $m];
                });
                if (!$o || !empty($o['private'])) continue;
                $sc = 0; $shared = [];
                foreach ($mine as $appid => $g) if (isset($o['games'][$appid]) && $g['hours'] > 1) { $sc += min($g['hours'], $o['games'][$appid]); $shared[] = ['appid' => $appid, 'name' => $g['name'], 'mine' => $g['hours'], 'theirs' => $o['games'][$appid]]; }
                $scores[$id] = ['score' => $sc, 'shared' => $shared];
            }
            uasort($scores, fn($a, $b) => $b['score'] <=> $a['score']);
            $best = array_key_first($scores);
        } else {
            $o = sp_cached("st_fg_$best", 6 * 3600, function () use ($best) {
                $r = st_api('IPlayerService/GetOwnedGames/v1/', ['steamid' => $best, 'include_played_free_games' => 1]);
                if (!isset($r['response']['games'])) return ['private' => true];
                $m = []; foreach ($r['response']['games'] as $g) if (($g['playtime_forever'] ?? 0) > 0) $m[$g['appid']] = round($g['playtime_forever'] / 60, 1);
                return ['games' => $m];
            });
            $shared = [];
            foreach ($mine as $appid => $g) if (isset($o['games'][$appid])) $shared[] = ['appid' => $appid, 'name' => $g['name'], 'mine' => $g['hours'], 'theirs' => $o['games'][$appid]];
            $scores[$best] = ['score' => 1, 'shared' => $shared];
        }
        $bf = null;
        if ($best && isset($players[$best])) {
            $sh = $scores[$best]['shared'] ?? [];
            usort($sh, fn($a, $b) => min($b['mine'], $b['theirs']) <=> min($a['mine'], $a['theirs']));
            $bf = $players[$best] + ['shared' => array_slice($sh, 0, 5), 'shared_count' => count($sh)];
        }
        $others = array_values(array_filter($players, fn($p) => $p['id'] !== $best));
        usort($others, fn($a, $b) => ((int)!empty($b['playing']) <=> (int)!empty($a['playing'])) ?: ((int)$b['online'] <=> (int)$a['online']) ?: ($b['last'] <=> $a['last']));
        return ['count' => count($players), 'online' => count(array_filter($players, fn($p) => $p['online'])), 'best' => $bf, 'list' => array_slice($others, 0, 8)];
    });
}

function st_handle(string $action, bool $post): void {
    if (!st_config()) out(['configured' => false]);
    switch ($action) {
    case 'steam_public': {
        $profile = st_profile();
        if (!$profile) fail('Fikk ikke kontakt med Steam.', 502);
        $live = !empty($profile['playing']['appid']) ? st_live((int)$profile['playing']['appid']) : null;
        // the game played last gets the same details when nothing is on right now
        $lib = st_library();
        if (!$live && !empty($lib['recent'][0]['appid'])) $live = ['info' => st_app((int)$lib['recent'][0]['appid'])];
        out(['configured' => true, 'profile' => $profile, 'library' => $lib, 'live' => $live, 'friends' => st_friends(), 'at' => time()]);
    }
    }
}
