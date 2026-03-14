#!/bin/zsh
set -euo pipefail

ROOT="/Users/terminal/.openclaw/workspace/mission-control"
export PATH="/Users/terminal/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ALERT_STATE_DIR="$ROOT/state/alerts"
ALERT_TTL_MINUTES="${ALERT_TTL_MINUTES:-30}"
SLO_MAX_STALE_PENDING="${SLO_MAX_STALE_PENDING:-0}"
SLO_MAX_STALE_RUNNING="${SLO_MAX_STALE_RUNNING:-0}"
SLO_MAX_DEAD="${SLO_MAX_DEAD:-0}"
SLO_MAX_CRITICAL_DEAD="${SLO_MAX_CRITICAL_DEAD:-0}"

mkdir -p "$ALERT_STATE_DIR" "$ROOT/logs" "$ROOT/state"
cd "$ROOT"

send_to_chief() {
  local severity="$1"
  local source="$2"
  local msg="$3"
  npm run -s chief:ingest -- --source "$source" --severity "$severity" --message "$msg" >/dev/null
}

should_send() {
  local key="$1"
  local digest
  digest="$(printf '%s' "$key" | shasum | awk '{print $1}')"
  local stamp_file="$ALERT_STATE_DIR/$digest.ts"
  local now
  now="$(date +%s)"

  if [[ -f "$stamp_file" ]]; then
    local prev
    prev="$(cat "$stamp_file" 2>/dev/null || echo 0)"
    local age=$((now - prev))
    if (( age < ALERT_TTL_MINUTES * 60 )); then
      return 1
    fi
  fi

  echo "$now" > "$stamp_file"
  return 0
}

append_metrics_jsonl() {
  local json="$1"
  printf '%s\n' "$json" >> "$ROOT/logs/queue-health.jsonl"
}

QUEUE_OUT="$(npm run -s queue:health 2>&1 || true)"

# capture metrics JSON from PASS/FAIL line
QH_JSON="$(printf '%s\n' "$QUEUE_OUT" | sed -n 's/^\[queue-health\] \(PASS\|FAIL\) //p' | tail -n1)"
if [[ -n "$QH_JSON" ]]; then
  append_metrics_jsonl "$QH_JSON"
fi

STALE_PENDING=0
STALE_RUNNING=0
DEAD=0
CRITICAL_DEAD=0
if [[ -n "$QH_JSON" ]]; then
  STALE_PENDING="$(node -e "const o=JSON.parse(process.argv[1]);console.log(o.counts?.stalePending ?? 0)" "$QH_JSON")"
  STALE_RUNNING="$(node -e "const o=JSON.parse(process.argv[1]);console.log(o.counts?.staleRunning ?? 0)" "$QH_JSON")"
  DEAD="$(node -e "const o=JSON.parse(process.argv[1]);console.log(o.counts?.dead ?? 0)" "$QH_JSON")"
  CRITICAL_DEAD="$(node -e "const o=JSON.parse(process.argv[1]);console.log(o.counts?.criticalDead ?? 0)" "$QH_JSON")"
fi

SLO_BREACH="false"
if (( STALE_PENDING > SLO_MAX_STALE_PENDING )) || (( STALE_RUNNING > SLO_MAX_STALE_RUNNING )) || (( DEAD > SLO_MAX_DEAD )) || (( CRITICAL_DEAD > SLO_MAX_CRITICAL_DEAD )); then
  SLO_BREACH="true"
fi

if [[ "$QUEUE_OUT" == *"[queue-health] FAIL"* ]] || [[ "$SLO_BREACH" == "true" ]]; then
  ALERT_KEY="queue-health|$STALE_PENDING|$STALE_RUNNING|$DEAD|$CRITICAL_DEAD|$SLO_BREACH"
  if should_send "$ALERT_KEY"; then
    send_to_chief "warn" "queue-health" "queue-health issue (slo_breach=$SLO_BREACH) stalePending=$STALE_PENDING staleRunning=$STALE_RUNNING dead=$DEAD criticalDead=$CRITICAL_DEAD | $QUEUE_OUT"
  fi
fi

# dead-letter summary: use stdout only (ignore noisy stderr warnings)
DEAD_OUT="$(npm run -s deadletter:summary 2>/dev/null || true)"
DEAD_OUT="$(printf '%s' "$DEAD_OUT" | tr -d '\r' | sed '/^\s*$/d')"
if [[ -n "$DEAD_OUT" && "$DEAD_OUT" != "NO_DEAD_LETTERS" ]]; then
  ALERT_KEY="dead-letter|$DEAD_OUT"
  if should_send "$ALERT_KEY"; then
    send_to_chief "critical" "dead-letter" "$DEAD_OUT"
  fi
fi

# weekly Sunday 03:10 ET-ish cleanup trigger (safe if run multiple times)
DOW="$(date +%u)"
HM="$(date +%H%M)"
if [[ "$DOW" == "7" && "$HM" > "0305" && "$HM" < "0320" ]]; then
  npm run -s queue:cleanup >/dev/null 2>&1 || true
fi
