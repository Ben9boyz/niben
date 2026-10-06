<?php
// "Om meg": the text on the about page, edited by the admin on the page itself.
// Stored in the small key/value table (kv_get / kv_set from _spotify.inc.php).

function about_handle(string $action, bool $post): void {
    switch ($action) {
    case 'about_get': {
        $raw = kv_get('about');
        out(['about' => $raw ? json_decode($raw, true) : null]);
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
        ];
        kv_set('about', json_encode($about, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'about' => $about]);
    }
    }
}
