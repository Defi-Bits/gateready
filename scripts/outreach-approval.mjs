#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const DRAFT_LOG = join(ROOT, "state", "outreach-drafts.jsonl");
const APPROVAL_LOG = join(ROOT, "state", "outreach-approvals.jsonl");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const eventId = arg("event", "").trim();
const decision = arg("decision", "approve").trim();
const note = arg("note", "").trim();

if (!eventId) {
  console.error("outreach-approval requires --event <id>");
  process.exit(1);
}
if (!["approve", "reject"].includes(decision)) {
  console.error("decision must be approve|reject");
  process.exit(1);
}

const drafts = readJsonl(DRAFT_LOG);
const item = drafts.find((d) => d.eventId === eventId);
if (!item) {
  console.error(`event not found: ${eventId}`);
  process.exit(1);
}

mkdirSync(dirname(APPROVAL_LOG), { recursive: true });
const approvals = readJsonl(APPROVAL_LOG);
approvals.push({
  ts: new Date().toISOString(),
  eventId,
  decision,
  note,
  channel: item.channel,
  venture: item.venture,
  draft: item.draft,
  sourceUrl: item.sourceUrl,
  replyToTweetId: item.replyToTweetId || "",
  status: decision === "approve" ? "ready_to_publish" : "rejected",
});
writeFileSync(APPROVAL_LOG, approvals.map((x) => JSON.stringify(x)).join("\n") + "\n");

console.log(JSON.stringify({ ok: true, eventId, decision, approvalLog: APPROVAL_LOG }));
