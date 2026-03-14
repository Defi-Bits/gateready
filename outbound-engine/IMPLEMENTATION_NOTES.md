# Outbound Engine Wiring Notes (v1)

## Added now
- Twilio inbound webhook: `src/app/api/twilio/sms/inbound/route.ts`
- Twilio status webhook: `src/app/api/twilio/sms/status/route.ts`
- Rules-first triage runtime: `src/lib/outbound/triage.ts`
- Inbound orchestration + structured enqueue actions: `src/lib/outbound/engine.ts`
- No-op store adapter (safe local testing): `src/lib/outbound/store-noop.ts`
- Durable worker DB interface: `outbound-engine/db-adapter.ts`
- Postgres durable adapter skeleton: `outbound-engine/postgres-adapter.ts`
- Worker updated to use DB adapter: `outbound-engine/worker.ts`

## Env
- `OUTBOUND_ACCOUNT_BY_TO` maps Twilio "To" numbers to account IDs.
- `OUTBOUND_STORE=postgres|sqlite|noop` selects storage mode.
- `DATABASE_URL=postgres://...` used by Postgres adapters.
- `OUTBOUND_SQLITE_PATH=/abs/path/outbound.db` optional SQLite path.
- `OUTBOUND_ESCALATION_WEBHOOK_URL=https://...` receives escalation briefs.
- `OUTBOUND_ESCALATION_CHANNEL=telegram|webchat|discord|...` for direct OpenClaw CLI notify.
- `OUTBOUND_ESCALATION_TARGET=<chat/user id>` target for direct OpenClaw notify.
- `OPENCLAW_BIN=openclaw` optional path override.
- `OUTBOUND_PG_MODULE=pg` optional module override for PG driver import.
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` required for live sends.
- `OUTBOUND_TWILIO_MESSAGING_SERVICE_BY_ACCOUNT=WHOLESALE:MG...,AGENCY:MG...` preferred sender mapping.
- Optional fallback: `OUTBOUND_TWILIO_FROM_BY_ACCOUNT=WHOLESALE:+1...,AGENCY:+1...`.
- Optional callback: `OUTBOUND_TWILIO_STATUS_CALLBACK_URL=https://.../api/twilio/sms/status`.

Example:
`OUTBOUND_ACCOUNT_BY_TO=+18885550111:WHOLESALE,+18885550112:AGENCY`

## Current behavior
- API runtime supports `OUTBOUND_STORE=sqlite` (active v1 durable path) via `src/lib/outbound/store-sqlite.ts` + `outbound-engine/sqlite-schema.sql`.
- `OUTBOUND_STORE=noop` remains available for dry-run mode.
- Postgres adapters are scaffolded for later worker/runtime integration in `outbound-engine/*` and `src/lib/outbound/store-postgres.ts`.
- HOT/ANGRY_LEGAL escalations now fan out to:
  - webhook notifier (if configured)
  - direct OpenClaw CLI notify (if channel + target configured)
  - console fallback if neither is configured.

## Worker runner
- `outbound-engine/sqlite-adapter.ts` provides durable leases/idempotency for SQLite.
- `outbound-engine/run-worker.ts` now auto-selects adapter by `OUTBOUND_STORE` (`sqlite` default, `postgres` optional).
- Start worker locally:

```bash
npm run worker:outbound
```

## TouchDue executor (now implemented)
- Validates membership exists and is in `cadence` mode.
- Checks suppression before sending.
- Enforces send window (reschedules if outside window).
- Enforces cooldown via `last_touch_at` + `cooldownMinutes`.
- Selects deterministic template variant (`stepTemplates` or `templatePool`).
- Emits `OutboundSendRequested` audit + enqueues `OutboundSendRequested` job.
- Advances membership and enqueues next `TouchDue` until `maxSteps` reached.

## OutboundSendRequested executor (now implemented)
- Reads queued send payload (`accountId`, `membershipId`, `toPhone`, `templateId`, optional `body`).
- Sends via Twilio REST API using account-specific messaging service or from-number mapping.
- Records message SID in `outbound_message` / `outbound_messages` for status correlation.
- Emits `OutboundSent` or `OutboundFailed` audit events.

## Next step
Implement catch-up policy in `enqueueOverdueTouchesWithCatchup(...)` and add richer template rendering/body composition.
