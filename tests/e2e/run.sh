#!/bin/bash
# Browser tests: the real front end (vite dev server) in a real Chromium, talking to the test server.
# NIBEN_CHROMIUM=/path/to/chrome overrides the browser Playwright would use.
set -e
cd "$(dirname "$0")/../.."
source tests/lib/test-server.sh
VITE_PID=""
cleanup() { [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true; stop_test_server; }
trap cleanup EXIT
VITE_PORT="${NIBEN_VITE_PORT:-$((40000 + RANDOM % 10000))}"
NIBEN_API_TARGET="http://127.0.0.1:$PORT"
NIBEN_API="$NIBEN_API_TARGET" npx vite --port "$VITE_PORT" --host 127.0.0.1 --strictPort >"$DIR/vite.log" 2>&1 &
VITE_PID=$!
for _ in $(seq 1 100); do curl -s -o /dev/null "http://127.0.0.1:$VITE_PORT/" && break; sleep 0.2; done
export NIBEN_API="$NIBEN_API_TARGET/api.php" NIBEN_APP="http://127.0.0.1:$VITE_PORT"
node --test --test-concurrency=1 tests/e2e/*.test.mjs
