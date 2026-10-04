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
    $q = http_build_query(['key' => $c['api_key'], 'steamid' => $c['steamid']] + $params);
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
        return [
            'name' => $p['personaname'] ?? '',
            'avatar' => $p['avatarfull'] ?? null,
            'url' => $p['profileurl'] ?? null,
            'state' => ST_STATES[$state] ?? 'Pålogget',
            'online' => $state > 0,
            'playing' => !empty($p['gameid']) ? ['appid' => (int)$p['gameid'], 'name' => $p['gameextrainfo'] ?? ''] : null,
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
        return [
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

function st_handle(string $action, bool $post): void {
    if (!st_config()) out(['configured' => false]);
    switch ($action) {
    case 'steam_public': {
        $profile = st_profile();
        if (!$profile) fail('Fikk ikke kontakt med Steam.', 502);
        out(['configured' => true, 'profile' => $profile, 'library' => st_library(), 'at' => time()]);
    }
    }
}
