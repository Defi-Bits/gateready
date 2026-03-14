#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB_PATH = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const platform = arg('platform', '');
const status = arg('status', 'draft');
const limit = Number(arg('limit', '20'));

const db = new DatabaseSync(DB_PATH, { readOnly: true });
let sql = `
SELECT r.id, i.venture, i.content_type, r.platform, r.status, substr(r.text_rendered,1,180) AS preview, r.created_at
FROM content_renders r
JOIN content_items i ON i.id = r.item_id
WHERE 1=1
`;
const params = [];
if (platform) { sql += ` AND r.platform=?`; params.push(platform); }
if (status) { sql += ` AND r.status=?`; params.push(status); }
sql += ` ORDER BY r.created_at DESC LIMIT ?`;
params.push(limit);

const rows = db.prepare(sql).all(...params);
if (!rows.length) {
  console.log('NO_CONTENT_RENDERS');
  process.exit(0);
}
for (const r of rows) {
  console.log(`[${r.venture}] ${r.platform}/${r.status} ${r.content_type} :: ${r.preview}`);
}
