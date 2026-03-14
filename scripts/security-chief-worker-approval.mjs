#!/usr/bin/env node
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const DB = join(ROOT, "state", "security-chief.db");
const FLOW = ["chief", "zuri", "user"];

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const assignmentId = arg("assignmentId", "");
const stage = arg("stage", "").toLowerCase();
const decision = arg("decision", "approve").toLowerCase();
const note = arg("note", "");

if (!assignmentId || !FLOW.includes(stage) || !["approve", "reject"].includes(decision)) {
  console.error("usage: --assignmentId <id> --stage chief|zuri|user --decision approve|reject [--note text]");
  process.exit(1);
}

const db = new DatabaseSync(DB);
const get = db.prepare(`SELECT * FROM remediation_assignments WHERE id = ? LIMIT 1`);
const upd = db.prepare(`UPDATE remediation_assignments SET stage=?, status=?, notes=?, updated_at=? WHERE id=?`);
const updTask = db.prepare(`UPDATE remediation_tasks SET status=?, owner=?, last_updated=? WHERE id=?`);

const row = get.get(assignmentId);
if (!row) {
  console.error(JSON.stringify({ ok: false, error: "assignment_not_found", assignmentId }));
  process.exit(1);
}
if (row.status === "rejected" || row.status === "done") {
  console.error(JSON.stringify({ ok: false, error: "assignment_closed", assignmentId, status: row.status }));
  process.exit(1);
}
if (row.stage !== stage) {
  console.error(JSON.stringify({ ok: false, error: "stage_mismatch", expected: row.stage, got: stage }));
  process.exit(1);
}

const notes = (() => {
  try { return JSON.parse(row.notes || "{}"); } catch { return {}; }
})();
notes.approvals = notes.approvals || [];
notes.approvals.push({ stage, decision, note, ts: new Date().toISOString() });

const now = new Date().toISOString();
let nextStage = stage;
let nextStatus = row.status;

if (decision === "reject") {
  nextStatus = "rejected";
  updTask.run("open", "Security Chief", now, row.task_id);
} else {
  const idx = FLOW.indexOf(stage);
  if (idx < FLOW.length - 1) {
    nextStage = FLOW[idx + 1];
    nextStatus = "pending";
  } else {
    nextStage = "done";
    nextStatus = "approved";
    updTask.run("in_progress", row.worker_name || row.worker_id, now, row.task_id);
  }
}

upd.run(nextStage, nextStatus, JSON.stringify(notes), now, assignmentId);

console.log(JSON.stringify({
  ok: true,
  assignmentId,
  taskId: row.task_id,
  decision,
  stage,
  nextStage,
  nextStatus,
  note,
}, null, 2));
