#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = process.env.OUTBOUND_SQLITE_PATH ?? join(process.cwd(), "outbound-engine", "outbound.db");
const doneDays = Number(process.env.QUEUE_CLEANUP_DONE_DAYS ?? 14);
const failedDays = Number(process.env.QUEUE_CLEANUP_FAILED_DAYS ?? 30);
const deadDays = Number(process.env.QUEUE_CLEANUP_DEAD_DAYS ?? 60);

const db = new DatabaseSync(dbPath);

db.exec("BEGIN IMMEDIATE");
try {
  const delDone = db.prepare("DELETE FROM jobs WHERE status='DONE' AND datetime(run_at) < datetime('now', ?)").run(`-${doneDays} days`).changes;
  const delFailed = db.prepare("DELETE FROM jobs WHERE status='FAILED' AND datetime(run_at) < datetime('now', ?)").run(`-${failedDays} days`).changes;
  const delDead = db.prepare("DELETE FROM jobs WHERE status='DEAD' AND datetime(run_at) < datetime('now', ?)").run(`-${deadDays} days`).changes;

  // keep idempotency reasonably bounded
  const delIdem = db.prepare("DELETE FROM idempotency WHERE datetime(created_at) < datetime('now', '-90 days')").run().changes;

  db.exec("COMMIT");
  db.exec("VACUUM");

  console.log(
    JSON.stringify({
      ok: true,
      dbPath,
      deleted: { done: delDone, failed: delFailed, dead: delDead, idempotency: delIdem },
      timestamp: new Date().toISOString(),
    }),
  );
} catch (err) {
  db.exec("ROLLBACK");
  console.error("[queue-cleanup]", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
