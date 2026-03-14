#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const CFG = '/Users/terminal/.openclaw/workspace/shared-core/policies/content-review/champion-challenger.json';

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJson(path,fallback={}){ try{return JSON.parse(readFileSync(path,'utf8'));}catch{return fallback;} }

const venture = arg('venture','');
if (!venture){ console.error('venture required'); process.exit(1); }
const platform = arg('platform','x');
const limit = Number(arg('limit','20'));

const cfg = readJson(CFG, {});
const vCfg = cfg?.ventures?.[venture] || {};
const active = vCfg.active || cfg?.default?.active || 'champion';
const challenger = active === 'champion' ? 'challenger' : 'champion';

const runOne = (label) => {
  const cmd = `node scripts/content-review-intel.mjs --platform ${platform} --venture ${venture} --limit ${limit} --dryRun true --promptProfile ${label}`;
  const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', shell: '/bin/zsh' });
  return JSON.parse(out);
};

const activeRes = runOne(active);
const challengerRes = runOne(challenger);

const result = {
  ts: new Date().toISOString(),
  venture,
  platform,
  active,
  challenger,
  activeRes,
  challengerRes,
  recommendation: 'keep_active',
};

if ((challengerRes?.summary?.approve || 0) > (activeRes?.summary?.approve || 0)) {
  result.recommendation = 'test_promote_challenger';
}

const outPath = join(ROOT, 'state', `content-review-challenger-${venture}.json`);
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ok:true, outPath, recommendation: result.recommendation}, null, 2));
