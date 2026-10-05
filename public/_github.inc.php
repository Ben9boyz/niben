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

/** Every file in one of my public repositories (path, size), for the code reader. Cached for an hour. */
function gh_tree(string $repo): ?array {
    global $config;
    $user = preg_replace('~[^A-Za-z0-9-]~', '', (string)($config['github_user'] ?? GH_USER));
    return sp_cached('cache_ghtree_' . $user . '_' . $repo, 3600, function () use ($user, $repo) {
        $h = ['User-Agent: niben.no', 'Accept: application/vnd.github+json'];
        [$s, $res] = http_req('GET', "https://api.github.com/repos/$user/$repo", $h);
        $info = $s === 200 ? json_decode((string)$res, true) : null;
        if (!$info || !empty($info['private'])) return null;
        $branch = $info['default_branch'] ?? 'main';
        [$s, $res] = http_req('GET', "https://api.github.com/repos/$user/$repo/git/trees/" . rawurlencode($branch) . '?recursive=1', $h);
        $tree = $s === 200 ? json_decode((string)$res, true) : null;
        if (!$tree) return null;
        $files = [];
        foreach ($tree['tree'] ?? [] as $t) {
            if (($t['type'] ?? '') !== 'blob') continue;
            $files[] = ['path' => $t['path'], 'size' => (int)($t['size'] ?? 0)];
        }
        return [
            'owner' => $user, 'repo' => $repo, 'branch' => $branch,
            'url' => $info['html_url'] ?? null, 'description' => $info['description'] ?? null,
            'pushed' => $info['pushed_at'] ?? null, 'truncated' => !empty($tree['truncated']),
            'files' => array_slice($files, 0, 3000),
        ];
    });
}

function gh_handle(string $action): void {
    if ($action === 'github_tree') {
        $repo = (string)($_GET['repo'] ?? '');
        if (!preg_match('~^[A-Za-z0-9._-]{1,100}$~', $repo)) fail('Ugyldig repo.');
        // only my own listed repositories – random names would each cost a call to GitHub
        if (!in_array($repo, array_column(gh_repos() ?? [], 'name'), true)) fail('Fant ikke repoet.', 404);
        $t = gh_tree($repo);
        if ($t === null) fail('Fant ikke repoet på GitHub.', 404);
        out($t);
    }
    if ($action !== 'github_repos') return;
    $repos = gh_repos();
    if ($repos === null) fail('Fikk ikke kontakt med GitHub.', 502);
    out(['repos' => $repos]);
}
