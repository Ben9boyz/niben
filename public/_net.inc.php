<?php
// Small HTTP helper shared by the Spotify, jpdb, Steam and GitHub code.

function http_req(string $method, string $url, array $headers = [], ?string $body = null): array {
    $ctx = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body ?? '',
        'ignore_errors' => true,
        'timeout' => 12,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('~^HTTP/\S+\s+(\d{3})~', $h, $m)) $status = (int)$m[1];
    }
    return [$status, $res === false ? '' : $res];
}

