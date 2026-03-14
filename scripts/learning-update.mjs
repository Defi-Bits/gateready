#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const PUBLISHED = join(ROOT, "state", "outreach-published.jsonl");
const FEEDBACK = join(ROOT, "state", "learning-feedback.jsonl");
const OUT = join(WORKSPACE, "shared-core", "learning", "adaptive-state.json");
const TWCFG = join(WORKSPACE, "shared-core", "strategy", "twitter-growth-config.json");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const pub = readJsonl(PUBLISHED).slice(-100);
const fb = readJsonl(FEEDBACK).slice(-100);
const tw = readJson(TWCFG, {});

const published = pub.filter(p => p.status === "published_live" || p.status === "published_dryrun").length;
const failed = pub.filter(p => p.status === "publish_failed").length;
const engaged = fb.filter(x => x.label === "engaged").length;

const successRate = (published + failed) ? published / (published + failed) : 1;
const engageRate = published ? engaged / published : 0;

let maxRepliesPerRun = Number(tw.maxRepliesPerRun || 2);
if (successRate > 0.9 && engageRate > 0.1) maxRepliesPerRun = Math.min(5, maxRepliesPerRun + 1);
if (successRate < 0.7) maxRepliesPerRun = Math.max(1, maxRepliesPerRun - 1);

const nextTw = { ...tw, maxRepliesPerRun, lastLearningUpdate: new Date().toISOString() };
writeFileSync(TWCFG, JSON.stringify(nextTw, null, 2) + "\n");

const state = {
  ts: new Date().toISOString(),
  metrics: { published, failed, engaged, successRate: Number(successRate.toFixed(3)), engageRate: Number(engageRate.toFixed(3)) },
  actions: { maxRepliesPerRun }
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, state: OUT, actions: state.actions, metrics: state.metrics }));
