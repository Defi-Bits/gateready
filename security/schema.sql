CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  details_json TEXT,
  dedupe_key TEXT,
  acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS threat_hypotheses (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  scenario TEXT NOT NULL,
  attack_path TEXT NOT NULL,
  impacted_assets TEXT,
  controls_present TEXT,
  detection_coverage REAL DEFAULT 0.0,
  residual_risk TEXT,
  recommended_action TEXT
);

CREATE TABLE IF NOT EXISTS security_controls (
  id TEXT PRIMARY KEY,
  control_name TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence TEXT,
  last_checked TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS remediation_tasks (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  owner TEXT DEFAULT 'Security Chief',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT,
  source_risk TEXT,
  last_updated TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_ts ON security_events(ts);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_threat_hypotheses_ts ON threat_hypotheses(ts);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_status ON remediation_tasks(status);
