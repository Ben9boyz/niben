<?php
/**
 * GitHub for the projects tab: my public repositories (name, description, language, stars, links).
 * Fetched from GitHub's open API and kept for an hour in the database, so the site never waits for
 * GitHub and stays well under its rate limit. Only public repositories – no key needed.
 *
 * The user name is set here; _config.php can override it with 'github_user'.
 * Uses http_req / sp_cached from _spotify.inc.php.
 */

const GH_USER = 'Ben9boyz';

function gh_repos(): ?array {
    global $config;
    $user = preg_replace('~[^A-Za-z0-9-]~', '', (string)($config['github_user'] ?? GH_USER));
    if ($user === '') return null;
    return sp_cached('cache_github_' . $user, 3600, function () use ($user) {
        [$status, $res] = http_req('GET', 'https://api.github.com/users/' . $user . '/repos?per_page=100&sort=pushed&type=owner', [
            'User-Agent: niben.no', // GitHub refuses requests without one
            'Accept: application/vnd.github+json',
        ]);
        $list = $status === 200 ? json_decode((string)$res, true) : null;
        if (!is_array($list)) return null;
        $out = [];
        foreach ($list as $r) {
            if (!empty($r['fork']) || !empty($r['archived']) || !empty($r['private'])) continue;
            $homepage = trim((string)($r['homepage'] ?? ''));
            $out[] = [
                'name' => $r['name'],
                'description' => $r['description'] ?? null,
                'language' => $r['language'] ?? null,
                'topics' => array_slice($r['topics'] ?? [], 0, 4),
                'stars' => (int)($r['stargazers_count'] ?? 0),
                'url' => $r['html_url'],
                'homepage' => preg_match('~^https://~i', $homepage) ? $homepage : null,
                'created' => substr((string)($r['created_at'] ?? ''), 0, 4),
                'pushed' => $r['pushed_at'] ?? null,
            ];
        }
        return array_slice($out, 0, 24);
    });
}

function gh_handle(string $action): void {
    if ($action !== 'github_repos') return;
    $repos = gh_repos();
    if ($repos === null) fail('Fikk ikke kontakt med GitHub.', 502);
    out(['repos' => $repos]);
}
