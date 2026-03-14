#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const INDEX = join(ROOT, 'state', 'summit-media-index.jsonl');
const OUT = join(ROOT, 'state', 'summit-media-site-feed.json');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }

const limit = Number(arg('limit','200'));
const requirePrivacy = arg('requirePrivacy','true') !== 'false';
const requireWebsiteReady = arg('requireWebsiteReady','true') !== 'false';

const rows = readJsonl(INDEX)
  .filter(r => r.venture === 'summit')
  .filter(r => !requirePrivacy || r.privacyChecked === true)
  .filter(r => !requireWebsiteReady || r.websiteReady === true)
  .slice(-limit)
  .reverse();

const grouped = {};
for (const r of rows) {
  const key = String(r.jobId || 'unknown');
  if (!grouped[key]) grouped[key] = { jobId: key, serviceType: r.serviceType || '', zone: r.addressZone || '', items: [] };
  grouped[key].items.push({
    mediaId: r.mediaId,
    stage: r.stage,
    storedPath: r.storedPath,
    filename: r.filename,
    ts: r.ts,
    notes: r.notes || '',
    tags: r.tags || [],
  });
}

const out = {
  ts: new Date().toISOString(),
  venture: 'summit',
  exported: rows.length,
  jobs: Object.values(grouped),
};

mkdirSync(join(ROOT, 'state'), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok:true, outPath: OUT, exported: rows.length, jobs: out.jobs.length }, null, 2));
