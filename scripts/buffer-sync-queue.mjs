#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');
const QUEUE = join(ROOT, 'state', 'buffer-publish-queue.jsonl');
const INTEL_DIR = join(ROOT, 'state', 'prepost-intel');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }
function uid(p='bpq'){ return `${p}_${Math.random().toString(36).slice(2,10)}`; }

const venture = arg('venture','');
const platform = arg('platform','x');
const limit = Number(arg('limit','25'));
const intelligencePackId = arg('intelligencePackId','');

if (!venture) {
  console.error(JSON.stringify({ ok:false, error:'venture_required_for_intel_gate' }, null, 2));
  process.exit(1);
}

let pack = null;
if (intelligencePackId) {
  const idx = readJsonl(join(INTEL_DIR, 'intel-packs.jsonl'));
  pack = idx.find((p) => p.packId === intelligencePackId && String(p.venture||'') === venture) || null;
} else {
  const latestPath = join(INTEL_DIR, `${venture}-latest.json`);
  if (existsSync(latestPath)) {
    try { pack = JSON.parse(readFileSync(latestPath, 'utf8')); } catch {}
  }
}

if (!pack?.packId) {
  console.error(JSON.stringify({ ok:false, error:'missing_intelligence_pack', venture, hint:'Run trend-intel-generate first or pass --intelligencePackId' }, null, 2));
  process.exit(1);
}

const db = new DatabaseSync(DB, { readOnly: true });
const existing = readJsonl(QUEUE);
const existingSourceIds = new Set(existing.map(e => e.sourceRenderId));

let sql = `SELECT r.id, i.venture, r.platform, r.text_rendered, r.created_at
FROM content_renders r JOIN content_items i ON i.id=r.item_id
WHERE r.status='approved' AND r.platform=?`;
const params = [platform];
if (venture){ sql += ` AND i.venture=?`; params.push(venture); }
sql += ` ORDER BY r.created_at ASC LIMIT ?`;
params.push(limit);

const rows = db.prepare(sql).all(...params);
const now = new Date().toISOString();
const adds = [];
for (const r of rows){
  if (existingSourceIds.has(r.id)) continue;
  adds.push({
    ts: now,
    queueId: uid(),
    venture: r.venture,
    platform: r.platform,
    text: r.text_rendered,
    sourceRenderId: r.id,
    intelligencePackId: pack.packId,
    status: 'pending',
    attempts: 0,
  });
}

const merged = [...existing, ...adds];
mkdirSync(join(ROOT,'state'),{recursive:true});
writeFileSync(QUEUE, merged.map(x=>JSON.stringify(x)).join('\n') + (merged.length?'\n':''));
console.log(JSON.stringify({ ok:true, queued:adds.length, total:merged.length, queuePath:QUEUE, intelligencePackId: pack.packId }, null, 2));
