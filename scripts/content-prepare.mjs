#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const QUEUE = join(ROOT, 'state', 'content-queue.jsonl');
const DB_PATH = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');
const PROFILES = join(ROOT, 'config', 'platform-profiles.json');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
function readJson(path, fallback = {}) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }
function uid(prefix){ return `${prefix}_${Math.random().toString(36).slice(2,10)}`; }

const venture = arg('venture', '');
const platform = arg('platform', 'x').toLowerCase();
const max = Number(arg('max', '10'));
const sourceType = arg('sourceType', 'site_growth_pack');

const profiles = readJson(PROFILES, {});
const profile = profiles[platform] || profiles.telegram || { maxChars: 4000, maxHashtags: 2, style: 'clear' };

const queue = readJsonl(QUEUE)
  .filter(x => !venture || x.venture === venture)
  .filter(x => !sourceType || x.type === sourceType)
  .slice(-50)
  .reverse();

if (!queue.length) {
  console.log(JSON.stringify({ ok: true, prepared: 0, reason: 'no_queue_items' }));
  process.exit(0);
}

const db = new DatabaseSync(DB_PATH);

const insertItem = db.prepare(`INSERT INTO content_items
  (id, created_at, venture, source_type, source_ref, source_hash, content_type, text_raw, status, tags_json, cta, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`);

const insertRender = db.prepare(`INSERT INTO content_renders
  (id, item_id, platform, format_profile, text_rendered, status, created_at)
  VALUES (?, ?, ?, ?, ?, 'draft', ?)`);

const findRender = db.prepare(`SELECT id FROM content_renders WHERE item_id=? AND platform=? LIMIT 1`);
const findItem = db.prepare(`SELECT id FROM content_items WHERE source_hash=? AND source_ref=? AND text_raw=? LIMIT 1`);

function applyFormat(text){
  let out = String(text || '').trim();
  if (!out) return '';
  out = out.replace(/\s+/g, ' ').trim();

  if (platform === 'x') {
    out = out.replace(/\n+/g, ' ');
    if (out.length > profile.maxChars) out = out.slice(0, profile.maxChars - 1).trimEnd() + '…';
  } else if (platform === 'linkedin') {
    out = out.replace(/\.\s+/g, '.\n\n');
    if (out.length > profile.maxChars) out = out.slice(0, profile.maxChars - 1).trimEnd() + '…';
  } else if (platform === 'instagram') {
    const tags = ['#buildinpublic', '#growth'].slice(0, profile.maxHashtags).join(' ');
    if (!out.includes('#')) out = `${out}\n\n${tags}`;
    if (out.length > profile.maxChars) out = out.slice(0, profile.maxChars - 1).trimEnd() + '…';
  } else if (platform === 'telegram') {
    if (out.length > profile.maxChars) out = out.slice(0, profile.maxChars - 1).trimEnd() + '…';
  } else if (platform === 'reddit') {
    out = out.replace(/#\w+/g, '').trim();
    if (out.length > profile.maxChars) out = out.slice(0, profile.maxChars - 1).trimEnd() + '…';
  }
  return out;
}

let prepared = 0;
const now = new Date().toISOString();

for (const pack of queue) {
  const candidates = [];
  for (const t of (pack.thread || [])) candidates.push({ content_type: 'thread_line', text_raw: t });
  for (const i of (pack.insights || [])) candidates.push({ content_type: 'insight', text_raw: i });
  if (pack.video?.caption) candidates.push({ content_type: 'video_caption', text_raw: pack.video.caption });
  if (pack.video?.hook) candidates.push({ content_type: 'video_hook', text_raw: pack.video.hook });

  for (const c of candidates.slice(0, max)) {
    const sourceRef = `${pack.ts || now}:${c.content_type}`;
    let item = findItem.get(pack.sourceHash || '', sourceRef, c.text_raw);
    let itemId;
    if (!item) {
      itemId = uid('ci');
      insertItem.run(
        itemId,
        now,
        pack.venture || 'general',
        pack.type || 'content_pack',
        sourceRef,
        pack.sourceHash || '',
        c.content_type,
        c.text_raw,
        JSON.stringify([]),
        pack.video?.cta || '',
        `auto-ingested from ${pack.type || 'queue'}`
      );
    } else {
      itemId = item.id;
    }

    const existingRender = findRender.get(itemId, platform);
    if (existingRender) continue;

    const rendered = applyFormat(c.text_raw);
    if (!rendered) continue;

    insertRender.run(uid('cr'), itemId, platform, JSON.stringify(profile), rendered, now);
    prepared++;
  }
}

console.log(JSON.stringify({ ok: true, platform, venture: venture || 'all', prepared, dbPath: DB_PATH }));
