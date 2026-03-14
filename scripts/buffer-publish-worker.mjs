#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const QUEUE = join(ROOT, 'state', 'buffer-publish-queue.jsonl');
const LOG = join(ROOT, 'state', 'buffer-published.jsonl');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }
function writeJsonl(path, rows){ writeFileSync(path, rows.map(r=>JSON.stringify(r)).join('\n') + (rows.length?'\n':'')); }

const max = Number(arg('max','10'));
const mode = arg('mode','dryrun'); // dryrun|live
const token = process.env.BUFFER_ACCESS_TOKEN || '';
const profilesRaw = process.env.BUFFER_PROFILE_MAP || '{}';
let profileMap = {};
try { profileMap = JSON.parse(profilesRaw); } catch {}

if (mode === 'live' && !token) {
  console.error(JSON.stringify({ ok:false, error:'missing_BUFFER_ACCESS_TOKEN' }, null, 2));
  process.exit(1);
}

const q = readJsonl(QUEUE);
const logs = readJsonl(LOG);
let processed = 0;

for (const item of q) {
  if (processed >= max) break;
  if (item.status !== 'pending') continue;

  if (!item.intelligencePackId) {
    item.status = 'failed';
    item.error = 'missing_intelligencePackId';
    item.attempts = Number(item.attempts || 0) + 1;
    continue;
  }

  const key = `${item.venture}:${item.platform}`;
  const profileId = profileMap[key] || profileMap[item.platform] || null;
  if (!profileId) {
    item.status = 'failed';
    item.error = `missing_profile_for_${key}`;
    item.attempts = Number(item.attempts || 0) + 1;
    continue;
  }

  try {
    if (mode === 'live') {
      const body = new URLSearchParams();
      body.set('text', String(item.text || '').slice(0, 280));
      body.append('profile_ids[]', String(profileId));
      body.set('now', 'true');
      body.set('access_token', token);

      const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(`buffer_api_error:${res.status}:${JSON.stringify(json).slice(0,220)}`);

      item.status = 'published';
      item.publishedAt = new Date().toISOString();
      item.bufferUpdateId = json?.updates?.[0]?.id || json?.id || null;
    } else {
      item.status = 'published_dryrun';
      item.publishedAt = new Date().toISOString();
    }

    logs.push({ ts: new Date().toISOString(), queueId: item.queueId, venture: item.venture, platform: item.platform, status: item.status, sourceRenderId: item.sourceRenderId });
  } catch (e) {
    item.status = 'failed';
    item.error = String(e?.message || e);
    item.attempts = Number(item.attempts || 0) + 1;
  }

  processed++;
}

writeJsonl(QUEUE, q);
writeJsonl(LOG, logs);
console.log(JSON.stringify({ ok:true, mode, processed, queuePath:QUEUE, logPath:LOG }, null, 2));
