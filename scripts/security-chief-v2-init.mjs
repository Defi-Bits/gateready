#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DB = join(ROOT, 'state', 'security-chief.db');
const SCHEMA = join(ROOT, 'security', 'schema.sql');

const db = new DatabaseSync(DB);
db.exec(readFileSync(SCHEMA, 'utf8'));
console.log(JSON.stringify({ ok: true, dbPath: DB }));
