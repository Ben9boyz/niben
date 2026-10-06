#!/bin/bash
# Sourced by the test runners: a throw-away copy of public/ served by PHP against a TEST database (emptied first, so its
# name has to contain "test"), with a fake Spotify (tests/api/net-mock.inc.php) and mail written to a file.
# Sets DIR, PORT, PHP_PID and exports NIBEN_TEST_DIR / NIBEN_API / NIBEN_OWNER_PASSWORD. Call `stop_test_server` at exit.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${NIBEN_TEST_DB:-niben_test}"
DB_HOST="${NIBEN_TEST_DB_HOST:-127.0.0.1}"
DB_USER="${NIBEN_TEST_DB_USER:-niben}"
DB_PASS="${NIBEN_TEST_DB_PASS:-nibenpw}"
case "$DB" in *test*) ;; *) echo "NIBEN_TEST_DB must contain 'test' (it is emptied): $DB" >&2; exit 1 ;; esac

DIR="$(mktemp -d)"
PHP_PID=""
stop_test_server() { [ -n "$PHP_PID" ] && kill "$PHP_PID" 2>/dev/null || true; rm -rf "$DIR"; }

cp -r "$ROOT/public/." "$DIR/"
cp "$ROOT/tests/api/net-mock.inc.php" "$DIR/_net.inc.php"
# the owner's built-in guitar model files are not in the repository any more: stand-ins, so the "copy them over to uploads" step can be tested
for f in pacifica fs820; do [ -f "$DIR/$f.glb" ] || printf 'glTF\0\0\0\0' > "$DIR/$f.glb"; done
mkdir -p "$DIR/uploads"
HASH="$(php -r 'echo password_hash("owner-secret-pw", PASSWORD_DEFAULT);')"
php -r '
$c = ["db_host" => $argv[1], "db_name" => $argv[2], "db_user" => $argv[3], "db_pass" => $argv[4], "admin_hash" => $argv[5],
      "mail_log" => $argv[6] . "/mail.log", "admin_email" => "owner@example.com", "probe_ttl" => 1];
file_put_contents($argv[6] . "/_config.php", "<?php return " . var_export($c, true) . ";");
file_put_contents($argv[6] . "/_spotify.php", "<?php return [\"client_id\" => \"a\", \"client_secret\" => \"b\"];");
' "$DB_HOST" "$DB" "$DB_USER" "$DB_PASS" "$HASH" "$DIR"
echo '{}' > "$DIR/spotify-mock.json"
: > "$DIR/mail.log"

export NIBEN_TEST_DIR="$DIR"
(cd "$ROOT" && php tests/api/db.php reset)

PORT="${NIBEN_TEST_PORT:-$((20000 + RANDOM % 20000))}"
PHP_CLI_SERVER_WORKERS=6 php ${NIBEN_PHP_ARGS:-} -S "127.0.0.1:$PORT" -t "$DIR" >"$DIR/server.log" 2>&1 &
PHP_PID=$!
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/api.php?action=me" && break; sleep 0.1; done

export NIBEN_API="http://127.0.0.1:$PORT/api.php" NIBEN_OWNER_PASSWORD="owner-secret-pw"
