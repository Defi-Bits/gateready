#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG_PATH = join(WORKSPACE, "shared-core", "strategy", "twitter-growth-config.json");
const PUB_LOG = join(ROOT, "state", "outreach-published.jsonl");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const cfg = readJson(CFG_PATH, {});
const items = readJsonl(PUB_LOG).filter(x => x.channel === "twitter").slice(-40);
if (!items.length) {
  console.log(JSON.stringify({ ok: true, updated: false, reason: "no_twitter_publish_data" }));
  process.exit(0);
}

const failed = items.filter(x => x.status === "publish_failed").length;
const failRate = failed / items.length;

let maxRepliesPerRun = Number(cfg.maxRepliesPerRun || 2);
let minMinutesBetweenRuns = Number(cfg.minMinutesBetweenRuns || 90);

if (failRate > 0.3) {
  maxRepliesPerRun = Math.max(1, maxRepliesPerRun - 1);
  minMinutesBetweenRuns = Math.min(240, minMinutesBetweenRuns + 15);
} else if (failRate < 0.05) {
  maxRepliesPerRun = Math.min(4, maxRepliesPerRun + 1);
  minMinutesBetweenRuns = Math.max(60, minMinutesBetweenRuns - 10);
}

const next = { ...cfg, maxRepliesPerRun, minMinutesBetweenRuns, lastAdaptiveUpdate: new Date().toISOString() };
writeFileSync(CFG_PATH, JSON.stringify(next, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, updated: true, failRate, maxRepliesPerRun, minMinutesBetweenRuns }));
