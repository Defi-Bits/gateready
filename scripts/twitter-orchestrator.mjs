#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e?.stdout || "").trim(), err: String(e?.stderr || e?.message || e).trim() };
  }
}

function logHandoff({ bot, stage, status, inputRef = "", outputRef = "", note = "" }) {
  const cmd = `node scripts/bot-handoff-log.mjs --venture edgeterminal --lane twitter --bot "${bot}" --stage "${stage}" --status "${status}" --inputRef "${inputRef}" --outputRef "${outputRef}" --note "${note.replace(/"/g, "'")}"`;
  run(cmd);
}

const mode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "dryrun";
const cfgRaw = run("node -e \"const fs=require('fs');const p='/Users/terminal/.openclaw/workspace/shared-core/strategy/twitter-growth-config.json';const o=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(JSON.stringify(o))\"");
const cfg = cfgRaw.ok ? JSON.parse(cfgRaw.out || "{}") : {};

const gate = run("node scripts/twitter-should-run.mjs");
if (!gate.ok) {
  logHandoff({ bot: "coo", stage: "gate", status: "error", note: gate.err || gate.out });
  console.log(JSON.stringify({ ok: false, stage: "gate", gate }));
  process.exit(1);
}

const g = JSON.parse(gate.out || "{}");
if (!g.shouldRun) {
  logHandoff({ bot: "coo", stage: "gate", status: "skipped", note: g.reason || "not_due" });
  console.log(JSON.stringify({ ok: true, skipped: true, gate: g }));
  process.exit(0);
}

const context = run("node scripts/bot-context-pack.mjs --venture edgeterminal --channel twitter");
if (!context.ok) {
  logHandoff({ bot: "coo", stage: "context-pack", status: "error", note: context.err || context.out });
  console.log(JSON.stringify({ ok: false, stage: "context-pack", context }));
  process.exit(1);
}
logHandoff({ bot: "coo", stage: "context-pack", status: "ok", outputRef: "state/context-pack-edgeterminal-twitter.json" });

const steps = [
  { bot: "market-radar", stage: "discover", cmd: "node scripts/twitter-scout.mjs", inputRef: "state/context-pack-edgeterminal-twitter.json", outputRef: "state/outreach-events.jsonl" },
  { bot: "intel", stage: "plan", cmd: "npm run -s outreach:plan", inputRef: "state/outreach-events.jsonl", outputRef: "state/outreach-plan.jsonl" },
  { bot: "copy", stage: "draft", cmd: "npm run -s style:snippets && npm run -s outreach:draft", inputRef: "state/outreach-plan.jsonl", outputRef: "state/outreach-drafts.jsonl" },
  { bot: "qc", stage: "review", cmd: "npm run -s outreach:qc", inputRef: "state/outreach-drafts.jsonl", outputRef: "state/outreach-qc.jsonl,state/outreach-approvals.jsonl" },
  { bot: "style-gate", stage: "style-apply", cmd: "npm run -s style:apply", inputRef: "state/outreach-approvals.jsonl", outputRef: "state/outreach-approvals.jsonl" },
  { bot: "qc-sector", stage: "review-sector", cmd: "npm run -s outreach:qc:sector", inputRef: "state/outreach-approvals.jsonl", outputRef: "state/outreach-qc-sector.jsonl,state/outreach-approvals.jsonl" },
  { bot: "publisher", stage: "publish", cmd: `npm run -s outreach:publish:live -- --mode ${mode} --channel twitter --max ${Number(cfg.maxRepliesPerRun || 2)} --delayMs ${Number(cfg.publishDelayMs || 3500)}`, inputRef: "state/outreach-approvals.jsonl", outputRef: "state/outreach-published.jsonl" },
  { bot: "publisher", stage: "manual-relay", cmd: "node scripts/twitter-manual-relay.mjs", inputRef: "state/outreach-approvals.jsonl", outputRef: "artifacts/twitter-manual-relay.md" },
  { bot: "coo", stage: "feedback", cmd: "node scripts/twitter-feedback.mjs && npm run -s learning:update", inputRef: "state/outreach-published.jsonl,state/learning-feedback.jsonl", outputRef: "shared-core/strategy/twitter-growth-config.json,shared-core/learning/adaptive-state.json" },
  { bot: "coo", stage: "mark-run", cmd: "node scripts/twitter-should-run.mjs --mark", inputRef: "state/twitter-runtime.json", outputRef: "state/twitter-runtime.json" },
  { bot: "coo", stage: "status", cmd: "npm run -s outreach:status", inputRef: "state/*", outputRef: "stdout" }
];

const results = [];
for (const s of steps) {
  const r = run(s.cmd);
  results.push({ step: s.cmd, ...r, bot: s.bot, stage: s.stage });
  logHandoff({ bot: s.bot, stage: s.stage, status: r.ok ? "ok" : "error", inputRef: s.inputRef, outputRef: s.outputRef, note: r.ok ? "" : (r.err || r.out || "step_failed") });
  if (!r.ok) break;
}

const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ ok: failed === 0, failed, gate: g, mode, results }, null, 2));
if (failed) process.exit(1);
