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

function about_handle(string $action, bool $post): void {
    switch ($action) {
    case 'about_get': {
        $raw = kv_get('about');
        out(['about' => $raw ? json_decode($raw, true) : null, 'questions' => q_list()]);
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
