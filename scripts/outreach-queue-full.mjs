#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const drafts = readJsonl(join(ROOT, "state", "outreach-drafts.jsonl"));
const approvals = readJsonl(join(ROOT, "state", "outreach-approvals.jsonl"));
const published = readJsonl(join(ROOT, "state", "outreach-published.jsonl"));

console.log(`drafts=${drafts.length} approvals=${approvals.length} published=${published.length}`);
for (const d of drafts.slice(-10)) {
  console.log(`[DRAFT] ${d.eventId} ${d.venture}/${d.channel} action=${d.action} approval=${d.approvalRequired}`);
}
for (const a of approvals.slice(-10)) {
  console.log(`[APPROVAL] ${a.eventId} decision=${a.decision} status=${a.status}`);
}
for (const p of published.slice(-10)) {
  console.log(`[PUBLISHED] ${p.eventId} ${p.channel} mode=${p.mode} status=${p.status}`);
}
