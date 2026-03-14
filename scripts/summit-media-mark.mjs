#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const INDEX = join(ROOT, 'state', 'summit-media-index.jsonl');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }

const mediaId = arg('mediaId','');
const jobId = arg('jobId','');
const websiteReadyArg = arg('websiteReady','');
const privacyCheckedArg = arg('privacyChecked','');
const flag = arg('flag','');
const publishState = arg('publishState','');
const note = arg('note','');

if (!mediaId && !jobId) {
  console.error(JSON.stringify({ ok:false, error:'mediaId_or_jobId_required' }, null, 2));
  process.exit(1);
}

const rows = readJsonl(INDEX);
let changed = 0;
const ts = new Date().toISOString();

const next = rows.map((r) => {
  const match = mediaId ? r.mediaId === mediaId : r.jobId === jobId;
  if (!match) return r;

  const out = { ...r };
  if (websiteReadyArg) out.websiteReady = websiteReadyArg === 'true';
  if (privacyCheckedArg) out.privacyChecked = privacyCheckedArg === 'true';
  if (flag) out.flag = flag;
  if (publishState) out.publishState = publishState;
  if (websiteReadyArg === 'true') out.publishState = out.publishState || 'approved';
  if (note) out.notes = [String(r.notes || '').trim(), note].filter(Boolean).join(' | ');
  out.updatedAt = ts;
  changed++;
  return out;
});

writeFileSync(INDEX, next.map((r) => JSON.stringify(r)).join('\n') + (next.length ? '\n' : ''));
console.log(JSON.stringify({ ok:true, changed, mediaId: mediaId || null, jobId: jobId || null }, null, 2));
