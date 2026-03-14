PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS suppression (
  phone TEXT NOT NULL,
  account_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  suppressed_at TEXT NOT NULL,
  PRIMARY KEY (phone, account_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_membership (
  membership_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL,
  next_touch_at TEXT,
  last_touch_at TEXT,
  touch_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_membership_phone ON campaign_membership(account_id, lead_phone);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  run_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  locked_at TEXT,
  locked_by TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  idempotency_key TEXT NOT NULL,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_at);

CREATE TABLE IF NOT EXISTS idempotency (
  idempotency_key TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  result_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_message (
  message_sid TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  membership_id TEXT,
  to_phone TEXT,
  status TEXT NOT NULL,
  body TEXT,
  template_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_message_account ON outbound_message(account_id, created_at);
