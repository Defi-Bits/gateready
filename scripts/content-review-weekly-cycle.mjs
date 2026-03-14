#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const WORKSPACE = '/Users/terminal/.openclaw/workspace';
const VENTURES_PATH = join(WORKSPACE, 'shared-core', 'strategy', 'venture-profiles.json');

function readJson(path, fallback = {}) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }

const ventures = Object.keys(readJson(VENTURES_PATH, {}));
const results = [];

for (const venture of ventures) {
  const row = { venture, challenger: null, weekly: null };
  try {
    row.challenger = JSON.parse(execSync(`node scripts/content-review-challenger.mjs --venture ${venture} --platform x --limit 20`, {
      cwd: ROOT, encoding: 'utf8', shell: '/bin/zsh', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (e) {
    row.challenger = { ok: false, error: String(e?.message || e) };
  }

  try {
    row.weekly = JSON.parse(execSync(`node scripts/content-review-weekly-report.mjs --venture ${venture} --days 7`, {
      cwd: ROOT, encoding: 'utf8', shell: '/bin/zsh', stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (e) {
    row.weekly = { ok: false, error: String(e?.message || e) };
  }

  results.push(row);
}

const out = {
  ts: new Date().toISOString(),
  ventures: results,
  ok: results.every((r) => r.challenger?.ok && r.weekly?.ok),
};
mkdirSync(join(ROOT, 'state'), { recursive: true });
writeFileSync(join(ROOT, 'state', 'content-review-weekly-cycle.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: out.ok, ventures: results.length, path: 'state/content-review-weekly-cycle.json' }, null, 2));
