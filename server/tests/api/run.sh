#!/usr/bin/env bash
# Runs every API test suite against the TEST Supabase project. Each suite starts from
# freshly seeded demo data. Needs the backend running: `npm run dev:test` (port 3001).
set -u
cd "$(dirname "$0")/../.."
curl -sf -o /dev/null "${API_URL:-http://localhost:3001/api}/../health" || { echo "Backend not running on :3001 (start it with: npm run dev:test)"; exit 1; }
status=0
for t in tests/api/test_*.py; do
  npm run --silent seed:demo > /dev/null || { echo "Seeding failed"; exit 1; }
  printf '%s: ' "$(basename "$t")"
  python3 -I "$t" | grep -E '^FAIL|passed' || status=1
  [ "${PIPESTATUS[0]}" -eq 0 ] || status=1
done
npm run --silent seed:demo > /dev/null
exit $status
