#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const DB = join(ROOT, "outbound-engine", "outbound.db");
const DB_WAL = join(ROOT, "outbound-engine", "outbound.db-wal");
const DB_SHM = join(ROOT, "outbound-engine", "outbound.db-shm");
const ART = join(ROOT, "artifacts");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const apply = process.argv.includes("--apply");
const id = arg("id", "latest");

const dirs = existsSync(ART)
  ? readdirSync(ART, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("forensics-"))
      .map((d) => d.name)
      .sort()
  : [];

if (!dirs.length) {
  console.error("no_forensic_snapshots_found");
  process.exit(1);
}

const chosen = id === "latest" ? dirs[dirs.length - 1] : `forensics-${id}`;
const backupDb = join(ART, chosen, "outbound.db.bak");
if (!existsSync(backupDb)) {
  console.error(`backup_not_found:${backupDb}`);
  process.exit(1);
}

if (!apply) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    selected: chosen.replace("forensics-", ""),
    source: backupDb,
    target: DB,
    hint: "re-run with --apply to restore"
  }, null, 2));
  process.exit(0);
}

mkdirSync(ART, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const preflight = join(ART, `restore-preflight-${ts}.db`);
if (existsSync(DB)) {
  copyFileSync(DB, preflight);
}

copyFileSync(backupDb, DB);
if (existsSync(DB_WAL)) rmSync(DB_WAL, { force: true });
if (existsSync(DB_SHM)) rmSync(DB_SHM, { force: true });

console.log(JSON.stringify({
  ok: true,
  restoredFrom: chosen.replace("forensics-", ""),
  source: backupDb,
  target: DB,
  preflightBackup: existsSync(preflight) ? preflight : null
}, null, 2));
