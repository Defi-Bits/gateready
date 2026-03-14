#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const ROOT='/Users/terminal/.openclaw/workspace/mission-control';
const DB=process.env.CONTENT_LIBRARY_DB || join(ROOT,'state','content-library.db');
function arg(name,f=''){ const i=process.argv.indexOf(`--${name}`); return i===-1?f:(process.argv[i+1]??f); }

const platform=arg('platform','telegram');
const venture=arg('venture','');
const limit=Number(arg('limit','10'));
const db=new DatabaseSync(DB);

let sql=`UPDATE content_renders SET status='approved' WHERE status='draft' AND platform=?`;
const params=[platform];
if (venture) {
  sql = `UPDATE content_renders SET status='approved' WHERE status='draft' AND platform=? AND item_id IN (SELECT id FROM content_items WHERE venture=?)`;
  params.push(venture);
}
const before = db.prepare(`SELECT COUNT(*) c FROM content_renders WHERE status='approved' AND platform=?`).get(platform).c;
db.prepare(sql).run(...params);
const after = db.prepare(`SELECT COUNT(*) c FROM content_renders WHERE status='approved' AND platform=?`).get(platform).c;
const changed = after - before;

const rows = db.prepare(`SELECT r.id,i.venture,r.platform,r.status,substr(r.text_rendered,1,140) preview FROM content_renders r JOIN content_items i ON i.id=r.item_id WHERE r.platform=? AND r.status='approved' ORDER BY r.created_at DESC LIMIT ?`).all(platform, limit);
console.log(JSON.stringify({ok:true, platform, venture: venture||'all', changed, approved_preview: rows}, null, 2));
