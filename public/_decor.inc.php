<?php
// My own 3D models in the room: uploaded as .glb in Admin, placed (and moved around) in "Rediger rommet".
// The list lives in the key/value table ('room_decor'), the files in uploads/models/.

const DECOR_KEY = 'room_decor';
const DECOR_MAX_BYTES = 14 * 1024 * 1024;

function decor_list(): array { return json_decode((string)kv_get(DECOR_KEY), true) ?: []; }
function decor_store(array $l): void { kv_set(DECOR_KEY, json_encode(array_values($l), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); }
function decor_num($v, float $min, float $max, float $def): float { return is_numeric($v) ? max($min, min($max, (float)$v)) : $def; }


// ── Own 3D models for guitars (and figures): the same GLB rules, the files in uploads/models/ ──
const GM_KEY = 'guitar_models';
function gm_map(): array { $m = json_decode((string)kv_get(GM_KEY), true); return is_array($m) ? $m : []; }
function gm_store(array $m): void { kv_set(GM_KEY, json_encode((object)$m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); }
/** Checks an uploaded .glb ($_FILES entry) and saves it; returns its path (relative to the site) or fails. */
function glb_store_upload(array $f): string {
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail(upload_error((int)($f['error'] ?? UPLOAD_ERR_NO_FILE)));
    if ($f['size'] > DECOR_MAX_BYTES) fail('Modellen er for stor (maks 14 MB). Prøv å gjøre den mindre i Blender, eller bruk en enklere modell.');
    if (strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION)) !== 'glb') fail('Bare .glb-filer (én fil med alt i). Konverter andre formater til GLB først.');
    $fh = @fopen($f['tmp_name'], 'rb');
    $magic = $fh ? fread($fh, 4) : '';
    if ($fh) fclose($fh);
    if ($magic !== 'glTF') fail('Det ser ikke ut som en gyldig GLB-fil.');
    $name = random_name('glb');
    if (!move_uploaded_file($f['tmp_name'], upload_dir('models') . '/' . $name)) fail('Klarte ikke å lagre filen.', 500);
    return 'uploads/models/' . $name;
}
/** The guitar has to be this room's: an account's own (in the table), or – for the owner – one from data.json. */
function gm_check_guitar(int $uid, string $id): void {
    if (!preg_match('~^[a-z0-9_-]{1,40}$~i', $id)) fail('Ukjent gitar.');
    if ($uid === 1) return;
    $st = db()->prepare('SELECT 1 FROM guitars WHERE slug = ? AND user_id = ?');
    $st->execute([$id, $uid]);
    if (!$st->fetchColumn()) fail('Den gitaren er ikke din.', 403);
}
function glb_remove(?string $file): void {
    if ($file && str_starts_with($file, 'uploads/models/') && !str_contains($file, '..')) { $p = __DIR__ . '/' . $file; if (is_file($p)) @unlink($p); }
}
/**
 * The owner's own guitars from data.json have their models as files next to the site (pacifica.glb …). Move them over to
 * the same place as everybody's uploads – once, only copying, never deleting – so the files in the repository can go.
 */
function gm_adopt_builtin(): void {
    if (kv_get('guitar_models_adopted')) return;
    $json = json_decode((string)@file_get_contents(__DIR__ . '/data.json'), true);
    $map = gm_map();
    $done = true;
    foreach ((array)($json['gitarer'] ?? []) as $g) {
        $id = (string)($g['id'] ?? '');
        $file = (string)($g['modell'] ?? '');
        if ($id === '' || $file === '' || isset($map[$id])) continue;
        $src = __DIR__ . '/' . basename($file);
        if (!is_file($src)) { $done = false; continue; }
        $name = random_name('glb');
        if (@copy($src, upload_dir('models') . '/' . $name)) $map[$id] = 'uploads/models/' . $name; else $done = false;
    }
    gm_store($map);
    if ($done) kv_set('guitar_models_adopted', '1');
}


// ── Figures on the shelf in the room: a .glb each, with a name and a short description. The room's own (kv 'room_figures'). ──
const FIG_KEY = 'room_figures';
const FIG_MAX = 12;
function fig_list(): array { $l = json_decode((string)kv_get(FIG_KEY), true); return is_array($l) ? $l : []; }
function fig_store(array $l): void { kv_set(FIG_KEY, json_encode(array_values($l), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); }

function decor_handle(string $action, bool $post): void {
    switch ($action) {
    case 'decor_get':
        out(['items' => decor_list()]);

    case 'decor_upload': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $f = $_FILES['file'] ?? [];
        if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail(upload_error((int)($f['error'] ?? UPLOAD_ERR_NO_FILE)));
        if ($f['size'] > DECOR_MAX_BYTES) fail('Modellen er for stor (maks 14 MB). Prøv å gjøre den mindre i Blender, eller bruk en enklere modell.');
        if (strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION)) !== 'glb') fail('Bare .glb-filer (én fil med alt i). Konverter andre formater til GLB først.');
        $fh = @fopen($f['tmp_name'], 'rb');
        $magic = $fh ? fread($fh, 4) : '';
        if ($fh) fclose($fh);
        if ($magic !== 'glTF') fail('Det ser ikke ut som en gyldig GLB-fil.');
        $name = random_name('glb');
        if (!move_uploaded_file($f['tmp_name'], upload_dir('models') . '/' . $name)) fail('Klarte ikke å lagre filen.', 500);
        $list = decor_list();
        if (count($list) >= 40) fail('Maks 40 modeller i rommet.');
        $label = mb_substr(trim((string)($_POST['name'] ?? '')) ?: pathinfo((string)$f['name'], PATHINFO_FILENAME), 0, 50);
        $item = ['id' => bin2hex(random_bytes(5)), 'file' => 'uploads/models/' . $name, 'name' => $label, 'x' => 0.0, 'y' => 0.0, 'z' => 1.2, 'rot' => 0.0, 'scale' => 1.0, 'visible' => true];
        $list[] = $item;
        decor_store($list);
        out(['ok' => true, 'item' => $item]);
    }

    case 'decor_guitar_upload': {
        // { id (the guitar), file }: this guitar gets its own model (the old uploaded one is removed)
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_room_owner();
        $id = (string)($_POST['id'] ?? '');
        gm_check_guitar($uid, $id);
        $file = glb_store_upload($_FILES['file'] ?? []);
        $map = gm_map();
        glb_remove($map[$id] ?? null);
        $map[$id] = $file;
        gm_store($map);
        out(['ok' => true, 'models' => (object)$map]);
    }

    case 'decor_guitar_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_room_owner();
        $id = (string)(body()['id'] ?? '');
        gm_check_guitar($uid, $id);
        $map = gm_map();
        glb_remove($map[$id] ?? null);
        unset($map[$id]);
        gm_store($map);
        out(['ok' => true, 'models' => (object)$map]);
    }

    case 'decor_figure_upload': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $list = fig_list();
        if (count($list) >= FIG_MAX) fail('Maks ' . FIG_MAX . ' figurer på hylla.');
        $file = glb_store_upload($_FILES['file'] ?? []);
        $name = mb_substr(trim((string)($_POST['name'] ?? '')) ?: pathinfo((string)($_FILES['file']['name'] ?? ''), PATHINFO_FILENAME), 0, 60);
        $item = ['id' => bin2hex(random_bytes(5)), 'file' => $file, 'name' => $name ?: 'Figur', 'desc' => mb_substr(trim((string)($_POST['desc'] ?? '')), 0, 1500)];
        $list[] = $item;
        fig_store($list);
        out(['ok' => true, 'figures' => $list]);
    }

    case 'decor_figure_save': {
        // { items: [{ id, name, desc }] } in the order they should stand on the shelf
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $by = [];
        foreach (fig_list() as $f) $by[$f['id']] = $f;
        $out = [];
        foreach ((array)(body()['items'] ?? []) as $n) {
            if (!is_array($n) || !isset($n['id'], $by[(string)$n['id']])) continue;
            $f = $by[(string)$n['id']];
            if (isset($n['name'])) $f['name'] = mb_substr(trim((string)$n['name']), 0, 60) ?: $f['name'];
            if (isset($n['desc'])) $f['desc'] = mb_substr(trim((string)$n['desc']), 0, 1500);
            $out[] = $f;
            unset($by[$f['id']]);
        }
        foreach ($by as $f) $out[] = $f; // (anything left out of the list stays, at the end)
        fig_store($out);
        out(['ok' => true, 'figures' => $out]);
    }

    case 'decor_figure_delete': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $id = (string)(body()['id'] ?? '');
        $keep = [];
        foreach (fig_list() as $f) { if ($f['id'] === $id) glb_remove($f['file']); else $keep[] = $f; }
        fig_store($keep);
        out(['ok' => true, 'figures' => $keep]);
    }

    case 'decor_save': {
        // new positions / sizes / names / visibility: { items: [{ id, x, y, z, rot, scale, visible, name }] } – each room moves its own
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $in = [];
        foreach ((array)(body()['items'] ?? []) as $it) if (is_array($it) && isset($it['id'])) $in[(string)$it['id']] = $it;
        $list = decor_list();
        foreach ($list as &$d) {
            $n = $in[$d['id']] ?? null;
            if (!$n) continue;
            $d['x'] = decor_num($n['x'] ?? null, -3.7, 3.7, $d['x']);
            $d['z'] = decor_num($n['z'] ?? null, -3.3, 3.3, $d['z']);
            $d['y'] = decor_num($n['y'] ?? null, 0, 3, $d['y'] ?? 0);
            $d['rot'] = decor_num($n['rot'] ?? null, -100, 100, $d['rot']);
            $d['scale'] = decor_num($n['scale'] ?? null, 0.05, 8, $d['scale']);
            if (isset($n['visible'])) $d['visible'] = !!$n['visible'];
            if (isset($n['name'])) $d['name'] = mb_substr(trim((string)$n['name']), 0, 50);
        }
        unset($d);
        decor_store($list);
        out(['ok' => true, 'items' => $list]);
    }

    case 'decor_delete': {
        if (!$post) fail('Bruk POST.', 405);
        require_room_owner();
        $id = (string)(body()['id'] ?? '');
        $keep = [];
        foreach (decor_list() as $d) {
            if ($d['id'] === $id) { $p = __DIR__ . '/' . ($d['file'] ?? ''); if (str_starts_with((string)($d['file'] ?? ''), 'uploads/models/') && is_file($p)) @unlink($p); }
            else $keep[] = $d;
        }
        decor_store($keep);
        out(['ok' => true]);
    }
    }
}
