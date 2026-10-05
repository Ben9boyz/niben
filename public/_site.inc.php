<?php
// The site's .htaccess (security headers, compression, caching, no access to the _*.php files).
// The web host's FTP won't take a .htaccess, so the server writes it itself – once per version, on a
// page load. It is tried in a test folder first, and after switching it on the front page and the API
// must still answer; otherwise the old file is put back.

const HT_VERSION = '2026-10-06-1';
const HT_RULES = <<<'HT'
# niben.no – security and speed (Apache 2.4)

Options -Indexes

# config, keys and include files: only PHP reads them, never a browser
<FilesMatch "^(_.+\.php|\.user\.ini|\.htaccess)$">
  Require all denied
</FilesMatch>

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), geolocation=(), microphone=(self)"
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set Content-Security-Policy "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
  Header always unset X-Powered-By
  Header unset X-Powered-By

  # the app's own files have a hash in the name: keep them for a year
  <FilesMatch "^.+-[A-Za-z0-9_-]{6,}\.js$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  # models, pictures and fonts: a week (uploads get new names when they change)
  <FilesMatch "\.(glb|png|jpe?g|webp|svg|ico|woff2?|wasm)$">
    Header set Cache-Control "public, max-age=604800, stale-while-revalidate=86400"
  </FilesMatch>
  # the page itself and the service worker: always check for a new version
  <FilesMatch "^(index\.html|sw\.js|manifest\.json|data\.json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>

# compress text (JavaScript ~3 MB → ~0.8 MB)
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript text/javascript application/json image/svg+xml model/gltf-binary application/wasm font/ttf
</IfModule>
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/css application/javascript text/javascript application/json image/svg+xml model/gltf-binary application/wasm
</IfModule>
HT;

function site_ensure_htaccess(): void {
    if (kv_get('htaccess_v') === HT_VERSION) return;
    // one attempt at a time, and not more than once every 10 minutes if it fails
    if ((int)kv_get('htaccess_try') > time() - 600) return;
    kv_set('htaccess_try', (string)time());

    $base = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'niben.no');
    $ok = fn(string $url, array $codes) => in_array(http_req('GET', $url . (str_contains($url, '?') ? '&' : '?') . 'ht=' . time())[0], $codes, true);

    // 1) the rules on their own in a test folder
    $dir = __DIR__ . '/ht-check';
    @mkdir($dir, 0755);
    file_put_contents($dir . '/ok.txt', 'ok');
    file_put_contents($dir . '/_secret.php', '<?php echo "x";');
    file_put_contents($dir . '/.htaccess', HT_RULES);
    $good = $ok("$base/ht-check/ok.txt", [200]) && $ok("$base/ht-check/_secret.php", [403]);
    @unlink($dir . '/.htaccess'); @unlink($dir . '/ok.txt'); @unlink($dir . '/_secret.php'); @rmdir($dir);
    if (!$good) { error_log('niben: .htaccess test failed'); return; }

    // 2) switch it on for the site, then make sure the page and the API still answer
    $file = __DIR__ . '/.htaccess';
    $old = is_file($file) ? file_get_contents($file) : null;
    file_put_contents($file, HT_RULES);
    if ($ok("$base/", [200]) && $ok("$base/api.php?action=about_get", [200])) {
        kv_set('htaccess_v', HT_VERSION);
        return;
    }
    // 3) something broke: put the old one back
    if ($old === null) @unlink($file); else file_put_contents($file, $old);
    error_log('niben: .htaccess rolled back');
}
