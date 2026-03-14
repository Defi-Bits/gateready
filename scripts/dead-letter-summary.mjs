#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const dbPath = process.env.OUTBOUND_SQLITE_PATH ?? join(process.cwd(), "outbound-engine", "outbound.db");
const lookbackHours = Number(process.env.DEAD_LETTER_LOOKBACK_HOURS ?? 24);

const db = new DatabaseSync(dbPath, { readOnly: true });

const rows = db
  .prepare(
    `SELECT job_type,
            COUNT(*) AS dead_count,
            MIN(run_at) AS first_run_at,
            MAX(run_at) AS last_run_at,
            MAX(COALESCE(last_error, 'unknown_error')) AS sample_error
     FROM jobs
     WHERE status='DEAD'
       AND datetime(run_at) >= datetime('now', ?)
     GROUP BY job_type
     ORDER BY dead_count DESC, job_type ASC`,
  )
  .all(`-${lookbackHours} hours`);

if (!rows.length) {
  console.log("NO_DEAD_LETTERS");
  process.exit(0);
}

const total = rows.reduce((acc, r) => acc + Number(r.dead_count ?? 0), 0);
const lines = [
  "🚨 Dead-letter queue summary",
  `window: last ${lookbackHours}h`,
  `total_dead_jobs: ${total}`,
  "details:",
];

for (const row of rows) {
  lines.push(
    `- ${row.job_type}: ${row.dead_count} (first=${row.first_run_at}, last=${row.last_run_at}, sample_error=${row.sample_error})`,
  );
}

lines.push("recommended_action: inspect worker logs, provider/channel status, then requeue or remediate root cause.");

console.log(lines.join("\n"));
