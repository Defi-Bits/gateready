#!/usr/bin/env node
import { mkdirSync, readFileSync, copyFileSync, appendFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const MEDIA_ROOT = join(ROOT, 'state', 'summit-media');
const INDEX = join(ROOT, 'state', 'summit-media-index.jsonl');
const REVIEW_Q = join(ROOT, 'state', 'summit-media-review.jsonl');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function uid(p='sm'){ return `${p}_${Math.random().toString(36).slice(2,10)}`; }

const source = arg('source','');
const jobId = arg('jobId','');
const stage = arg('stage','after'); // before|during|after
const serviceType = arg('serviceType','');
const addressZone = arg('zone','');
const crew = arg('crew','');
const notes = arg('notes','');

if (!source || !jobId) {
  console.error(JSON.stringify({ ok:false, error:'source_and_jobId_required', usage:'--source <path> --jobId <id>' }, null, 2));
  process.exit(1);
}

mkdirSync(MEDIA_ROOT, { recursive:true });
const ext = extname(source) || '.jpg';
const ts = new Date().toISOString();
const day = ts.slice(0,10);
const outDir = join(MEDIA_ROOT, day, jobId);
mkdirSync(outDir, { recursive:true });

const mediaId = uid('media');
const outName = `${stage}_${mediaId}${ext}`;
const outPath = join(outDir, outName);
copyFileSync(source, outPath);

const rec = {
  ts,
  mediaId,
  jobId,
  venture: 'summit',
  stage,
  sourceFile: source,
  storedPath: outPath,
  filename: basename(outPath),
  serviceType,
  addressZone,
  crew,
  notes,
  status: 'ingested',
  publishState: 'drafted',
  websiteReady: false,
  privacyChecked: false,
  tags: ['summit', stage].filter(Boolean),
};

appendFileSync(INDEX, JSON.stringify(rec) + '\n');
appendFileSync(REVIEW_Q, JSON.stringify({
  ts,
  queueId: uid('mq'),
  mediaId,
  jobId,
  action: 'review_for_library_and_site',
  status: 'pending',
}) + '\n');

console.log(JSON.stringify({ ok:true, mediaId, jobId, storedPath: outPath, index: INDEX, queue: REVIEW_Q }, null, 2));
