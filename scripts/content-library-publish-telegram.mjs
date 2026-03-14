#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT='/Users/terminal/.openclaw/workspace/mission-control';
const DB=process.env.CONTENT_LIBRARY_DB || join(ROOT,'state','content-library.db');
const TARGET=process.env.TELEGRAM_PIPELINE_TARGET || '5000492604';
function arg(name,f=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?f:(process.argv[i+1]??f); }

const mode=arg('mode','dryrun');
const limit=Number(arg('limit','5'));
const venture=arg('venture','');
const db=new DatabaseSync(DB);

let sql = `SELECT r.id, i.venture, r.text_rendered FROM content_renders r JOIN content_items i ON i.id=r.item_id WHERE r.platform='telegram' AND r.status='approved'`;
const params=[];
if (venture){ sql += ` AND i.venture=?`; params.push(venture); }
sql += ` ORDER BY r.created_at ASC LIMIT ?`; params.push(limit);
const rows = db.prepare(sql).all(...params);

let published=0, failed=0;
const updPub=db.prepare(`UPDATE content_renders SET status='published', published_at=? WHERE id=?`);
const updFail=db.prepare(`UPDATE content_renders SET status='failed' WHERE id=?`);

for (const r of rows){
  const msg = `📣 ${r.venture}\n${r.text_rendered}`;
  try {
    if (mode==='live') execSync(`/Users/terminal/.npm-global/bin/openclaw message send --channel telegram --target ${TARGET} --message ${JSON.stringify(msg)}`, {stdio:'ignore'});
    if (mode==='live') updPub.run(new Date().toISOString(), r.id);
    published++;
  } catch {
    updFail.run(r.id);
    failed++;
  }
}
console.log(JSON.stringify({ok:true, mode, attempted: rows.length, published, failed, target: TARGET}, null, 2));
