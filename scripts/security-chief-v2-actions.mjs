#!/usr/bin/env node
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = join(ROOT, 'state', 'security-chief.db');
function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

const db = new DatabaseSync(DB);
const latest = db.prepare(`SELECT scenario, residual_risk, recommended_action FROM threat_hypotheses ORDER BY ts DESC LIMIT 10`).all();

const findOpen = db.prepare(`SELECT id FROM remediation_tasks WHERE title=? AND status IN ('open','in_progress') LIMIT 1`);
const ins = db.prepare(`INSERT INTO remediation_tasks (id, created_at, title, description, severity, owner, status, due_at, source_risk, last_updated) VALUES (?, ?, ?, ?, ?, 'Security Chief', 'open', ?, ?, ?)`);

let created = 0;
const now = new Date();
for (const r of latest) {
  const title = `Mitigate: ${r.scenario}`;
  if (findOpen.get(title)) continue;
  const sev = r.residual_risk === 'high' ? 'critical' : r.residual_risk === 'medium' ? 'warn' : 'info';
  const due = new Date(now.getTime() + (sev === 'critical' ? 2 : 7) * 24 * 3600_000).toISOString();
  ins.run(uid('rt'), now.toISOString(), title, r.recommended_action, sev, due, r.scenario, now.toISOString());
  created++;
}

const open = db.prepare(`SELECT id,title,severity,status,due_at FROM remediation_tasks WHERE status IN ('open','in_progress') ORDER BY severity DESC, created_at DESC LIMIT 10`).all();
console.log(JSON.stringify({ ok: true, created, open }, null, 2));
