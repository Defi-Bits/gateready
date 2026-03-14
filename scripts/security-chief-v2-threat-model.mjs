#!/usr/bin/env node
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = join(ROOT, 'state', 'security-chief.db');
function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

const db = new DatabaseSync(DB);
const counts = db.prepare(`SELECT event_type, COUNT(*) c FROM security_events WHERE datetime(ts) >= datetime('now', '-7 days') GROUP BY event_type`).all();
const map = Object.fromEntries(counts.map(x => [x.event_type, Number(x.c)]));

const hypotheses = [
  {
    scenario: 'Credential abuse against messaging/publishing path',
    attack_path: 'stolen token -> unauthorized message sends -> reputation damage',
    impacted_assets: 'telegram channel, brand trust',
    controls_present: 'manual relay mode, identity guard, channel routing controls',
    detection_coverage: map.auth_failure ? 0.8 : 0.55,
    residual_risk: 'medium',
    recommended_action: 'rotate bot tokens quarterly; enforce allowlisted destinations'
  },
  {
    scenario: 'Automation queue poisoning or replay',
    attack_path: 'malformed jobs/events -> dead letters/retries -> alert fatigue or delivery gaps',
    impacted_assets: 'outbound queue, incident reporting',
    controls_present: 'queue health checks, dead-letter summary, dedupe TTL',
    detection_coverage: map.queue_dead_letter ? 0.9 : 0.65,
    residual_risk: 'medium',
    recommended_action: 'add strict schema validation and signed event provenance'
  },
  {
    scenario: 'Silent config drift',
    attack_path: 'config change -> weaker controls -> unnoticed exposure',
    impacted_assets: 'mission-control policies, gateway posture',
    controls_present: 'security chief inbox + audit checks',
    detection_coverage: map.config_drift ? 0.75 : 0.5,
    residual_risk: 'high',
    recommended_action: 'hash/monitor critical config files and alert on change'
  }
];

const ins = db.prepare(`INSERT INTO threat_hypotheses (id, ts, scenario, attack_path, impacted_assets, controls_present, detection_coverage, residual_risk, recommended_action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const now = new Date().toISOString();
for (const h of hypotheses) {
  ins.run(uid('th'), now, h.scenario, h.attack_path, h.impacted_assets, h.controls_present, h.detection_coverage, h.residual_risk, h.recommended_action);
}

const latest = db.prepare(`SELECT scenario, residual_risk, detection_coverage, recommended_action FROM threat_hypotheses ORDER BY ts DESC LIMIT 3`).all();
console.log(JSON.stringify({ ok: true, hypotheses_added: hypotheses.length, latest }, null, 2));
