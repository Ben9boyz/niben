<?php
// Songs to practise in the practice corner (chords, tempo, capo, a link to the chord sheet).

function songs_ensure(): void {
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, title VARCHAR(200) NOT NULL, artist VARCHAR(200) NULL,
  chords VARCHAR(400) NOT NULL, bpm SMALLINT UNSIGNED NULL, beats TINYINT UNSIGNED NULL, capo TINYINT UNSIGNED NULL,
  ug_url VARCHAR(255) NULL, notes TEXT NULL, sheet TEXT NULL, practising TINYINT(1) NOT NULL DEFAULT 0, strum VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL);
    // tables made before the chord sheet existed get the column added once
    foreach (['sheet TEXT NULL', 'practising TINYINT(1) NOT NULL DEFAULT 0', 'strum VARCHAR(32) NULL'] as $col) {
        try { db()->exec('ALTER TABLE songs ADD COLUMN ' . $col); } catch (PDOException $e) { /* already there */ }
    }
}

function songs_list(PDO $pdo): array {
    $sql = 'SELECT id, title, artist, chords, bpm, beats, capo, ug_url, notes, sheet, practising, strum FROM songs WHERE user_id = ? ORDER BY title, id';
    $room = kv_scope();
    try {
        $q = $pdo->prepare($sql);
        $q->execute([$room]);
        $rows = $q->fetchAll();
    } catch (PDOException $e) {
        try {
            songs_ensure(); // no table yet, or the newest columns are missing: make/extend it and ask again
            $q = $pdo->prepare($sql);
            $q->execute([$room]);
            $rows = $q->fetchAll();
        } catch (PDOException $e2) {
            return [];
        }
    }
    // the pasted chord sheet is for the room's owner's own practice – only sent to them
    if (!viewing_own_room()) foreach ($rows as &$r) $r['sheet'] = null;
    return $rows;
}

function songs_handle(string $action, bool $post): void {
    switch ($action) {
    case 'song_save': {
        // a song to practise: its chords (e.g. "G D Em C"), tempo, capo and a link to Ultimate Guitar
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        songs_ensure(); // (adds the newest columns, e.g. strum, to an older table)
        $b = body();
        $title = str_or_null($b['title'] ?? null, 200) ?? fail('Skriv en tittel.');
        $chords = preg_replace('/\s+/', ' ', trim((string)($b['chords'] ?? '')));
        if ($chords === '' || mb_strlen($chords) > 400) fail('Skriv akkordene, f.eks. «G D Em C».');
        if (!preg_match('~^[A-Ga-g0-9#b/ |()mMajdisugx+°ø-]+$~u', $chords)) fail('Akkordene inneholder tegn jeg ikke kjenner igjen.');
        $url = str_or_null($b['ug_url'] ?? null, 255);
        if ($url !== null && !preg_match('~^https://([a-z0-9-]+\.)*ultimate-guitar\.com/~i', $url)) fail('Lenken må gå til ultimate-guitar.com.');
        $vals = [
            $title,
            str_or_null($b['artist'] ?? null, 200),
            $chords,
            int_or_null($b['bpm'] ?? null, 30, 260),
            int_or_null($b['beats'] ?? null, 1, 16),
            int_or_null($b['capo'] ?? null, 0, 12),
            $url,
            str_or_null($b['notes'] ?? null, 4000),
            str_or_null($b['sheet'] ?? null, 8000),
            empty($b['practising']) ? 0 : 1,
            // strumming: one character per eighth note – D (down), U (up), X (muted), - (nothing)
            preg_match('~^[DUX-]{4,32}$~', strtoupper((string)($b['strum'] ?? ''))) ? strtoupper((string)$b['strum']) : null,
        ];
        $id = int_or_null($b['id'] ?? null, 1, PHP_INT_MAX);
        if ($id) {
            $st = db()->prepare('UPDATE songs SET title=?, artist=?, chords=?, bpm=?, beats=?, capo=?, ug_url=?, notes=?, sheet=?, practising=?, strum=? WHERE id=? AND user_id=?');
            $st->execute([...$vals, $id, $uid]);
            if (!$st->rowCount()) { $own = db()->prepare('SELECT 1 FROM songs WHERE id=? AND user_id=?'); $own->execute([$id, $uid]); if (!$own->fetchColumn()) fail('Den sangen er ikke din.', 403); }
        } else {
            db()->prepare('INSERT INTO songs (title, artist, chords, bpm, beats, capo, ug_url, notes, sheet, practising, strum, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')->execute([...$vals, $uid]);
            $id = (int)db()->lastInsertId();
        }
        out(['ok' => true, 'id' => $id]);
    }

    case 'song_delete': {
        if (!$post) fail('Bruk POST.', 405);
        $uid = require_user();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        db()->prepare('DELETE FROM songs WHERE id=? AND user_id=?')->execute([$id, $uid]);
        out(['ok' => true]);
    }

    }
}
