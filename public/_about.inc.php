<?php
// "Om meg": the text on the about page, edited by the admin on the page itself.
// Stored in the small key/value table (kv_get / kv_set from _spotify.inc.php).

// "Questions to get to know each other": the same few questions in every room (set by the owner of the site, kept in the shared
// scope 0); each room answers the ones it wants to in its own "about" (svar). A question nobody answered is simply not shown.
function q_defaults(): array {
    return [['id' => 'q1', 'text' => 'Låt som får meg i gang'], ['id' => 'q2', 'text' => 'Et sted jeg vil anbefale'],
            ['id' => 'q3', 'text' => 'Noe jeg har lyst til å lære'], ['id' => 'q4', 'text' => 'Det siste jeg ble helt oppslukt av']];
}
function q_list(): array {
    $room = kv_scope();
    kv_scope(0);
    try { $raw = kv_get('questions'); } finally { kv_scope($room); }
    $l = $raw ? json_decode($raw, true) : null;
    return is_array($l) && $l ? array_values($l) : q_defaults();
}

// the places a room can have its own picture: the door in the hall and two walls of the room
const ABOUT_IMAGE_SLOTS = ['door', 'wall_back', 'wall_left', 'wall_right', 'floor'];

function about_handle(string $action, bool $post): void {
    switch ($action) {
    case 'about_get': {
        $raw = kv_get('about');
        out(['about' => $raw ? json_decode($raw, true) : null, 'questions' => q_list()]);
    }
    case 'about_nav': {
        // the room's own menu: which tabs, called what, with which symbol, and which pages / hobbies sit under each.
        // { tabs: [{ id, label, icon, routes: ['japansk', 'h:<module id>', …] }], hidden: [...] } – or { reset: true } for the standard one
        if (!$post) fail('Bruk POST.', 405);
        require_user();
        $b = body();
        if (!empty($b['reset'])) { kv_del('nav_tabs'); out(['ok' => true, 'nav' => null]); }
        $route = fn($r) => is_string($r) && preg_match('~^(h:[a-f0-9]{10}|[a-z]{2,16})$~', $r) ? $r : null;
        $seen = [];
        $tabs = [];
        foreach (array_slice((array)($b['tabs'] ?? []), 0, 12) as $t) {
            if (!is_array($t)) continue;
            $id = (string)($t['id'] ?? '');
            if (!preg_match('~^[a-z0-9_-]{1,24}$~', $id) || isset($seen['t' . $id])) $id = 't' . bin2hex(random_bytes(3));
            $seen['t' . $id] = true;
            $routes = [];
            foreach (array_slice((array)($t['routes'] ?? []), 0, 40) as $r) { $r = $route($r); if ($r && !isset($seen[$r])) { $routes[] = $r; $seen[$r] = true; } }
            $tabs[] = ['id' => $id, 'label' => mb_substr(trim(strip_tags((string)($t['label'] ?? ''))), 0, 24) ?: 'Fane', 'icon' => preg_match('~^[A-Za-z0-9]{1,32}$~', (string)($t['icon'] ?? '')) ? (string)$t['icon'] : '', 'routes' => $routes];
        }
        $hidden = [];
        foreach (array_slice((array)($b['hidden'] ?? []), 0, 80) as $r) { $r = $route($r); if ($r && !isset($seen[$r])) { $hidden[] = $r; $seen[$r] = true; } }
        $nav = ['tabs' => $tabs, 'hidden' => $hidden];
        kv_set('nav_tabs', json_encode($nav, JSON_UNESCAPED_UNICODE));
        out(['ok' => true, 'nav' => $nav]);
    }
    case 'about_questions': {
        // the owner of the site sets the questions every room can answer (at most 6, short)
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $old = array_column(q_list(), 'text', 'id');
        $out = [];
        foreach (array_slice((array)(body()['questions'] ?? []), 0, 6) as $q) {
            $text = mb_substr(trim((string)($q['text'] ?? '')), 0, 100);
            if ($text === '') continue;
            $id = (string)($q['id'] ?? '');
            if (!isset($old[$id]) || !preg_match('~^q[a-z0-9]{1,8}$~', $id)) $id = 'q' . bin2hex(random_bytes(3));
            $out[] = ['id' => $id, 'text' => $text];
        }
        kv_scope(0);
        kv_set('questions', json_encode($out, JSON_UNESCAPED_UNICODE));
        kv_scope(1);
        out(['ok' => true, 'questions' => $out ?: q_defaults()]);
    }
    case 'about_photo': {
        // my photo on the about page (and the home page / the frame in the room) – stored like the trip photos
        if (!$post) fail('Bruk POST.', 405);
        require_user();
        [$path] = save_photo($_FILES['file'] ?? []);
        $about = json_decode((string)kv_get('about'), true) ?: [];
        if (!empty($about['bilde'])) delete_upload($about['bilde']);
        $about['bilde'] = $path;
        kv_set('about', json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'bilde' => $path]);
    }
    case 'about_image': {
        // a picture for the door in the hall or for a wall of the room (the page has already cropped it to the right shape)
        if (!$post) fail('Bruk POST.', 405);
        require_user();
        $slot = (string)($_POST['slot'] ?? '');
        if (!in_array($slot, ABOUT_IMAGE_SLOTS, true)) fail('Ukjent plass for bildet.');
        [$path] = save_photo($_FILES['file'] ?? []);
        $about = json_decode((string)kv_get('about'), true) ?: [];
        if (!empty($about['bilder'][$slot])) delete_upload($about['bilder'][$slot]);
        $about['bilder'][$slot] = $path;
        kv_set('about', json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'bilder' => $about['bilder']]);
    }
    case 'about_image_clear': {
        if (!$post) fail('Bruk POST.', 405);
        require_user();
        $slot = (string)(body()['slot'] ?? '');
        if (!in_array($slot, ABOUT_IMAGE_SLOTS, true)) fail('Ukjent plass for bildet.');
        $about = json_decode((string)kv_get('about'), true) ?: [];
        if (!empty($about['bilder'][$slot])) delete_upload($about['bilder'][$slot]);
        unset($about['bilder'][$slot]);
        if (empty($about['bilder'])) unset($about['bilder']);
        kv_set('about', json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'bilder' => $about['bilder'] ?? new stdClass()]);
    }
    case 'about_save': {
        if (!$post) fail('Bruk POST.', 405);
        require_user();
        $b = body();
        $clean = fn($v, int $max) => mb_substr(trim((string)($v ?? '')), 0, $max);
        $links = [];
        foreach (array_slice((array)($b['lenker'] ?? []), 0, 8) as $l) {
            $url = $clean($l['url'] ?? '', 300);
            $name = $clean($l['navn'] ?? '', 40);
            if ($name !== '' && preg_match('~^https?://~i', $url)) $links[] = ['navn' => $name, 'url' => $url];
        }
        $old = json_decode((string)kv_get('about'), true) ?: [];
        $about = [
            'bilde' => $old['bilde'] ?? null,
            'tagline' => $clean($b['tagline'] ?? '', 120),
            'tekst' => $clean($b['tekst'] ?? '', 4000),
            'lenker' => $links,
            'svar' => $old['svar'] ?? new stdClass(),
        ];
        if (!empty($old['bilder'])) $about['bilder'] = $old['bilder'];
        if (array_key_exists('svar', $b)) { // answers to the shared questions: only ones that exist, short, and empty ones dropped
            $ids = array_column(q_list(), 'id');
            $svar = [];
            foreach ((array)$b['svar'] as $qid => $a) {
                $a = mb_substr(trim((string)$a), 0, 300);
                if ($a !== '' && in_array((string)$qid, $ids, true)) $svar[(string)$qid] = $a;
            }
            $about['svar'] = $svar ?: new stdClass();
        }
        kv_set('about', json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'about' => $about]);
    }
    }
}
