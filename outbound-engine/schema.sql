-- Outbound Engine v1 relational schema (PostgreSQL)
-- Durable jobs + idempotency + compliance-safe outreach

create table if not exists accounts (
  account_id text primary key,
  name text not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table if not exists leads (
  lead_id uuid primary key,
  account_id text not null references accounts(account_id),
  name text,
  phone text not null,
  tags jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(account_id, phone)
);

create table if not exists campaigns (
  campaign_id uuid primary key,
  account_id text not null references accounts(account_id),
  name text not null,
  segment_definition jsonb not null,
  start_at timestamptz,
  status text not null check (status in ('active','paused','done')),
  template_set_id text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  conversation_id uuid primary key,
  lead_id uuid not null references leads(lead_id),
  account_id text not null references accounts(account_id),
  channel text not null check (channel in ('sms','voice','email')),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_messages jsonb not null default '[]'::jsonb,
  status text not null check (status in ('active','closed')),
  notes text,
  created_at timestamptz not null default now(),
  unique(lead_id, account_id, channel)
);

create table if not exists campaign_memberships (
  membership_id uuid primary key,
  lead_id uuid not null references leads(lead_id),
  campaign_id uuid not null references campaigns(campaign_id),
  account_id text not null references accounts(account_id),
  step_index int not null default 0,
  mode text not null check (mode in ('cadence','conversation','escalated','suppressed','closed')),
  next_touch_at timestamptz,
  last_touch_at timestamptz,
  touch_count int not null default 0,
  intent_label text,
  intent_score numeric(5,4),
  created_at timestamptz not null default now(),
  unique(lead_id, campaign_id)
);

create table if not exists suppressions (
  suppression_id bigserial primary key,
  phone text not null,
  account_id text references accounts(account_id),
  reason text not null check (reason in ('stop','wrong_number','dnc','manual','bounced')),
  suppressed_at timestamptz not null default now(),
  unique(phone, account_id)
);

create table if not exists jobs (
  job_id uuid primary key,
  job_type text not null,
  run_at timestamptz not null,
  payload_json jsonb not null,
  status text not null check (status in ('PENDING','RUNNING','DONE','FAILED','DEAD')),
  locked_at timestamptz,
  locked_by text,
  attempts int not null default 0,
  max_attempts int not null default 5,
  idempotency_key text not null,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_jobs_due on jobs(status, run_at);
create index if not exists idx_jobs_stale on jobs(status, locked_at);

create table if not exists idempotency (
  idempotency_key text primary key,
  status text not null check (status in ('SUCCESS','FAILED')),
  result_ref text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  audit_id bigserial primary key,
  account_id text,
  lead_id uuid,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists outbound_messages (
  message_sid text primary key,
  account_id text,
  membership_id uuid,
  to_phone text,
  status text not null,
  body text,
  template_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outbound_messages_account on outbound_messages(account_id, created_at);
create index if not exists idx_memberships_due on campaign_memberships(account_id, mode, next_touch_at);
create index if not exists idx_suppressions_phone on suppressions(phone, account_id);
