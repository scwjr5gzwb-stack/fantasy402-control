#!/usr/bin/env bash
# Triple oha runs; prints one-line summaries. Usage: benchmark-dashboard-oha.sh TAG
set -euo pipefail
TAG="${1:?tag}"
URL="${2:-http://127.0.0.1:4020/api/metrics}"
OUT="/Users/nolarose/fantasy402-skills/artifacts/dashboard-baseline"
mkdir -p "$OUT"
for i in 1 2 3; do
  F="$OUT/oha-${TAG}-run${i}.txt"
  oha -z 30s -c 50 "$URL" 2>&1 | tee "$F" >/dev/null
  p50=$(grep -E '^\s+50\.00%' "$F" | awk '{print $3}')
  p99=$(grep -E '^\s+99\.00%' "$F" | awk '{print $3}')
  sr=$(grep 'Success rate:' "$F" | awk '{print $2}')
  echo "${TAG} run${i} success=${sr} p50=${p50} p99=${p99}"
done
