<?php
// Small HTTP helper shared by the Spotify, jpdb, Steam and GitHub code.

function http_req(string $method, string $url, array $headers = [], ?string $body = null): array {
    // PHP leaves Content-Length out of a PUT / POST / DELETE without a body, and Spotify then answers
    // 411 "Length Required" – that is why shuffle, skip and the heart (all body-less) did nothing
    if (($body === null || $body === '') && in_array(strtoupper($method), ['PUT', 'POST', 'DELETE', 'PATCH'], true)
        && !preg_grep('~^content-length\s*:~i', $headers)) {
        $headers[] = 'Content-Length: 0';
    }
    $ctx = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body ?? '',
        'ignore_errors' => true,
        'timeout' => 12,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    $status = 0;
    $GLOBALS['http_last_headers'] = $http_response_header ?? [];
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('~^HTTP/\S+\s+(\d{3})~', $h, $m)) $status = (int)$m[1];
    }
    return [$status, $res === false ? '' : $res];
}


/** A header of the last answer http_req got (case-insensitive), or null. */
function http_last_header(string $name): ?string {
    foreach ((array)($GLOBALS['http_last_headers'] ?? []) as $h) if (stripos($h, $name . ':') === 0) return trim(substr($h, strlen($name) + 1));
    return null;
}
