<?php
// Upload helpers for api.php (kept separate so api.php itself stays small and simple).

function upload_error(int $code): string {
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Filen er større enn serverens grense (maks ' . ini_get('upload_max_filesize') . ').',
        UPLOAD_ERR_PARTIAL => 'Opplastingen ble avbrutt – prøv igjen.',
        UPLOAD_ERR_NO_FILE => 'Fant ingen fil i opplastingen.',
        UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'Serveren klarte ikke å mellomlagre filen.',
        default => 'Opplastingen feilet (kode ' . $code . ').',
    };
}

/** Recognises common audio formats from their first bytes (when finfo is unsure). */
function sniff_audio(string $path): ?string {
    $h = (string)@file_get_contents($path, false, null, 0, 16);
    if (strlen($h) < 12) return null;
    if (str_starts_with($h, 'ID3')) return 'mp3';
    if (ord($h[0]) === 0xFF && (ord($h[1]) & 0xE0) === 0xE0) return 'mp3'; // MPEG audio frame sync
    if (substr($h, 4, 4) === 'ftyp') return 'm4a';
    if (str_starts_with($h, 'RIFF') && substr($h, 8, 4) === 'WAVE') return 'wav';
    if (str_starts_with($h, 'OggS')) return 'ogg';
    if (str_starts_with($h, 'fLaC')) return 'flac';
    return null;
}

/** Diagnostics for the admin page: the server's upload limits. */
function upload_limits(): array {
    return [
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size'),
        'max_execution_time' => ini_get('max_execution_time'),
    ];
}

/** A request bigger than post_max_size arrives with empty $_POST/$_FILES – say so clearly. */
function check_request_size(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return;
    if (!empty($_POST) || !empty($_FILES)) return;
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) <= 0) return;
    if (str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) return;
    fail('Filen er større enn serverens grense (maks ' . ini_get('post_max_size') . ' per opplasting).', 413);
}
