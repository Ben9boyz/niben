#!/bin/bash
# Captures the golden pictures (see golden.mjs): NIBEN_GOLDEN_OUT=/tmp/before ./tests/e2e/run-golden.sh
set -e
cd "$(dirname "$0")/../.."
source tests/lib/test-server.sh
VITE_PID=""
cleanup() { [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true; stop_test_server; }
trap cleanup EXIT
VITE_PORT=$((40000 + RANDOM % 10000))
NIBEN_API="http://127.0.0.1:$PORT" npx vite --port "$VITE_PORT" --host 127.0.0.1 --strictPort >"$DIR/vite.log" 2>&1 &
VITE_PID=$!
for _ in $(seq 1 100); do curl -s -o /dev/null "http://127.0.0.1:$VITE_PORT/" && break; sleep 0.2; done
export NIBEN_APP="http://127.0.0.1:$VITE_PORT"
node tests/e2e/golden.mjs capture
