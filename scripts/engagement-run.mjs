#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(cmd) {
  try { return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() }; }
  catch (e) { return { ok: false, out: String(e?.stdout || "").trim(), err: String(e?.stderr || e?.message || e).trim() }; }
}

const mode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "dryrun";
const steps = [
  "node scripts/engagement-fetch.mjs",
  "node scripts/engagement-plan.mjs",
  "npm run -s outreach:plan",
  "npm run -s outreach:draft",
  "npm run -s outreach:qc",
  `npm run -s outreach:publish:live -- --mode ${mode} --channel twitter --max 2 --delayMs 3500`
];
const results = steps.map((s) => ({ step: s, ...run(s) }));
const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ ok: failed === 0, failed, mode, results }, null, 2));
if (failed) process.exit(1);
