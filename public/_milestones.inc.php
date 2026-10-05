<?php
// Milestones: things worth showing on the home page when they happen – a new guitar recording, a finished book,
// an anime I can follow, a song I have learned. Kept as a short list in the key/value table (newest first).
// Automatic ones are added where the thing happens (saving a recording or a book, jpdb coverage); the rest by hand in Admin.

const MS_TYPES = ['recording', 'book', 'anime', 'song', 'trip', 'other'];

/** A trip that has started (or is over) in the last 30 days is a milestone – checked whenever the list is read, so a trip entered in advance shows up on the day it begins. */
function ms_trips(): void {
    try {
        $rows = db()->query("SELECT id, country, place, title, date_from, date_to, year FROM trips WHERE date_from IS NOT NULL AND date_from <= CURDATE() AND date_from >= CURDATE() - INTERVAL 30 DAY")->fetchAll();
        foreach ($rows as $r) ms_add('trip:' . $r['id'], 'trip', trim(($r['place'] ?: $r['country']) . ($r['place'] && $r['country'] ? ', ' . $r['country'] : '')), (string)$r['title'], null, strtotime($r['date_from'] . ' 12:00') ?: time());
    } catch (Throwable $e) {}
    // recordings: the date on the recording (Gitar → opptak) decides – one made in the last 30 days is "just released"
    try {
        $rows = db()->query("SELECT id, guitar, title, recorded_on FROM recordings WHERE recorded_on IS NOT NULL AND recorded_on <= CURDATE() AND recorded_on >= CURDATE() - INTERVAL 30 DAY")->fetchAll();
        foreach ($rows as $r) ms_add('rec:' . $r['id'], 'recording', (string)$r['title'], 'Nytt gitaropptak', null, strtotime($r['recorded_on'] . ' 12:00') ?: time());
    } catch (Throwable $e) {}
}

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
        ms_trips();
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
