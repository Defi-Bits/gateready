#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const INDEX = join(ROOT, 'state', 'summit-media-index.jsonl');
const REVIEW_Q = join(ROOT, 'state', 'summit-media-review.jsonl');

function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }

const limit = Number(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit')+1] : 15);
const index = readJsonl(INDEX);
const queue = readJsonl(REVIEW_Q);

const recent = index.slice(-limit).reverse();
const pending = queue.filter(q=>q.status==='pending').slice(-limit).reverse();

console.log(JSON.stringify({
  ok:true,
  indexCount:index.length,
  pendingCount:queue.filter(q=>q.status==='pending').length,
  recent,
  pending,
}, null, 2));
