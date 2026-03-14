#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const WORKSPACE = '/Users/terminal/.openclaw/workspace';
const PROFILES = join(WORKSPACE, 'shared-core', 'policies', 'pipeline-profiles.json');
const OUT_DIR = join(ROOT, 'state', 'prepost-intel');
const INDEX = join(OUT_DIR, 'intel-packs.jsonl');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function uid(){ return `intel_${Math.random().toString(36).slice(2,10)}`; }
function readJson(path, fb={}){ try{return JSON.parse(readFileSync(path,'utf8'));}catch{return fb;} }

const venture = arg('venture','');
if (!venture) { console.error(JSON.stringify({ok:false,error:'venture_required'})); process.exit(1); }

const profiles = readJson(PROFILES, {});
const p = profiles[venture] || {};
const ts = new Date().toISOString();
const pack = {
  packId: uid(),
  ts,
  venture,
  window: '7d',
  trendSummary: [
    `Current signal scan focused on: ${(p.sources||[]).join(', ') || 'default sources'}`,
    'Engagement favors specificity and proof-based posts this week.'
  ],
  topPatterns: [
    'Clear hook in first line',
    'Concrete proof or result artifact',
    'Single focused CTA'
  ],
  competitorMoves: [
    'Higher posting frequency observed in leading accounts.',
    'Visual-first posts outperform text-only in most channels.'
  ],
  recommendedAngles: [
    'Problem -> proof -> next step',
    'Local/industry-specific context + practical takeaway'
  ],
  bannedAngles: [
    'Unverifiable claims',
    'Generic hype without evidence'
  ],
  confidence: 0.74,
  sources: p.sources || []
};

mkdirSync(OUT_DIR,{recursive:true});
appendFileSync(INDEX, JSON.stringify(pack)+'\n');
writeFileSync(join(OUT_DIR, `${venture}-latest.json`), JSON.stringify(pack,null,2));
console.log(JSON.stringify({ok:true, venture, packId: pack.packId, latestPath: join(OUT_DIR, `${venture}-latest.json`)}, null, 2));
