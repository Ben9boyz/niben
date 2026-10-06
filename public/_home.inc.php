<?php
// Where I live and what the weather is like there right now – so the site can rain when it rains at home and turn
// dark when it's night there. The place is set in Admin (found with Open-Meteo's free place search); the weather
// comes from Open-Meteo (no key). Only the place NAME and the weather are public – never the coordinates.

function hm_place(): ?array {
    $p = json_decode(kv_get('home_place') ?: 'null', true);
    return is_array($p) && isset($p['lat'], $p['lon']) ? $p : null;
}

/** WMO weather code → one of: clear, cloud, fog, drizzle, rain, snow, thunder. */
function hm_kind(int $c): string {
    if ($c === 0 || $c === 1) return 'clear';
    if ($c === 2 || $c === 3) return 'cloud';
    if ($c === 45 || $c === 48) return 'fog';
    if (in_array($c, [51, 53, 55, 56, 57], true)) return 'drizzle';
    if (in_array($c, [61, 63, 65, 66, 67, 80, 81, 82], true)) return 'rain';
    if (in_array($c, [71, 73, 75, 77, 85, 86], true)) return 'snow';
    if (in_array($c, [95, 96, 99], true)) return 'thunder';
    return 'cloud';
}

function hm_live(): ?array {
    $p = hm_place();
    if (!$p) return null;
    return sp_cached('home_live', 600, function () use ($p) {
        $url = 'https://api.open-meteo.com/v1/forecast?latitude=' . rawurlencode((string)$p['lat']) . '&longitude=' . rawurlencode((string)$p['lon'])
            . '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,is_day,precipitation&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=2';
        [$s, $res] = http_req('GET', $url, ['Accept: application/json']);
        if ($s !== 200) return null;
        $j = json_decode((string)$res, true);
        $c = $j['current'] ?? null;
        if (!$c) return null;
        return [
            'name' => $p['name'] ?? '',
            'kind' => hm_kind((int)($c['weather_code'] ?? 0)),
            'code' => (int)($c['weather_code'] ?? 0),
            'temp' => isset($c['temperature_2m']) ? round((float)$c['temperature_2m']) : null,
            'cloud' => (int)($c['cloud_cover'] ?? 0),
            'wind' => isset($c['wind_speed_10m']) ? round((float)$c['wind_speed_10m']) : 0,
            'precip' => (float)($c['precipitation'] ?? 0),
            'is_day' => !empty($c['is_day']),
            'sunrise' => $j['daily']['sunrise'] ?? [],
            'sunset' => $j['daily']['sunset'] ?? [],
            'at' => time(),
        ];
    });
}

function hm_handle(string $action, bool $post): void {
    switch ($action) {
    case 'home_live': {
        $l = hm_live();
        out($l ? ['configured' => true] + $l : ['configured' => (bool)hm_place(), 'name' => null]);
    }
    case 'home_search': {
        require_room_owner();
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2) out(['results' => []]);
        [$s, $res] = http_req('GET', 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=no&format=json&name=' . rawurlencode(mb_substr($q, 0, 80)), ['Accept: application/json']);
        if ($s !== 200) fail('Fikk ikke søkt etter stedet akkurat nå.', 502);
        $out = [];
        foreach ((json_decode((string)$res, true)['results'] ?? []) as $r)
            $out[] = ['name' => $r['name'] ?? '', 'region' => $r['admin1'] ?? '', 'country' => $r['country'] ?? '', 'lat' => $r['latitude'], 'lon' => $r['longitude']];
        out(['results' => $out]);
    }
    case 'home_set': {
        require_room_owner();
        if (!$post) fail('Bruk POST.', 405);
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        if (($b['clear'] ?? false)) { kv_set('home_place', null); kv_del('home_live'); out(['ok' => true, 'place' => null]); }
        $lat = (float)($b['lat'] ?? 999); $lon = (float)($b['lon'] ?? 999);
        if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) fail('Ugyldig sted.', 400);
        $name = trim(mb_substr((string)($b['name'] ?? ''), 0, 80));
        if ($name === '') fail('Stedet mangler navn.', 400);
        kv_set('home_place', json_encode(['name' => $name, 'lat' => round($lat, 2), 'lon' => round($lon, 2)], JSON_UNESCAPED_UNICODE)); // ~1 km: enough for the weather, not an address
        kv_del('home_live');
        out(['ok' => true, 'place' => ['name' => $name]]);
    }
    case 'home_get': {
        require_room_owner();
        $p = hm_place();
        out(['place' => $p ? ['name' => $p['name']] : null]);
    }
    }
}
