<?php
// Translation of the text on the site. The site is written in Norwegian; the browser sends the sentences it
// shows and gets them back in the visitor's language. Every sentence is translated ONCE and kept in the database,
// so the service is only asked about new text (the translator can be Claude or Google Translate – whichever key is
// in _translate.php, made by translate-setup.sh).

const TR_MAX_TEXTS = 40;
const TR_MAX_LEN = 600;
const TR_MAX_TOTAL = 8000;
function tr_cfg(): ?array {
    static $cfg = false;
    if ($cfg === false) {
        $f = __DIR__ . '/_translate.php';
        $c = is_file($f) ? include $f : null;
        $cfg = is_array($c) && !empty($c['key']) && !empty($c['provider']) ? $c : null;
    }
    return $cfg;
}

function tr_table(): void {
    static $done = false;
    if ($done) return;
    db()->exec('CREATE TABLE IF NOT EXISTS translations (k CHAR(40) NOT NULL, lang VARCHAR(8) NOT NULL, out_text TEXT NOT NULL, t INT UNSIGNED NOT NULL, PRIMARY KEY (k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $done = true;
}
function tr_key(string $lang, string $text): string { return sha1($lang . "\0" . $text); }

/** Asks the translator for several sentences at once. Returns the translations in the same order, or null on failure. */
function tr_call(string $lang, array $texts): ?array {
    $cfg = tr_cfg();
    if (!$cfg) return null;
    $name = $GLOBALS['tr_lang_name'] ?? $lang;
    if ($cfg['provider'] === 'google') {
        $body = http_build_query(['q' => $texts, 'source' => 'no', 'target' => $lang === 'zh-TW' ? 'zh-TW' : $lang, 'format' => 'text', 'key' => $cfg['key']]);
        // http_build_query numbers array keys (q[0]=…); Google wants q=…&q=… – build it by hand
        $parts = [];
        foreach ($texts as $t) $parts[] = 'q=' . rawurlencode($t);
        $body = implode('&', $parts) . '&source=no&format=text&target=' . rawurlencode($lang) . '&key=' . rawurlencode($cfg['key']);
        [$s, $res] = http_req('POST', 'https://translation.googleapis.com/language/translate/v2', ['Content-Type: application/x-www-form-urlencoded'], $body);
        if ($s !== 200) return null;
        $j = json_decode($res, true);
        $out = [];
        foreach ($j['data']['translations'] ?? [] as $x) $out[] = html_entity_decode((string)($x['translatedText'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return count($out) === count($texts) ? $out : null;
    }
    if ($cfg['provider'] === 'anthropic') {
        $prompt = "Translate the user interface text of a personal hobby website (guitars, books, travel, music, Japanese study, gaming, coding) from Norwegian to {$name}.\n"
            . "Rules: keep the tone short and friendly; keep names of people, songs, albums, bands, games, products, code, URLs, emoji and the placeholders {0} {1} … exactly as they are; keep punctuation style; do not add explanations.\n"
            . "Answer with ONLY a JSON array of strings, the same length and order as the input.\n\nInput:\n" . json_encode($texts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $payload = json_encode(['model' => $cfg['model'] ?? 'claude-haiku-4-5-20251001', 'max_tokens' => 4096, 'messages' => [['role' => 'user', 'content' => $prompt]]], JSON_UNESCAPED_UNICODE);
        [$s, $res] = http_req('POST', 'https://api.anthropic.com/v1/messages', ['x-api-key: ' . $cfg['key'], 'anthropic-version: 2023-06-01', 'content-type: application/json'], $payload);
        if ($s !== 200) { error_log('niben translate: Anthropic ' . $s . ' ' . substr($res, 0, 200)); return null; }
        $j = json_decode($res, true);
        $txt = trim((string)($j['content'][0]['text'] ?? ''));
        if (preg_match('~\[.*\]~s', $txt, $m)) $txt = $m[0];
        $arr = json_decode($txt, true);
        if (!is_array($arr) || count($arr) !== count($texts)) return null;
        return array_map(fn($x) => is_string($x) ? $x : '', $arr);
    }
    return null;
}

function tr_handle(): void {
    require_once __DIR__ . '/_guard.inc.php';
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Bruk POST.', 405);
    if (($_SERVER['HTTP_X_NIBEN'] ?? '') !== '1') fail('Ugyldig forespørsel.', 400);
    $b = json_decode((string)file_get_contents('php://input'), true);
    $lang = (string)($b['lang'] ?? '');
    $texts = $b['texts'] ?? null;
    // any language code is fine (en, nb, zh-TW, haw …); the client also tells its English name, which is only used as a hint for the translator
    if (!preg_match('~^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$~', $lang) || $lang === 'nb' || $lang === 'no' || !is_array($texts) || !$texts || count($texts) > TR_MAX_TEXTS) fail('Ugyldig forespørsel.', 400);
    $total = 0;
    foreach ($texts as $t) {
        if (!is_string($t) || $t === '' || mb_strlen($t) > TR_MAX_LEN) fail('Ugyldig tekst.', 400);
        $total += mb_strlen($t);
    }
    if ($total > TR_MAX_TOTAL) fail('For mye tekst.', 400);
    $texts = array_values($texts);
    $GLOBALS['tr_lang_name'] = preg_match('~^[\p{L}\p{M} ()\-]{2,60}$~u', (string)($b['name'] ?? '')) ? (string)$b['name'] : $lang;
    if (!tr_cfg()) out(['texts' => null, 'error' => 'not_configured'], 503);

    tr_table();
    $keys = array_map(fn($t) => tr_key($lang, $t), $texts);
    $in = implode(',', array_fill(0, count($keys), '?'));
    $st = db()->prepare("SELECT k, out_text FROM translations WHERE k IN ($in)");
    $st->execute($keys);
    $have = [];
    foreach ($st->fetchAll() as $r) $have[$r['k']] = $r['out_text'];

    $missing = [];
    foreach ($texts as $i => $t) if (!isset($have[$keys[$i]])) $missing[$i] = $t;
    if ($missing) {
        // only new text costs anything – and that is limited per visitor and per day
        if (!is_admin()) {
            rl_or_fail('tr:' . client_ip(), 40, 60, 'For mange oversettelser – vent litt.');
            rl_or_fail('trday:' . client_ip(), 1500, 86400, 'For mange oversettelser i dag.');
        }
        $res = tr_call($lang, array_values($missing));
        if ($res === null) fail('Oversettelsen feilet. Prøv igjen senere.', 502);
        $ins = db()->prepare('REPLACE INTO translations (k, lang, out_text, t) VALUES (?, ?, ?, ?)');
        $j = 0;
        foreach ($missing as $i => $t) {
            $o = trim($res[$j++] ?? '');
            if ($o === '') $o = $t;
            $have[$keys[$i]] = $o;
            $ins->execute([$keys[$i], $lang, $o, time()]);
        }
    }
    out(['texts' => array_map(fn($k) => $have[$k], $keys)]);
}
