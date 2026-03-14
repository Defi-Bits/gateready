#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

function mk(objective, draft) {
  const id = `grcal-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  return {
    ts: new Date().toISOString(),
    eventId: id,
    decision: "approve",
    note: `calendar-seed:${objective}`,
    channel: "twitter",
    venture: "gateready",
    draft,
    sourceUrl: "",
    replyToTweetId: "",
    status: "ready_to_publish"
  };
}

const seeds = [
  mk("policy", "Before event day, check clear bag size policy first. A 30-second check can save a denied entry."),
  mk("readiness", "Game day checklist: clear bag, essentials only, and arrive early to avoid gate stress."),
  mk("conversion", "Need a clear bag for your next event? Gate Ready helps you prep with confidence, not guesswork."),
  mk("community", "What venue policy surprised you most recently? We’re mapping the common gotchas."),
];

const current = readJsonl(APPROVALS);
mkdirSync(dirname(APPROVALS), { recursive: true });
writeFileSync(APPROVALS, [...current, ...seeds].map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(JSON.stringify({ ok: true, queued: seeds.length, path: APPROVALS }));
