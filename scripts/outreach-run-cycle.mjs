#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const STRUCTURE = join(ROOT, "config", "venture-bot-structure.json");

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: String(e?.stdout || "").trim(), err: String(e?.stderr || e?.message || e).trim() };
  }
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

function loadStructure() {
  try { return JSON.parse(readFileSync(STRUCTURE, "utf8")); } catch { return { ventures: {}, execution: {} }; }
}

const venture = arg("venture", "edgeterminal");
let mode = arg("mode", "dryrun");
const structure = loadStructure();
const ventureCfg = structure?.ventures?.[venture];

if (!ventureCfg) {
  console.error(JSON.stringify({ ok: false, error: "unknown_venture", venture, known: Object.keys(structure?.ventures || {}) }, null, 2));
  process.exit(1);
}

const requireApprovalBeforeLive = structure?.execution?.requireApprovalBeforeLive !== false;
const hasAssistBot = (ventureCfg?.bots || []).some((b) => b?.mode === "assist");
if (mode === "live" && (requireApprovalBeforeLive || hasAssistBot)) {
  mode = "dryrun";
}

const steps = [
  `npm run -s outreach:plan`,
  `npm run -s outreach:draft`,
  `npm run -s outreach:publish:live -- --mode ${mode}`,
  `npm run -s outreach:status`,
];

const results = steps.map((s) => ({ step: s, ...run(s) }));
const failed = results.filter((r) => !r.ok).length;

console.log(JSON.stringify({ ok: failed === 0, failed, venture, mode, modeReason: mode === "dryrun" ? "enforced_by_structure" : "requested", results }, null, 2));
if (failed) process.exit(1);
