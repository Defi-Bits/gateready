#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const BASELINE_PATH = join(ROOT, "state", "report-baseline.json");

function run(cmd, timeoutMs = 120000) {
  try {
    return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs }).trim() };
  } catch (e) {
    return { ok: false, out: String(e?.stdout || "").trim(), err: String(e?.stderr || e?.message || e).trim() };
  }
}

function oneLine(s) {
  return s.replace(/\s+/g, " ").trim();
}

function extractSecuritySummary(text) {
  const m = text.match(/Summary:\s*([^\n]+)/i);
  return m ? m[1].trim() : "summary-unavailable";
}

function queueHealthStatus(text) {
  if (text.includes("[queue-health] PASS")) return "pass";
  if (text.includes("[queue-health] FAIL")) return "fail";
  return "unknown";
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveBaseline(data) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2));
}

function computeDelta(prev, curr) {
  if (!prev) return "baseline-created";
  const diffs = [];
  for (const key of Object.keys(curr)) {
    if (key === "generatedAt") continue;
    if (String(prev[key]) !== String(curr[key])) {
      diffs.push(`${key}:${prev[key] ?? "n/a"}->${curr[key]}`);
    }
  }
  return diffs.length ? diffs.join(";") : "no-significant-changes";
}

const type = process.argv.includes("--type") ? process.argv[process.argv.indexOf("--type") + 1] : "security-daily";

const secCmd = type === "security-daily" ? "openclaw security audit --deep" : "openclaw security audit";
const secTimeoutMs = type === "security-daily" ? 180000 : 60000;
const sec = run(secCmd, secTimeoutMs);
const secSummary = sec.ok ? extractSecuritySummary(sec.out) : "security-audit-failed";

const fw = run('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate');
const fwState = fw.ok ? oneLine(fw.out) : "firewall-check-failed";

const ports = run('/usr/sbin/lsof -nP -iTCP -sTCP:LISTEN');
let nonLocal = "unknown";
if (ports.ok) {
  const lines = ports.out.split("\n").slice(1).filter(Boolean);
  const nonLocalCount = lines.filter((l) => !l.includes("127.0.0.1:") && !l.includes("[::1]:")).length;
  nonLocal = String(nonLocalCount);
}

const qh = run(`cd ${ROOT} && npm run -s queue:health`);
const qhStatus = queueHealthStatus(`${qh.out}\n${qh.err || ""}`);

const dl = run(`cd ${ROOT} && npm run -s deadletter:summary`);
const dead = dl.ok && dl.out.includes("NO_DEAD_LETTERS") ? "0" : "present";

const snapshot = {
  firewall: fwState,
  nonlocal_ports: nonLocal,
  security: secSummary,
  queue: qhStatus,
  dead,
  generatedAt: new Date().toISOString(),
};

const baseline = loadBaseline();
const prev = baseline[type];
const delta = computeDelta(prev, snapshot);
baseline[type] = snapshot;
saveBaseline(baseline);

function buildStructuredMessage() {
  const summaryMatch = secSummary.match(/(\d+)\s*critical\s*·\s*(\d+)\s*warn\s*·\s*(\d+)\s*info/i);
  const critical = summaryMatch ? Number(summaryMatch[1]) : 0;
  const warn = summaryMatch ? Number(summaryMatch[2]) : 0;
  const info = summaryMatch ? Number(summaryMatch[3]) : 0;

  const overallRisk = critical > 0 ? "HIGH" : warn > 0 ? "LOW" : "LOW";
  const queueLine = qhStatus === "pass" ? "healthy" : qhStatus === "fail" ? "degraded" : "unknown";
  const deadLine = dead === "0" ? "none" : "present";

  if (type === "security-daily") {
    return [
      `Executive Snapshot (${type})`,
      `- Overall risk: ${overallRisk}`,
      `- Critical: ${critical} | Warn: ${warn} | Info: ${info}`,
      `- Queue: ${queueLine}`,
      `- Dead letters: ${deadLine}`,
      `- Delta: ${delta}`,
      "",
      "Structured Details",
      `1) Security audit summary: ${secSummary}`,
      `2) Firewall status: ${fwState}`,
      `3) Non-local listening TCP ports: ${nonLocal}`,
      `4) Queue health: ${qhStatus}`,
      `5) Dead-letter status: ${dead}`,
      "",
      "Actions",
      "1. Keep Gateway local-only unless remote exposure is required (Owner: K, Due: Today)",
      "2. If reverse proxy is enabled, configure trusted proxies before go-live (Owner: K+Zuri, Due: Before exposure)",
      "3. Verify OS security update status on host settings UI (Owner: K, Due: Today)",
    ].join("\n");
  }

  return [
    `Executive Snapshot (${type})`,
    `- Security summary: ${secSummary}`,
    `- Queue: ${queueLine}`,
    `- Dead letters: ${deadLine}`,
    `- Non-local ports: ${nonLocal}`,
    `- Delta: ${delta}`,
    "",
    "Structured Details",
    `1) Firewall status: ${fwState}`,
    `2) Queue health: ${qhStatus}`,
    `3) Dead-letter status: ${dead}`,
  ].join("\n");
}

console.log(buildStructuredMessage());
