#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = process.env.OUTBOUND_SQLITE_PATH ?? join(process.cwd(), "outbound-engine", "outbound.db");
const stalePendingMinutes = Number(process.env.QUEUE_HEALTH_STALE_PENDING_MINUTES ?? 15);
const staleRunningMinutes = Number(process.env.QUEUE_HEALTH_STALE_RUNNING_MINUTES ?? 10);

const db = new DatabaseSync(dbPath, { readOnly: true });

function scalar(sql, ...params) {
  const row = db.prepare(sql).get(...params);
  const key = row ? Object.keys(row)[0] : null;
  return key ? Number(row[key] ?? 0) : 0;
}

const pending = scalar("SELECT COUNT(*) AS c FROM jobs WHERE status='PENDING'");
const running = scalar("SELECT COUNT(*) AS c FROM jobs WHERE status='RUNNING'");
const failed = scalar("SELECT COUNT(*) AS c FROM jobs WHERE status='FAILED'");
const dead = scalar("SELECT COUNT(*) AS c FROM jobs WHERE status='DEAD'");

const stalePending = scalar(
  "SELECT COUNT(*) AS c FROM jobs WHERE status='PENDING' AND datetime(run_at) <= datetime('now', ?)",
  `-${stalePendingMinutes} minutes`,
);

const staleRunning = scalar(
  "SELECT COUNT(*) AS c FROM jobs WHERE status='RUNNING' AND locked_at IS NOT NULL AND datetime(locked_at) <= datetime('now', ?)",
  `-${staleRunningMinutes} minutes`,
);

const criticalDead = scalar(
  "SELECT COUNT(*) AS c FROM jobs WHERE status='DEAD' AND job_type IN ('CriticalReportDispatch','CriticalReportEscalate')",
);

const payload = {
  ok: dead === 0 && stalePending === 0 && staleRunning === 0,
  dbPath,
  thresholds: { stalePendingMinutes, staleRunningMinutes },
  counts: { pending, running, failed, dead, stalePending, staleRunning, criticalDead },
  timestamp: new Date().toISOString(),
};

if (!payload.ok) {
  console.error("[queue-health] FAIL", JSON.stringify(payload));
  process.exit(1);
}

console.log("[queue-health] PASS", JSON.stringify(payload));
