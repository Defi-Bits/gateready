#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const INBOX = join(ROOT, 'state', 'security-chief-inbox.jsonl');
const DB = join(ROOT, 'state', 'security-chief.db');

function readJsonl(path) { try { return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)); } catch { return []; } }
function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

function classify(msg='', severity='info') {
  const m = String(msg).toLowerCase();
  if (m.includes('dead-letter') || m.includes('dead jobs')) return { event_type: 'queue_dead_letter', confidence: 0.9 };
  if (m.includes('failed authentication') || m.includes('auth failed')) return { event_type: 'auth_failure', confidence: 0.95 };
  if (m.includes('config') && m.includes('changed')) return { event_type: 'config_drift', confidence: 0.8 };
  if (m.includes('openclaw') && m.includes('not found')) return { event_type: 'runtime_integrity', confidence: 0.7 };
  if (severity === 'critical') return { event_type: 'critical_signal', confidence: 0.85 };
  if (severity === 'warn') return { event_type: 'warning_signal', confidence: 0.7 };
  return { event_type: 'info_signal', confidence: 0.5 };
}

const rows = readJsonl(INBOX).slice(-500);
const db = new DatabaseSync(DB);
const ins = db.prepare(`INSERT INTO security_events (id, ts, source, event_type, severity, confidence, details_json, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const seenStmt = db.prepare(`SELECT 1 FROM security_events WHERE dedupe_key=? LIMIT 1`);

let inserted = 0;
for (const r of rows) {
  const c = classify(r.message, r.severity);
  const dedupe = `${r.source}|${r.severity}|${String(r.message || '').slice(0, 160)}`;
  if (seenStmt.get(dedupe)) continue;
  ins.run(
    uid('se'),
    r.ts || new Date().toISOString(),
    r.source || 'unknown',
    c.event_type,
    r.severity || 'info',
    c.confidence,
    JSON.stringify({ message: r.message || '' }),
    dedupe
  );
  inserted++;
}
console.log(JSON.stringify({ ok: true, inserted }));
