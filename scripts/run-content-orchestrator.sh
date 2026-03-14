#!/bin/zsh
set -euo pipefail
ROOT="/Users/terminal/.openclaw/workspace/mission-control"
export PATH="/Users/terminal/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$ROOT"
npm run -s content:run -- --mode live >> "$ROOT/logs/content-orchestrator.out.log" 2>> "$ROOT/logs/content-orchestrator.err.log" || true
