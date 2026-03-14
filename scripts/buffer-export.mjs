#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');
const OUT_DIR = join(ROOT, 'state', 'exports');

function arg(name, fallback=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function csvEscape(v){ const s=String(v ?? ''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

const venture = arg('venture','');
const platform = arg('platform','x');
const limit = Number(arg('limit','25'));

const db = new DatabaseSync(DB, { readOnly: true });
let sql = `SELECT r.id, i.venture, r.platform, r.text_rendered, r.created_at
FROM content_renders r JOIN content_items i ON i.id=r.item_id
WHERE r.status='approved' AND r.platform=?`;
const params = [platform];
if (venture){ sql += ` AND i.venture=?`; params.push(venture); }
sql += ` ORDER BY r.created_at DESC LIMIT ?`;
params.push(limit);
const rows = db.prepare(sql).all(...params);

mkdirSync(OUT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g,'-');
const scope = venture || 'all';
const outPath = join(OUT_DIR, `buffer-export-${scope}-${platform}-${ts}.csv`);

const header = ['text','channel','venture','source_id'];
const lines = [header.join(',')];
for (const r of rows){
  lines.push([
    csvEscape(r.text_rendered),
    csvEscape(platform),
    csvEscape(r.venture),
    csvEscape(r.id),
  ].join(','));
}
writeFileSync(outPath, lines.join('\n'));
console.log(JSON.stringify({ ok:true, outPath, count: rows.length, venture: venture || 'all', platform }, null, 2));
