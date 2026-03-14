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

function postureScore(reportJson) {
  const sev = Object.fromEntries((reportJson.severity_counts || []).map((x) => [x.severity, Number(x.c || 0)]));
  let score = 100;
  score -= (sev.critical || 0) * 18;
  score -= (sev.warn || 0) * 4;
  score -= (sev.info || 0) * 1;
  return Math.max(0, Math.min(100, score));
}

function buildWeekly(reportJson) {
  const risks = reportJson.top_risks || [];
  const score = postureScore(reportJson);
  const top3 = risks.slice(0, 3);

  const lines = [
    `posture_score: ${score}/100`,
    `window: ${reportJson.window || "7d"}`,
    "top_risks:"
  ];

  for (const r of top3) {
    lines.push(`- ${r.scenario} [${r.residual_risk}] coverage=${Math.round((r.detection_coverage || 0) * 100)}%`);
  }

  lines.push("next_week_actions:");
  for (const r of top3) lines.push(`- ${r.recommended_action}`);
  lines.push("owner: Security Chief");
  return lines.join("\n");
}

try {
  run(`node ${join(ROOT, "scripts", "security-config-drift.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-init.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-ingest.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-threat-model.mjs")}`);
  run(`node ${join(ROOT, "scripts", "security-chief-v2-actions.mjs")}`);
  const reportRaw = run(`node ${join(ROOT, "scripts", "security-chief-v2-report.mjs")}`);
  const report = JSON.parse(reportRaw);
  const message = buildWeekly(report);

  run(
    `node ${join(ROOT, "scripts", "security-chief-dispatch.mjs")} --channel ${CHANNEL} --target ${CHAT_ID} --severity warn --message ${JSON.stringify(message)}`
  );
  console.log("[security-chief-weekly] delivered");
} catch (e) {
  console.error(`[security-chief-weekly] failed: ${String(e?.message || e)}`);
  process.exit(1);
}
