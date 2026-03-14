#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB_PATH = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');

const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  venture TEXT NOT NULL,
  source_type TEXT,
  source_ref TEXT,
  source_hash TEXT,
  content_type TEXT NOT NULL,
  text_raw TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  tags_json TEXT,
  cta TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS content_renders (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  format_profile TEXT,
  text_rendered TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  external_post_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(item_id) REFERENCES content_items(id)
);

CREATE INDEX IF NOT EXISTS idx_items_venture_status ON content_items(venture, status);
CREATE INDEX IF NOT EXISTS idx_renders_platform_status ON content_renders(platform, status);
CREATE INDEX IF NOT EXISTS idx_renders_item ON content_renders(item_id);
`);

console.log(JSON.stringify({ ok: true, dbPath: DB_PATH }));
