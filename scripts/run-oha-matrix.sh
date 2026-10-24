#!/usr/bin/env bash
# Restart dashboard from a given server file, run 3× oha, print summaries.
set -euo pipefail
TAG="$1"
SERVER_JS="${2:-scripts/dashboard-server.js}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/Users/nolarose/fantasy402-skills/artifacts/dashboard-baseline"
mkdir -p "$OUT"

kill_port() {
  lsof -ti :4020 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 0.8
}

kill_port
cd "$ROOT"
bun --env-file=.env.local "$SERVER_JS" &
sleep 1.2
if ! curl -sS -o /dev/null --max-time 3 http://127.0.0.1:4020/health; then
  echo "FAIL dashboard did not start for $TAG" >&2
  exit 1
fi

for i in 1 2 3; do
  F="$OUT/oha-${TAG}-run${i}.txt"
  oha -z 30s -c 50 http://127.0.0.1:4020/api/metrics 2>&1 | tee "$F" >/dev/null
  p50=$(grep -E '^\s+50\.00%' "$F" | awk '{print $3}')
  p99=$(grep -E '^\s+99\.00%' "$F" | awk '{print $3}')
  sr=$(grep 'Success rate:' "$F" | awk '{print $2}')
  echo "${TAG} run${i} success=${sr} p50=${p50} p99=${p99}"
done

kill_port
