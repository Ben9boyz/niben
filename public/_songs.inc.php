<?php
// Songs to practise in the practice corner (chords, tempo, capo, a link to the chord sheet).

function songs_ensure(): void {
    db()->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS songs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT, title VARCHAR(200) NOT NULL, artist VARCHAR(200) NULL,
  chords VARCHAR(400) NOT NULL, bpm SMALLINT UNSIGNED NULL, beats TINYINT UNSIGNED NULL, capo TINYINT UNSIGNED NULL,
  ug_url VARCHAR(255) NULL, notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL);
}

function songs_list(PDO $pdo): array {
    try {
        return $pdo->query('SELECT id, title, artist, chords, bpm, beats, capo, ug_url, notes FROM songs ORDER BY title, id')->fetchAll();
    } catch (PDOException $e) {
        return []; // no songs saved yet (the table is made on the first save)
    }
}

function songs_handle(string $action, bool $post): void {
    switch ($action) {
    case 'song_save': {
        // a song to practise: its chords (e.g. "G D Em C"), tempo, capo and a link to Ultimate Guitar
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        songs_ensure();
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
        ];
        $id = int_or_null($b['id'] ?? null, 1, PHP_INT_MAX);
        if ($id) {
            db()->prepare('UPDATE songs SET title=?, artist=?, chords=?, bpm=?, beats=?, capo=?, ug_url=?, notes=? WHERE id=?')->execute([...$vals, $id]);
        } else {
            db()->prepare('INSERT INTO songs (title, artist, chords, bpm, beats, capo, ug_url, notes) VALUES (?,?,?,?,?,?,?,?)')->execute($vals);
            $id = (int)db()->lastInsertId();
        }
        out(['ok' => true, 'id' => $id]);
    }

    case 'song_delete': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        $id = int_or_null(body()['id'] ?? null, 1, PHP_INT_MAX) ?? fail('Mangler id.');
        db()->prepare('DELETE FROM songs WHERE id=?')->execute([$id]);
        out(['ok' => true]);
    }

    }
}
