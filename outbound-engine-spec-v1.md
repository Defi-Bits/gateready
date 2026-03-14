# Outbound Engine Spec (Kwasi / OpenClaw OS)

## Purpose
Run a durable, restart-safe outbound engine reusable across multiple businesses/accounts with deterministic event-driven coordination (no internal natural language), strict compliance, deliverability protection, and fast escalation to Kwasi.

## Primary Goal
Execute large-scale cold outreach campaigns (SMS first, optional voice later) with:
1. Micro-campaign testing (500–1000 leads per micro-campaign)
2. Strict compliance controls (STOP/wrong number suppression, frequency caps, audit logs)
3. Deliverability protection (template rotation, throttling, autopause on risk signals)
4. Fast escalation to Kwasi on hot intent
5. Restart-safe scheduling (durable jobs with leases + idempotency)
6. Minimal token usage (no LLM for outbound cadence; LLM only for inbound ambiguity + hot lead briefs)

## Non-Negotiable Safety / Compliance
- Honor opt-out requests immediately (STOP/UNSUBSCRIBE/DO NOT CONTACT equivalents).
- Suppress wrong numbers immediately.
- Enforce frequency caps per lead and per number pool.
- Maintain audit logs for outbound, inbound, suppression, consent/opt-out signals.
- Threat/legal/severe anger: no improvisation; escalate to Kwasi and draft minimal polite response.
- Never attempt to bypass carrier filtering/compliance.

## Multi-Business Accounts
Every action ties to exactly one account.
Per-account config includes:
- template library
- cadence definition (steps/timing)
- send windows
- frequency caps
- escalation thresholds
- scoring rules
- number pool / messaging service IDs

### Default Accounts
- WHOLESALE: high-volume cold outbound; escalate hot replies to Kwasi
- AGENCY: lower volume, higher qualification threshold
- SUMMIT: local services; prioritize speed-to-lead, booking, follow-up
- EDGE: research/content hooks (not required in outbound engine v1)

## Architecture

### A) State Objects
1. Lead(lead_id, account_id, name?, phone, tags, attributes, created_at)
2. Conversation(conversation_id, lead_id, account_id, channel, last_inbound_at, last_outbound_at, last_messages, status, notes)
3. Campaign(campaign_id, account_id, name, segment_definition, start_at, status, template_set_id, metrics)
4. CampaignMembership(membership_id, lead_id, campaign_id, account_id, step_index, mode, next_touch_at, last_touch_at, touch_count, intent_label, intent_score)
5. Suppression(phone, account_id?|global, reason, suppressed_at)
6. Job(job_id, job_type, run_at, payload_json, status, locked_at, locked_by, attempts, max_attempts, idempotency_key, last_error)
7. Idempotency(idempotency_key, status, result_ref, created_at)

### B) Event Types
- LeadImported
- CampaignCreated
- MembershipEnrolled
- TouchDue
- OutboundSendRequested
- OutboundSent
- OutboundFailed
- InboundReceived
- IntentScored
- MembershipAdvanced
- AutomationPaused
- EscalationRequested
- OwnerNotified
- Suppressed
- ComplianceFlagged
- MetricsComputed
- CampaignAutopaused

### C) Command Types
- SendSMS(account_id, to_phone, from_pool, template_id, slots, idempotency_key)
- LogMessage(direction, content, metadata)
- Suppress(phone, reason)
- PauseMembership(membership_id, reason)
- NotifyOwner(account_id, lead_id, summary, urgency)
- AdvanceCadence(membership_id)

## Token Efficiency Policy
- Outbound cadence = templates + slot fill + variant rotation (NO LLM).
- LLM only for:
  1) inbound intent classification when rules uncertain
  2) compact field extraction (call me / offer / timeline)
  3) very short conversation-mode drafts (1–2 sentences)
  4) hot lead brief generation for Kwasi
- Minimize LLM context: last inbound, last outbound, compact membership JSON, allowed_actions enum.
- Prefer local inference for low risk if available.

## Deliverability + Risk
- Micro-campaign size: 500–1000 leads.
- Step variant rotation: 5–10 variants/step.
- Throttle by account + number pool + send windows.
- Autopause when stop-rate, negative sentiment, or deliverability degrade beyond thresholds.

### Catch-up After Downtime
- <6h: continue
- 6–48h: skip to soft bump step
- >48h: pause + rescore/restart with check-in template

## Restart-Safe Execution
- Jobs are source of truth.
- Workers claim due PENDING jobs with atomic lease updates.
- Reclaim stale RUNNING jobs after lease timeout.
- All side effects idempotent via idempotency_key checks.
- Startup Reconciler:
  - release stale locks
  - enqueue overdue TouchDue with catch-up policy
  - verify suppressions applied

## Twilio Transport Layer
- Outbound via Twilio Messaging Service / number pool.
- Inbound webhooks:
  - /twilio/sms/inbound
  - /twilio/sms/status
- Convert inbound to InboundReceived events for triage.

## Reply Triage (Rules First)
1) STOP/UNSUBSCRIBE/DNC -> suppress(stop), optional confirmation, pause
2) Wrong number -> suppress(wrong_number), pause
3) Intent classify:
   - HOT: offer/price/call/willingness/engaged identity ask
   - WARM: maybe/not now/process questions
   - COLD: not interested (without opt-out)
   - ANGRY/LEGAL: threats/complaints/legal keywords
4) Actions:
   - HOT: pause automation + notify Kwasi immediately + optional holding text
   - WARM: conversation mode + at most one qualifier
   - COLD: softer cadence + fewer touches
   - ANGRY/LEGAL: pause + notify + minimal polite response draft

## Escalation Brief Format
Include:
- lead phone (+name if known)
- property/address if known
- last inbound message
- campaign + step
- intent + confidence
- suggested next message
- one-line call opener
- extracted constraints (timeline/price)

## Per-Account Plug-and-Play Config
- allowed_send_windows (timezone)
- daily_send_cap
- per_number_cap
- cadence_steps [{delay_hours, template_ids[], rules}]
- template_library (+variants + slot requirements)
- autopause_thresholds
- escalation_thresholds
- confirmation_policy (opt-out confirmation)

## Output Contract (when implementing/operating)
Always output structured actions:
- exact job/event/state transitions
- selected templates/variants
- enqueues
- pauses
- notifications and rationale
No vague advice.

## Default Operation Mode (WHOLESALE v1)
- Enroll leads into micro-campaigns
- Send Step 0 SMS
- Schedule next touches
- Triage inbound with minimal tokens
- Escalate hot leads to Kwasi
- Autopause poor micro-campaigns
- Keep execution restart-safe
