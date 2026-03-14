#!/usr/bin/env node
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: String(e?.stdout || "").trim(), err: String(e?.stderr || e?.message || e).trim() };
  }
}

const mode = process.argv.includes("--mode") ? process.argv[process.argv.indexOf("--mode") + 1] : "dryrun";
const max = process.argv.includes("--max") ? process.argv[process.argv.indexOf("--max") + 1] : "3";
const delayMs = process.argv.includes("--delayMs") ? process.argv[process.argv.indexOf("--delayMs") + 1] : "1200";

const steps = [
  `npm run -s outreach:plan`,
  `npm run -s outreach:draft`,
  `npm run -s outreach:auto-approve -- --channel twitter`,
  `npm run -s outreach:publish:live -- --mode ${mode} --channel twitter --max ${max} --delayMs ${delayMs}`,
  `npm run -s outreach:status`,
];

const results = steps.map((s) => ({ step: s, ...run(s) }));
const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ ok: failed === 0, failed, mode, results }, null, 2));
if (failed) process.exit(1);
