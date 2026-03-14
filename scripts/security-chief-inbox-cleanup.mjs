#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const INBOX = join(ROOT, 'state', 'security-chief-inbox.jsonl');
const ARCH = join(ROOT, 'state', 'security-chief-inbox.archive.jsonl');
const KEEP_HOURS = Number(process.env.SECURITY_CHIEF_KEEP_HOURS || 72);
const cutoff = Date.now() - KEEP_HOURS * 3600_000;

function readJsonl(p){
  try { return readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)); }
  catch { return []; }
}

const all = readJsonl(INBOX);
const keep=[]; const archive=[];
for (const e of all){
  const ts = new Date(e.ts || 0).getTime();
  const msg = String(e.message || '');
  const noisy = /NO_DEAD_LETTERS|ExperimentalWarning: SQLite is an experimental feature/i.test(msg);
  if (noisy || !Number.isFinite(ts) || ts < cutoff) archive.push(e); else keep.push(e);
}
mkdirSync(dirname(INBOX), {recursive:true});
if (archive.length){
  mkdirSync(dirname(ARCH), {recursive:true});
  const existing = readJsonl(ARCH);
  writeFileSync(ARCH, [...existing, ...archive].map(x=>JSON.stringify(x)).join('\n') + '\n');
}
writeFileSync(INBOX, keep.map(x=>JSON.stringify(x)).join('\n') + (keep.length?'\n':''));
console.log(JSON.stringify({ok:true, kept:keep.length, archived:archive.length, keepHours:KEEP_HOURS}));
