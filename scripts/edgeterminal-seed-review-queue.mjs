#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

function slot(ts, objective, draft) {
  const id = `edgecal-${ts.replace(/[^0-9]/g,"").slice(0,12)}-${Math.random().toString(36).slice(2,8)}`;
  return {
    ts: new Date().toISOString(),
    eventId: id,
    decision: "approve",
    note: `calendar-seed:${objective}`,
    channel: "twitter",
    venture: "edgeterminal",
    draft,
    sourceUrl: "",
    replyToTweetId: "",
    status: "ready_to_publish"
  };
}

const seeds = [
  slot("08:30", "authority", "Most traders don't lose to bad reads—they lose to slow signal triage. Speed + clarity is the real edge."),
  slot("12:30", "product", "If your dashboard feels heavy, your decisions get heavy too. We’re designing EdgeTerminal for fast context, not clutter."),
  slot("16:30", "positioning", "The next generation of crypto terminals will be judged by workflow quality, not feature count."),
  slot("20:30", "community", "What’s the #1 thing that slows your decision-making in current crypto tools?"),
];

const current = readJsonl(APPROVALS);
mkdirSync(dirname(APPROVALS), { recursive: true });
writeFileSync(APPROVALS, [...current, ...seeds].map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(JSON.stringify({ ok: true, queued: seeds.length, path: APPROVALS }));
