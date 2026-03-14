#!/usr/bin/env node
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = join(ROOT, 'state', 'security-chief.db');
const db = new DatabaseSync(DB, { readOnly: true });

const sev = db.prepare(`SELECT severity, COUNT(*) c FROM security_events WHERE datetime(ts) >= datetime('now','-7 days') GROUP BY severity`).all();
const top = db.prepare(`SELECT event_type, COUNT(*) c FROM security_events WHERE datetime(ts) >= datetime('now','-7 days') GROUP BY event_type ORDER BY c DESC LIMIT 5`).all();
const risks = db.prepare(`SELECT scenario, residual_risk, detection_coverage, recommended_action FROM threat_hypotheses ORDER BY ts DESC LIMIT 5`).all();

console.log(JSON.stringify({
  ok: true,
  window: '7d',
  severity_counts: sev,
  top_signals: top,
  top_risks: risks
}, null, 2));
