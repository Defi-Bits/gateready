# Critical Reporting (3 Priority Reports)

This system uses **cron for scheduling** and a **durable queue for guaranteed delivery**.

## Why

Cron alone can miss or drop value during partial outages (provider down, network issues, process restart).
A durable queue gives retry, idempotency, and dead-letter visibility.

## Architecture

1. Cron trigger (`openclaw cron`) runs at scheduled windows.
2. Trigger enqueues a report dispatch job into `jobs` (durable DB).
3. Worker claims due jobs and attempts delivery.
4. On failure, worker retries with backoff and fallback channel route.
5. After max attempts, job moves to `DEAD` and creates an escalation event.

## Critical report classes

1. **security-daily** (09:00 ET)
2. **ops-morning** (08:30 ET)
3. **ops-evening** (18:00 ET)

Each report has:
- `reportType`
- `severity` (critical|warn|info)
- `primaryChannel`
- `fallbackChannels[]`
- `idempotencyKey`

## Delivery policy

- Attempt 1: primary channel
- Attempt 2+: fallback channels in order
- Exponential backoff: 2m, 5m, 15m, 30m, 60m
- Max attempts: 6
- If exhausted: mark `DEAD` + emit escalation summary

## Idempotency

Use key format:

`report:{reportType}:{windowStartIso}`

A successful key is never sent again, even if duplicate enqueue events occur.

## Outage behavior

If delivery path is down:
- queue retains jobs
- retries continue on schedule
- once delivery recovers, send latest pending report + optional condensed catch-up summary

## DB fields required (already supported by jobs table)

- `job_type`
- `run_at`
- `status` (PENDING|RUNNING|DONE|FAILED|DEAD)
- `attempts`
- `max_attempts`
- `idempotency_key`
- `last_error`

## Recommended worker jobs

- `CriticalReportDispatch` (deliver report)
- `CriticalReportEscalate` (dead-letter alert)

## OpenClaw cron role

Cron should only **enqueue** report jobs, not perform final delivery directly.
This preserves guarantees when a provider is unavailable.

## Implementation checklist

- [x] Add report-dispatch worker handler
- [x] Add fallback channel routing policy in env/config
- [x] Add dead-letter escalation handler
- [ ] Add queue health monitor (stale pending/dead counts)
- [ ] Add dashboard view for pending/failed/dead report jobs
- [x] Add producer script to enqueue critical dispatch jobs (`npm run report:enqueue`)
