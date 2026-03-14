#!/usr/bin/env node
import { execSync } from "node:child_process";
import { join } from "node:path";
import { readChiefConfig } from "./security-chief-config.mjs";

process.env.PATH = `/Users/terminal/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`;

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const cfg = readChiefConfig();
const CHANNEL = process.env.SECURITY_CHIEF_CHANNEL ?? cfg.routing?.channel ?? "telegram";
const CHAT_ID = process.env.SECURITY_CHIEF_CHAT_ID ?? cfg.routing?.target ?? "5000492604";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function buildMessage(reportJson, workerSummary) {
  const sev = Object.fromEntries((reportJson.severity_counts || []).map((x) => [x.severity, x.c]));
  const top = reportJson.top_signals || [];
  const risks = reportJson.top_risks || [];

  const riskLine = risks[0]
    ? `${risks[0].scenario} (risk=${risks[0].residual_risk}, coverage=${Math.round((risks[0].detection_coverage || 0) * 100)}%)`
    : "no major risks identified";

  const actionLine = risks[0]?.recommended_action || "continue monitoring";
  const pending = Number(workerSummary?.pendingApprovals || 0);
  const assigned = Number(workerSummary?.assigned || 0);

  return [
    `Executive Snapshot`,
    `- severity: critical=${sev.critical || 0}, warn=${sev.warn || 0}, info=${sev.info || 0}`,
    `- top_risk: ${riskLine}`,
    `- worker_assignments_created: ${assigned}`,
    `- approvals_pending: ${pending}`,
    "",
    `Structured Details`,
    `1) window: ${reportJson.window || "7d"}`,
    `2) top_signals: ${top.slice(0, 3).map((t) => `${t.event_type}:${t.c}`).join(", ") || "none"}`,
    `3) action_today: ${actionLine}`,
    `4) approval_flow: chief -> zuri -> user`,
    `5) owner: Security Chief`
  ].join("\n");
}

try {
  run(`node ${join(ROOT, "scripts", "security-config-drift.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-init.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-ingest.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-threat-model.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-actions.mjs")}`);

  const assignRaw = run(`node ${join(ROOT, "scripts", "security-chief-worker-assign.mjs")}`);
  const assign = JSON.parse(assignRaw || "{}");

  const pendingRaw = run(`node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('${join(ROOT, "state", "security-chief.db")}'); const row=db.prepare(\"SELECT COUNT(*) c FROM remediation_assignments WHERE status='pending'\").get(); console.log(JSON.stringify({pending: Number(row?.c||0)}));"`);
  const pending = JSON.parse(pendingRaw || "{}");

  const reportRaw = run(`node ${join(ROOT, "scripts", "security-chief-v2-report.mjs")}`);
  const report = JSON.parse(reportRaw);
  const message = buildMessage(report, { assigned: assign.assigned || 0, pendingApprovals: pending.pending || 0 });

  run(
    `node ${join(ROOT, "scripts", "security-chief-dispatch.mjs")} --channel ${CHANNEL} --target ${CHAT_ID} --severity warn --message ${JSON.stringify(message)}`
  );
  console.log("[security-chief-daily] delivered");
} catch (e) {
  console.error(`[security-chief-daily] failed: ${String(e?.message || e)}`);
  process.exit(1);
}
