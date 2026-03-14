#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT='/Users/terminal/.openclaw/workspace/mission-control';
const driftFile = join(ROOT,'config','content-routing.json');

function run(cmd){ return execSync(cmd,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
function ingest(source,severity,message){ run(`npm run -s chief:ingest -- --source ${source} --severity ${severity} --message ${JSON.stringify(message)}`); }

const original = readFileSync(driftFile,'utf8');

try {
  ingest('fire-drill','warn','auth failed burst detected from 10.0.0.1 (simulated)');
  ingest('fire-drill','critical','dead-letter queue spike detected (simulated)');

  writeFileSync(driftFile, original + '\n');
  run('npm run -s chief:drift');
  writeFileSync(driftFile, original);

  run('npm run -s chief:v2:init');
  run('npm run -s chief:v2:ingest');
  run('npm run -s chief:v2:threats');
  run('npm run -s chief:v2:actions');
  const report = run('npm run -s chief:v2:report');

  console.log(JSON.stringify({ok:true, drill:'completed', report: JSON.parse(report)}, null, 2));
} catch (e){
  try { writeFileSync(driftFile, original); } catch {}
  console.error(String(e?.message || e));
  process.exit(1);
}
