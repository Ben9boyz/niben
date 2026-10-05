<?php
// Milestones: things worth showing on the home page when they happen – a new guitar recording, a finished book,
// an anime I can follow, a song I have learned. Kept as a short list in the key/value table (newest first).
// Automatic ones are added where the thing happens (saving a recording or a book, jpdb coverage); the rest by hand in Admin.

const MS_TYPES = ['recording', 'book', 'anime', 'song', 'other'];

function ms_all(): array {
    $l = json_decode(kv_get('milestones') ?: '[]', true);
    return is_array($l) ? $l : [];
}
/** Adds one – once: the same key is never added twice (editing a book again doesn't repeat it). */
function ms_add(string $key, string $type, string $title, string $sub = '', ?string $image = null, ?int $t = null, ?string $url = null): void {
    try {
        $l = ms_all();
        foreach ($l as $m) if (($m['key'] ?? '') === $key) return;
        array_unshift($l, ['key' => $key, 'type' => in_array($type, MS_TYPES, true) ? $type : 'other', 'title' => mb_substr($title, 0, 200), 'sub' => mb_substr($sub, 0, 200), 'image' => $image, 'url' => $url, 't' => $t ?: time()]);
        usort($l, fn($a, $b) => ($b['t'] ?? 0) <=> ($a['t'] ?? 0));
        kv_set('milestones', json_encode(array_slice($l, 0, 60), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    } catch (Throwable $e) {}
}

function ms_handle(string $action, bool $post): void {
    switch ($action) {
    case 'milestones':
        out(['items' => array_slice(ms_all(), 0, 12)]);
    case 'milestone_add': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $title = trim((string)($b['title'] ?? ''));
        if ($title === '') fail('Skriv hva du klarte.');
        $img = trim((string)($b['image'] ?? ''));
        if ($img !== '' && !preg_match('~^https://~', $img)) $img = '';
        ms_add('manual:' . bin2hex(random_bytes(4)), (string)($b['type'] ?? 'other'), $title, trim((string)($b['sub'] ?? '')), $img ?: null);
        out(['ok' => true, 'items' => array_slice(ms_all(), 0, 12)]);
    }
    case 'milestone_delete': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $b = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $k = (string)($b['key'] ?? '');
        kv_set('milestones', json_encode(array_values(array_filter(ms_all(), fn($m) => ($m['key'] ?? '') !== $k)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        out(['ok' => true, 'items' => array_slice(ms_all(), 0, 12)]);
    }
    }
}
