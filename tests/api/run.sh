#!/bin/bash
# API tests against the test server (see tests/lib/test-server.sh):
#   NIBEN_TEST_DB=niben_test NIBEN_TEST_DB_USER=niben NIBEN_TEST_DB_PASS=… ./tests/api/run.sh
set -e
cd "$(dirname "$0")/../.."
source tests/lib/test-server.sh
trap stop_test_server EXIT
node --test --test-concurrency=1 tests/api/*.test.mjs
