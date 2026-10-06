<?php
// Stands in for public/_net.inc.php while the API tests run: Spotify is a small fake that follows a JSON file the tests
// change (spotify-mock.json), and every call is logged (spotify-calls.log) so the tests can count what was asked.
//   { "device": true (play works), "albums": 3, "playlists": 0, "deny": false, "tracks": { "BIGBIGBIGBIG": 199 }, "page": 20 }
function http_req(string $method, string $url, array $headers = [], ?string $body = null): array {
    $dir = getenv('NIBEN_TEST_DIR') ?: __DIR__;
    if (strpos($url, 'api.spotify.com') === false) return [0, ''];
    @file_put_contents("$dir/spotify-calls.log", $method . ' ' . preg_replace('~^https://api\.spotify\.com/v1~', '', $url) . "\n", FILE_APPEND);
    $m = json_decode((string)@file_get_contents("$dir/spotify-mock.json"), true) ?: [];
    if (!empty($m['deny'])) return [403, '{"error":{"status":403,"message":"user not registered"}}'];
    $path = (string)parse_url($url, PHP_URL_PATH);
    parse_str((string)parse_url($url, PHP_URL_QUERY), $q);
    $limit = max(1, (int)($q['limit'] ?? 20));
    $offset = (int)($q['offset'] ?? 0);
    $json = fn($x, int $s = 200) => [$s, json_encode($x)];

    if (preg_match('~/me/albums$~', $path)) {
        $n = (int)($m['albums'] ?? 0);
        $items = [];
        for ($i = $n - $offset; $i >= 1 && count($items) < min($limit, (int)($m['page'] ?? 50)); $i--) {
            $items[] = ['added_at' => '2025-01-01T00:00:00Z', 'album' => ['id' => "ALB$i", 'uri' => "spotify:album:ALB$i", 'name' => "Album $i", 'artists' => [['name' => 'X', 'id' => 'X1']], 'images' => [], 'release_date' => '2020', 'total_tracks' => 9]];
        }
        return $json(['items' => $items, 'total' => $n, 'next' => null]);
    }
    if (preg_match('~/me/playlists$~', $path)) return $json(['items' => [], 'total' => (int)($m['playlists'] ?? 0), 'next' => null]);
    if (preg_match('~/me$~', $path)) return $json(['id' => 'me']);
    if (!empty($m['device']) && preg_match('~/me/player(/play|/shuffle)?$~', $path) && $method === 'PUT') return [204, ''];
    if (preg_match('~/me/player/queue$~', $path)) return $json(['queue' => []]);
    if (preg_match('~/me/player$~', $path)) return [204, ''];
    if (preg_match('~/albums/([A-Za-z0-9]+)/tracks$~', $path, $mm)) {
        $total = (int)($m['tracks'][$mm[1]] ?? 0);
        if (!$total) return [404, '{}'];
        $page = min($limit, (int)($m['page'] ?? 50));
        $items = [];
        for ($i = $offset; $i < min($total, $offset + $page); $i++) {
            $n = $i + 1;
            $items[] = ['uri' => 'spotify:track:T' . str_pad((string)$n, 12, '0', STR_PAD_LEFT), 'name' => "Track $n", 'artists' => [['name' => 'M', 'id' => 'M1']], 'track_number' => $n, 'disc_number' => 1, 'duration_ms' => 1000];
        }
        return $json(['items' => $items, 'total' => $total, 'next' => $offset + $page < $total ? 'more' : null]);
    }
    return [404, '{}'];
}
