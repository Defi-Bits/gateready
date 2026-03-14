#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const CFG = join(ROOT, 'config', 'security-critical-files.json');
const SEV = join(ROOT, 'config', 'security-file-severity.json');
const BASELINE = join(ROOT, 'state', 'security-config-baseline.json');

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }
function hashFile(path) { try { return createHash('sha256').update(readFileSync(path)).digest('hex'); } catch { return null; } }

function ingest(severity, message) {
  const safe = JSON.stringify(message);
  execSync(`npm run -s chief:ingest -- --source config-drift --severity ${severity} --message ${safe}`, { cwd: ROOT, stdio: 'ignore' });
}

const cfg = readJson(CFG, { files: [] });
const sevCfg = readJson(SEV, { default: 'warn', files: {} });
const prev = readJson(BASELINE, { files: {} });
const next = { updated_at: new Date().toISOString(), files: {} };
const changes = [];

for (const file of cfg.files || []) {
  const digest = hashFile(file);
  const exists = existsSync(file);
  const old = prev.files?.[file] || null;
  next.files[file] = { hash: digest, exists, checked_at: new Date().toISOString() };

  if (!old) continue;
  if (old.exists !== exists) {
    changes.push({ file, kind: 'existence', from: old.exists, to: exists });
    continue;
  }
  if (old.hash !== digest) {
    changes.push({ file, kind: 'hash', from: old.hash, to: digest });
  }
}

mkdirSync(dirname(BASELINE), { recursive: true });
writeFileSync(BASELINE, JSON.stringify(next, null, 2));

if (!prev.files || Object.keys(prev.files).length === 0) {
  console.log(JSON.stringify({ ok: true, baseline_created: true, tracked: (cfg.files || []).length }));
  process.exit(0);
}

if (!changes.length) {
  console.log(JSON.stringify({ ok: true, drift: false, tracked: (cfg.files || []).length }));
  process.exit(0);
}

for (const c of changes) {
  const severity = sevCfg.files?.[c.file] || sevCfg.default || 'warn';
  const msg = `config drift detected: ${c.file} (${c.kind})`;
  try { ingest(severity, msg); } catch {}
}

console.log(JSON.stringify({ ok: true, drift: true, changes }));
