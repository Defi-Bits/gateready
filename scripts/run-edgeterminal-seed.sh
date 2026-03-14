#!/bin/zsh
set -euo pipefail
ROOT="/Users/terminal/.openclaw/workspace/mission-control"
export PATH="/Users/terminal/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$ROOT"
npm run -s edgeterminal:seed >> "$ROOT/logs/edgeterminal-seed.out.log" 2>> "$ROOT/logs/edgeterminal-seed.err.log" || true
