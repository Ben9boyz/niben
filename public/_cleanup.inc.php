<?php
// Old build files: every upload brings new JS files with new names (Navn-AbCd1234.js), and the old ones stay on the server.
// This finds the ones the page no longer uses and – when the owner says so – deletes them. Careful by design:
//   · only files with a build name (…-<8 characters>.js / .wasm) directly in the site's folder – never PHP, config, uploads/,
//     pictures, models, sw.js or anything else;
//   · what index.html (and every other page, manifest and sw.js) loads, and everything those files load in turn, is kept;
//   · if index.html points at a file that is missing (an upload not finished), nothing at all is deleted;
//   · a file uploaded in the last hour is left alone (somebody may still have the previous version open).

const CLEAN_NAME = '~^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}(?:-[a-z0-9]{4,12})?\.(?:js|wasm)$~';
const CLEAN_REF = '~[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}(?:-[a-z0-9]{4,12})?\.(?:js|wasm)~';

/** ['keep' => names, 'old' => [[name, bytes, mtime]], 'missing' => names the page needs but the server doesn't have] */
function cleanup_scan(string $dir): array {
    $index = @file_get_contents("$dir/index.html");
    if ($index === false) return ['keep' => [], 'old' => [], 'missing' => ['index.html']];
    $keep = [];
    $missing = [];
    $todo = [];
    foreach (array_merge(glob("$dir/*.html") ?: [], glob("$dir/*.json") ?: [], ["$dir/sw.js"]) as $root) { // (every page and file the site starts from)
        preg_match_all(CLEAN_REF, (string)@file_get_contents($root), $m);
        foreach (array_unique($m[0]) as $f) $todo[] = $f;
    }
    while ($todo) { // (follow what the kept files load in turn)
        $f = array_pop($todo);
        if (isset($keep[$f])) continue;
        $keep[$f] = true;
        $p = "$dir/$f";
        if (!is_file($p)) { $missing[] = $f; continue; }
        if (!str_ends_with($f, '.js')) continue;
        preg_match_all(CLEAN_REF, (string)file_get_contents($p), $mm);
        foreach (array_unique($mm[0]) as $g) if (!isset($keep[$g])) $todo[] = $g;
    }
    $old = [];
    foreach (scandir($dir) ?: [] as $f) {
        if (isset($keep[$f]) || !preg_match(CLEAN_NAME, $f) || !is_file("$dir/$f")) continue;
        $old[] = [$f, (int)filesize("$dir/$f"), (int)filemtime("$dir/$f")];
    }
    return ['keep' => array_keys($keep), 'old' => $old, 'missing' => $missing];
}

function cleanup_handle(string $action, bool $post): void {
    if ($action !== 'admin_cleanup') return;
    require_admin(); // (the site's owner only)
    $dir = __DIR__;
    $scan = cleanup_scan($dir);
    $fresh = time() - 3600;
    $old = array_values(array_filter($scan['old'], fn($o) => $o[2] < $fresh));
    $recent = count($scan['old']) - count($old);
    $list = array_map(fn($o) => ['name' => $o[0], 'bytes' => $o[1]], $old);
    if (!$post || empty(body()['delete'])) out(['old' => $list, 'kept' => count($scan['keep']), 'missing' => $scan['missing'], 'recent' => $recent]);
    if ($scan['missing']) fail('Siden mangler filer (' . implode(', ', array_slice($scan['missing'], 0, 3)) . ') – last opp alt på nytt før du rydder. Ingenting er slettet.', 409);
    $want = array_flip(array_map('strval', (array)(body()['names'] ?? [])));
    $deleted = 0; $freed = 0; $failed = [];
    foreach ($old as [$f, $bytes]) {
        if (!isset($want[$f])) continue; // (only what was on the list the owner saw)
        if (@unlink("$dir/$f")) { $deleted++; $freed += $bytes; } else $failed[] = $f;
    }
    out(['ok' => true, 'deleted' => $deleted, 'freed' => $freed, 'failed' => $failed]);
}
