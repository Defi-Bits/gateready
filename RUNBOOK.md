# Mission Control Runbook

## 1) Start (local dev, secure default)

```bash
cd /Users/terminal/.openclaw/workspace/mission-control
npm install
cp .env.example .env.local   # fill only what you need
npm run dev
```

Default dev bind is localhost (`127.0.0.1:3000`).
For temporary LAN testing:

```bash
npm run dev:lan
```

## 2) Start outbound worker

In a separate terminal:

```bash
cd /Users/terminal/.openclaw/workspace/mission-control
npm run worker:outbound
```

## 3) Health checks

App health endpoint:

```bash
curl -s http://127.0.0.1:3000/api/health
```

One-command pass/fail check:

```bash
npm run healthcheck
```

Queue health (durable jobs):

```bash
npm run queue:health
```

Optional thresholds:

```bash
QUEUE_HEALTH_STALE_PENDING_MINUTES=20 QUEUE_HEALTH_STALE_RUNNING_MINUTES=15 npm run queue:health
```

Dead-letter summary (for alert payload):

```bash
npm run deadletter:summary
```

Optional window:

```bash
DEAD_LETTER_LOOKBACK_HOURS=48 npm run deadletter:summary
```

## 4) Verify network exposure

```bash
/usr/sbin/lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Expected secure default:
- `127.0.0.1:3000` (not `*:3000`)

## 5) Twilio webhook smoke test

Inbound route:

```bash
curl -i -X POST http://127.0.0.1:3000/api/twilio/sms/inbound \
  -d 'From=+15551234567' \
  -d 'To=+18885550111' \
  -d 'Body=hello'
```

Status callback route:

```bash
curl -i -X POST http://127.0.0.1:3000/api/twilio/sms/status \
  -d 'MessageSid=SM123' \
  -d 'MessageStatus=delivered' \
  -d 'To=+18885550111' \
  -d 'From=+15551234567'
```

## 6) Shutdown

- Stop `npm run dev` and `npm run worker:outbound` with `Ctrl+C`

## 7) Critical report queue model

- Scheduling: OpenClaw cron triggers report creation windows
- Delivery guarantee: outbound-engine durable `jobs` queue
- Retry/fallback policy: see `outbound-engine/critical-report-policy.example.json`
- Architecture + implementation checklist: `docs/CRITICAL_REPORTING.md`

Generate deterministic report text with delta narrative:

```bash
npm run -s report:generate -- --type security-daily
```

Notes:
- Script stores last snapshot per report type in `state/report-baseline.json`.
- Output includes `delta=...` so periodic reviews quickly show changes.

Enqueue a critical report dispatch job:

```bash
npm run report:enqueue -- \
  --reportType security-daily \
  --severity critical \
  --message "Daily security: no significant changes." \
  --primaryChannel webchat \
  --primaryTarget "<target>" \
  --fallbackChannels telegram \
  --fallbackTargets "<target>"
```

Then worker sends/retries/escalates:

```bash
npm run worker:outbound
```

## 8) Low-AI monitor daemon (launchd)

OpenClaw cron checks for queue/dead-letter were disabled to reduce AI usage.
Monitoring now runs via launchd every 30 minutes:

- Agent label: `com.missioncontrol.queue-monitor`
- Script: `scripts/monitor-queue.sh`
- Plist: `deploy/com.missioncontrol.queue-monitor.plist`

Install / reload:

```bash
cp deploy/com.missioncontrol.queue-monitor.plist ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.missioncontrol.queue-monitor.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.missioncontrol.queue-monitor.plist
launchctl enable gui/$(id -u)/com.missioncontrol.queue-monitor
launchctl kickstart -k gui/$(id -u)/com.missioncontrol.queue-monitor
```

Inspect status:

```bash
launchctl print gui/$(id -u)/com.missioncontrol.queue-monitor
```

SLO + dedupe knobs (env vars consumed by monitor script):
- `ALERT_TTL_MINUTES` (default 30)
- `SLO_MAX_STALE_PENDING` (default 0)
- `SLO_MAX_STALE_RUNNING` (default 0)
- `SLO_MAX_DEAD` (default 0)
- `SLO_MAX_CRITICAL_DEAD` (default 0)

Routing toggle:
- Edit `scripts/route-config.json` to switch primary/fallback channels/targets globally.

Security Chief intake:

```bash
npm run -s chief:ingest -- --source <name> --severity <info|warn|critical> --message "..."
```

Inbox path:
- `state/security-chief-inbox.jsonl`

Weekly hygiene:

```bash
npm run queue:cleanup
```

## 9) Troubleshooting quick hits

1. `healthcheck` fails
   - Confirm app is running on port 3000
   - Confirm `MISSION_CONTROL_URL` if custom URL/port
2. Webhooks 500
   - Confirm env variables are set as needed (`OUTBOUND_STORE`, mappings)
3. Port exposed to LAN unexpectedly
   - Ensure you used `npm run dev`, not `npm run dev:lan`
4. Critical reports delayed/missed
   - Check worker process is running (`npm run worker:outbound`)
   - Check queue depth/status in DB (`jobs` table)
   - Verify channel/provider outages before forcing retries
