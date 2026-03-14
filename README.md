# Mission Control

Operational console and webhook handler for outbound/inbound messaging workflows.

## Quick start

```bash
cd /Users/terminal/.openclaw/workspace/mission-control
npm install
cp .env.example .env.local
npm run dev
```

- Secure default bind: `127.0.0.1:3000`
- LAN testing (opt-in): `npm run dev:lan`

## Scripts

- `npm run dev` — Next.js dev server on localhost
- `npm run dev:lan` — Next.js dev server on all interfaces (temporary testing)
- `npm run build` — production build
- `npm run start` — production server
- `npm run worker:outbound` — outbound engine worker loop
- `npm run healthcheck` — verifies `GET /api/health` responds with `ok=true`
- `npm run queue:health` — validates durable queue health (`jobs` table)
- `npm run deadletter:summary` — prints consolidated dead-letter incident summary
- `npm run report:generate -- --type <security-daily|ops-morning|ops-evening>` — deterministic one-line report generation with delta narrative (`baseline-created` / `no-significant-changes` / field diffs)
- `npm run report:enqueue -- ...` — enqueue critical report dispatch into durable queue
- `npm run queue:cleanup` — prune old queue/idempotency rows + vacuum (weekly hygiene)

Routing toggle (no cron edits): update `scripts/route-config.json` for primary/fallback destination changes.
Low-AI monitor (`scripts/monitor-queue.sh`) includes alert dedupe and SLO breach checks.

## Health endpoint

`GET /api/health`

Example:

```json
{
  "ok": true,
  "service": "mission-control",
  "timestamp": "2026-03-01T16:00:00.000Z",
  "store": "sqlite",
  "environment": "development",
  "version": "0.1.0"
}
```

## Environment

Use `.env.example` as your template. Key variables:

- `OUTBOUND_STORE` (`sqlite` | `postgres` | `noop`)
- `OUTBOUND_SQLITE_PATH`
- `DATABASE_URL` (required when `OUTBOUND_STORE=postgres`)
- `OUTBOUND_ACCOUNT_BY_TO`
- `OUTBOUND_ESCALATION_WEBHOOK_URL`
- `OUTBOUND_ESCALATION_CHANNEL` / `OUTBOUND_ESCALATION_TARGET`
- `MISSION_CONTROL_URL` (for healthcheck script)

## Operations

See `RUNBOOK.md` for start/stop, smoke tests, and troubleshooting.

Low-AI monitoring is handled by launchd (`com.missioncontrol.queue-monitor`) rather than hourly AI cron checks.

Security Chief model:
- All routine report outputs are ingested to `state/security-chief-inbox.jsonl`.
- AI is used for two high-value reviews only:
  - daily `security-chief-review`
  - weekly `security-chief-weekly-review`
- User alerts are emitted by Security Chief only when concerns are material.
