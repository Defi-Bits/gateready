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
  try {
    const out = execSync(`node scripts/content-review-intel.mjs --platform x --venture ${venture} --limit 20`, {
      cwd: ROOT,
      encoding: 'utf8',
      shell: '/bin/zsh',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out);
    results.push({ venture, ok: true, summary: parsed.summary || {}, reviewed: parsed.reviewed || 0 });
  } catch (e) {
    results.push({ venture, ok: false, error: String(e?.message || e) });
  }
}

const summary = {
  ts: new Date().toISOString(),
  ventures: results,
  ok: results.every((r) => r.ok),
};

mkdirSync(join(ROOT, 'state'), { recursive: true });
mkdirSync(join(WORKSPACE, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'state', 'content-review-daily-summary.json'), JSON.stringify(summary, null, 2));

const md = ['# Content Review Daily Summary', `Generated: ${summary.ts}`, ''];
for (const r of results) {
  if (r.ok) md.push(`- ${r.venture}: reviewed ${r.reviewed} | ${JSON.stringify(r.summary)}`);
  else md.push(`- ${r.venture}: FAILED | ${r.error}`);
}
writeFileSync(join(WORKSPACE, 'reports', 'CONTENT_REVIEW_DAILY_SUMMARY.md'), md.join('\n'));

console.log(JSON.stringify({ ok: summary.ok, ventures: results.length, path: 'state/content-review-daily-summary.json' }, null, 2));
