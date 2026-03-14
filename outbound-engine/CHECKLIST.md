# Outbound Engine v1 Checklist

## Completed
- [x] 1) DB schema (SQL) → `schema.sql`
- [x] 2) Event + command type definitions → `types.ts`
- [x] 3) Durable worker loop skeleton (lease + idempotency) → `worker.ts`
- [x] 4) Reply triage rules-first engine → `triage.ts`
- [x] 5) Account config templates (WHOLESALE/AGENCY/SUMMIT/EDGE) → `accounts.example.json`

## Next Implementation Steps
- [ ] Hook worker storage adapters to actual DB
- [ ] Implement Twilio SendSMS + webhook handlers
- [ ] Build campaign scheduler + membership enqueuer
- [ ] Add metrics/autopause calculator jobs
- [ ] Add escalation notifier to Kwasi channel(s)
