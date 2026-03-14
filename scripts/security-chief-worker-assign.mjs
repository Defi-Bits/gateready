#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const DB = join(ROOT, "state", "security-chief.db");
const WORKERS_CFG = join(ROOT, "config", "security-workers.json");

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

const cfg = readJson(WORKERS_CFG, { workers: [], approvalFlow: ["chief", "zuri", "user"], autoAssign: true });
const workers = (cfg.workers || []).filter((w) => w.enabled);
if (!workers.length) {
  console.log(JSON.stringify({ ok: true, assigned: 0, reason: "no_enabled_workers" }));
  process.exit(0);
}

const db = new DatabaseSync(DB);
db.exec(`
CREATE TABLE IF NOT EXISTS remediation_assignments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  stage TEXT NOT NULL DEFAULT 'chief',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES remediation_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_remediation_assignments_task ON remediation_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_remediation_assignments_status ON remediation_assignments(status);
`);

const now = new Date().toISOString();
const openTasks = db.prepare(`
  SELECT id, title, severity, description, due_at
  FROM remediation_tasks
  WHERE status IN ('open')
  ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END, created_at ASC
  LIMIT 20
`).all();

const hasActive = db.prepare(`
  SELECT id FROM remediation_assignments
  WHERE task_id = ? AND status IN ('pending','approved','in_progress')
  LIMIT 1
`);

const workerOpenCount = db.prepare(`
  SELECT COUNT(*) c FROM remediation_assignments
  WHERE worker_id = ? AND status IN ('pending','approved','in_progress')
`);

const ins = db.prepare(`
  INSERT INTO remediation_assignments (id, task_id, worker_id, worker_name, stage, status, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'chief', 'pending', ?, ?, ?)
`);

const out = [];
for (const task of openTasks) {
  if (hasActive.get(task.id)) continue;

  const candidate = workers.find((w) => {
    const handles = (w.handlesSeverities || []).includes(task.severity);
    const open = Number(workerOpenCount.get(w.id)?.c || 0);
    const cap = Number(w.maxOpenAssignments || 1);
    return handles && open < cap;
  });

  if (!candidate) continue;

  const assignment = {
    id: uid("ra"),
    taskId: task.id,
    workerId: candidate.id,
    workerName: candidate.name || candidate.id,
    notes: JSON.stringify({
      approvalFlow: cfg.approvalFlow || ["chief", "zuri", "user"],
      assignedBy: "security-chief-worker-assign",
      taskTitle: task.title,
      dueAt: task.due_at || null,
    }),
    createdAt: now,
    updatedAt: now,
  };

  ins.run(
    assignment.id,
    assignment.taskId,
    assignment.workerId,
    assignment.workerName,
    assignment.notes,
    assignment.createdAt,
    assignment.updatedAt,
  );

  out.push({
    assignmentId: assignment.id,
    taskId: task.id,
    taskTitle: task.title,
    severity: task.severity,
    workerId: candidate.id,
    stage: "chief",
    status: "pending",
  });
}

console.log(JSON.stringify({ ok: true, assigned: out.length, assignments: out }, null, 2));
