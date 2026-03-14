#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");
const PUBLISHED = join(ROOT, "state", "outreach-published.jsonl");
const RELAY = join(ROOT, "artifacts", "twitter-manual-relay.md");

function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const approvals = readJsonl(APPROVALS).filter(a => a.channel === "twitter" && a.status === "ready_to_publish");
const done = new Set(readJsonl(PUBLISHED).map(p => p.eventId));
const queue = approvals.filter(a => !done.has(a.eventId)).slice(0, 20);

const lines = ["# Twitter Manual Relay Queue", "", `Generated: ${new Date().toISOString()}`, ""];
if (!queue.length) {
  lines.push("No queued items.");
} else {
  let i = 1;
  for (const q of queue) {
    lines.push(`## ${i}. ${q.eventId}`);
    lines.push(`- Venture: ${q.venture}`);
    lines.push(`- Source: ${q.sourceUrl || "n/a"}`);
    lines.push(`- ReplyToTweetId: ${q.replyToTweetId || ""}`);
    lines.push(`- Draft: ${q.draft}`);
    lines.push("");
    i++;
  }
}
mkdirSync(dirname(RELAY), { recursive: true });
writeFileSync(RELAY, lines.join("\n") + "\n");
console.log(JSON.stringify({ ok: true, queued: queue.length, relay: RELAY }));
