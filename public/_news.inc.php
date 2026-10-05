<?php
// Newsletter about new recordings: sign up with an e-mail (double opt-in: a confirmation link is mailed first),
// I write / send a mail from Admin → Nyhetsbrev, and everybody can leave with one click (link in every mail).
// Only the e-mail address and the dates are stored. There is also an Atom feed of the recordings (action=feed).

function nw_table(): void {
    db()->exec('CREATE TABLE IF NOT EXISTS subscribers (id INT UNSIGNED NOT NULL AUTO_INCREMENT, email VARCHAR(190) NOT NULL, token CHAR(32) NOT NULL, confirmed TINYINT(1) NOT NULL DEFAULT 0, created INT UNSIGNED NOT NULL, confirmed_at INT UNSIGNED NULL, last_mail INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (id), UNIQUE KEY uq_email (email), KEY idx_token (token)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}
function nw_host(): string { return preg_replace('~^www\.~', '', strtolower((string)($_SERVER['HTTP_HOST'] ?? 'niben.no'))); }
function nw_base(): string {
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api.php'))), '/');
    return ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'niben.no') . $dir;
}
function nw_esc(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function nw_mail(string $to, string $subject, string $text, string $unsubUrl = ''): bool {
    $from = 'noreply@' . nw_host();
    $b = 'nb' . bin2hex(random_bytes(8));
    $footer = $unsubUrl !== '' ? "\n\n—\nMeld deg av: " . $unsubUrl : '';
    $plain = $text . $footer;
    $html = '<div style="font:16px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2433;max-width:560px;margin:0 auto;padding:18px">'
        . nl2br(preg_replace('~(https?://[^\s<]+)~', '<a href="$1" style="color:#2b7fff">$1</a>', nw_esc($text)))
        . ($unsubUrl !== '' ? '<p style="margin-top:28px;font-size:12px;color:#8a93a3">Du får denne fordi du meldte deg på på ' . nw_esc(nw_host()) . '. <a href="' . nw_esc($unsubUrl) . '" style="color:#8a93a3">Meld deg av</a>.</p>' : '')
        . '</div>';
    $headers = [
        'From: ' . nw_host() . ' <' . $from . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $b . '"',
    ];
    if ($unsubUrl !== '') { $headers[] = 'List-Unsubscribe: <' . $unsubUrl . '>'; $headers[] = 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'; }
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($plain))
        . "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html))
        . "--$b--";
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers), '-f' . $from);
}

function nw_page(string $title, string $msg): never {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $home = nw_base();
    $home = preg_replace('~/[^/]*$~', '', $home) === $home ? $home : $home;
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . nw_esc($title) . '</title>'
        . '<body style="font:18px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#eef3f9;color:#1d2433;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px">'
        . '<div style="max-width:440px;background:#fff;padding:32px;border-radius:22px;box-shadow:0 18px 50px rgba(30,60,120,.18);text-align:center"><h1 style="margin:0 0 10px;font-size:1.4rem">' . nw_esc($title) . '</h1><p style="margin:0 0 20px;color:#556">' . nw_esc($msg) . '</p><a href="' . nw_esc($home) . '/" style="color:#2b7fff;font-weight:600">Til ' . nw_esc(nw_host()) . '</a></div>';
    exit;
}

function nw_handle(string $action, bool $post): void {
    switch ($action) {
    case 'news_subscribe': {
        if (!$post) fail('Bruk POST.', 405);
        $b = body();
        if (!empty($b['website'])) out(['ok' => true]); // honeypot: bots fill in every field
        rl_or_fail('news:' . client_ip(), 6, 3600, 'For mange forsøk – prøv igjen senere.');
        $email = strtolower(trim((string)($b['email'] ?? '')));
        if (strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Det ser ikke ut som en e-postadresse.');
        nw_table();
        $st = db()->prepare('SELECT id, token, confirmed, last_mail FROM subscribers WHERE email = ?');
        $st->execute([$email]);
        $row = $st->fetch();
        if ($row && (int)$row['confirmed'] === 1) out(['ok' => true]); // already in – say nothing more (don't leak who is subscribed)
        if ($row && (int)$row['last_mail'] > time() - 600) out(['ok' => true]);
        $token = $row ? $row['token'] : bin2hex(random_bytes(16));
        if (!$row) db()->prepare('INSERT INTO subscribers (email, token, confirmed, created) VALUES (?, ?, 0, ?)')->execute([$email, $token, time()]);
        db()->prepare('UPDATE subscribers SET last_mail = ? WHERE email = ?')->execute([time(), $email]);
        $url = nw_base() . '/api.php?action=news_confirm&t=' . $token;
        $ok = nw_mail($email, 'Bekreft påmeldingen til ' . nw_host(), "Hei!\n\nTrykk på lenka for å bekrefte at du vil ha en e-post når jeg legger ut nye gitaropptak:\n\n" . $url . "\n\nHvis du ikke har meldt deg på, kan du bare ignorere denne.");
        if (!$ok) { error_log('niben news: mail() failed'); fail('Klarte ikke å sende e-posten akkurat nå. Prøv igjen senere.', 502); }
        out(['ok' => true]);
    }
    case 'news_confirm': {
        $t = (string)($_GET['t'] ?? '');
        if (!preg_match('~^[a-f0-9]{32}$~', $t)) nw_page('Ugyldig lenke', 'Den lenka ser ikke riktig ut.');
        nw_table();
        $st = db()->prepare('UPDATE subscribers SET confirmed = 1, confirmed_at = ? WHERE token = ?');
        $st->execute([time(), $t]);
        $st2 = db()->prepare('SELECT COUNT(*) FROM subscribers WHERE token = ?'); $st2->execute([$t]);
        if ((int)$st2->fetchColumn() === 0) nw_page('Fant ikke påmeldingen', 'Kanskje du allerede har meldt deg av?');
        nw_page('Du er påmeldt ✔', 'Takk! Du får en e-post når det kommer et nytt opptak.');
    }
    case 'news_unsub': {
        $t = (string)($_GET['t'] ?? '');
        if (!preg_match('~^[a-f0-9]{32}$~', $t)) nw_page('Ugyldig lenke', 'Den lenka ser ikke riktig ut.');
        nw_table();
        db()->prepare('DELETE FROM subscribers WHERE token = ?')->execute([$t]);
        nw_page('Du er meldt av', 'Adressen din er slettet. Ingen flere e-poster.');
    }
    case 'news_admin': {
        require_admin();
        nw_table();
        $conf = (int)db()->query('SELECT COUNT(*) FROM subscribers WHERE confirmed = 1')->fetchColumn();
        $pend = (int)db()->query('SELECT COUNT(*) FROM subscribers WHERE confirmed = 0')->fetchColumn();
        $list = db()->query('SELECT id, email, confirmed, created FROM subscribers ORDER BY created DESC LIMIT 60')->fetchAll();
        out(['confirmed' => $conf, 'pending' => $pend, 'list' => $list, 'last' => json_decode((string)kv_get('news_last'), true)]);
    }
    case 'news_remove': {
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        nw_table();
        db()->prepare('DELETE FROM subscribers WHERE id = ?')->execute([(int)(body()['id'] ?? 0)]);
        out(['ok' => true]);
    }
    case 'news_send': {
        // { subject, body, to? } – with "to" only that address gets it (a test); otherwise everybody confirmed
        if (!$post) fail('Bruk POST.', 405);
        require_admin();
        @set_time_limit(120);
        $b = body();
        $subject = mb_substr(trim((string)($b['subject'] ?? '')), 0, 150);
        $text = trim((string)($b['body'] ?? ''));
        if ($subject === '' || $text === '') fail('Skriv både emne og tekst.');
        nw_table();
        $to = strtolower(trim((string)($b['to'] ?? '')));
        if ($to !== '') {
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) fail('Ugyldig testadresse.');
            if (!nw_mail($to, $subject, $text, nw_base() . '/api.php?action=news_unsub&t=' . str_repeat('0', 32))) fail('Klarte ikke å sende testen.', 502);
            out(['ok' => true, 'sent' => 1, 'test' => true]);
        }
        $rows = db()->query('SELECT email, token FROM subscribers WHERE confirmed = 1 LIMIT 400')->fetchAll();
        $sent = 0; $failed = 0;
        foreach ($rows as $r) {
            if (nw_mail($r['email'], $subject, $text, nw_base() . '/api.php?action=news_unsub&t=' . $r['token'])) $sent++; else $failed++;
            usleep(60000);
        }
        kv_set('news_last', json_encode(['t' => time(), 'subject' => $subject, 'sent' => $sent, 'failed' => $failed], JSON_UNESCAPED_UNICODE));
        out(['ok' => true, 'sent' => $sent, 'failed' => $failed]);
    }
    case 'feed': {
        // Atom feed of the guitar recordings (for a feed reader)
        $rows = db()->query('SELECT id, guitar, title, recorded_on, youtube, audio_path, notes, created_at FROM recordings ORDER BY COALESCE(recorded_on, created_at) DESC, id DESC LIMIT 25')->fetchAll();
        $base = preg_replace('~/[^/]*$~', '', nw_base()) ?: nw_base();
        $site = rtrim(nw_base(), '/');
        header('Content-Type: application/atom+xml; charset=utf-8');
        header('Cache-Control: public, max-age=900');
        $x = fn($s) => htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $upd = fn($r) => date('c', strtotime((string)($r['recorded_on'] ?: $r['created_at'])) ?: time());
        echo '<?xml version="1.0" encoding="utf-8"?>' . "\n" . '<feed xmlns="http://www.w3.org/2005/Atom">';
        echo '<title>' . $x(nw_host() . ' – gitaropptak') . '</title><id>' . $x($site . '/') . '</id><link href="' . $x($site . '/') . '"/><link rel="self" href="' . $x($site . '/api.php?action=feed') . '"/>';
        echo '<updated>' . ($rows ? $upd($rows[0]) : date('c')) . '</updated>';
        foreach ($rows as $r) {
            $link = $site . '/#/gitar';
            echo '<entry><title>' . $x($r['title']) . '</title><id>' . $x($site . '/#opptak-' . $r['id']) . '</id><updated>' . $upd($r) . '</updated><link href="' . $x($link) . '"/>';
            if (!empty($r['notes'])) echo '<summary>' . $x($r['notes']) . '</summary>';
            if (!empty($r['audio_path'])) echo '<link rel="enclosure" href="' . $x($site . '/' . ltrim($r['audio_path'], '/')) . '" type="audio/mpeg"/>';
            echo '</entry>';
        }
        echo '</feed>';
        exit;
    }
    }
}
