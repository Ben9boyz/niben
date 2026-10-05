<?php
// My own 3D models in the room: uploaded as .glb in Admin, placed (and moved around) in "Rediger rommet".
// The list lives in the key/value table ('room_decor'), the files in uploads/models/.

const DECOR_KEY = 'room_decor';
const DECOR_MAX_BYTES = 14 * 1024 * 1024;

function decor_list(): array { return json_decode((string)kv_get(DECOR_KEY), true) ?: []; }
function decor_store(array $l): void { kv_set(DECOR_KEY, json_encode(array_values($l), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); }
function decor_num($v, float $min, float $max, float $def): float { return is_numeric($v) ? max($min, min($max, (float)$v)) : $def; }

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

    case 'decor_save': {
        // new positions / sizes / names / visibility: { items: [{ id, x, y, z, rot, scale, visible, name }] }
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
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
        require_admin();
        $id = (string)(body()['id'] ?? '');
        $keep = [];
        foreach (decor_list() as $d) {
            if ($d['id'] === $id) { $p = __DIR__ . '/' . $d['file']; if (str_starts_with($d['file'], 'uploads/models/') && is_file($p)) @unlink($p); }
            else $keep[] = $d;
        }
        decor_store($keep);
        out(['ok' => true]);
    }
    }
}
