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

const channel = arg("channel", "twitter");
const venture = arg("venture", "");

const drafts = readJsonl(DRAFT_LOG);
const approvals = readJsonl(APPROVAL_LOG);
const approvedIds = new Set(approvals.map((a) => a.eventId));

const candidates = drafts.filter((d) => d.channel === channel && !d.approvalRequired && !approvedIds.has(d.eventId) && (!venture || d.venture === venture));

const now = new Date().toISOString();
const newApprovals = candidates.map((d) => ({
  ts: now,
  eventId: d.eventId,
  decision: "approve",
  note: "auto-approved-safe-lane",
  channel: d.channel,
  venture: d.venture,
  draft: d.draft,
  sourceUrl: d.sourceUrl,
  replyToTweetId: d.replyToTweetId || "",
  status: "ready_to_publish",
}));

if (newApprovals.length) {
  mkdirSync(dirname(APPROVAL_LOG), { recursive: true });
  writeFileSync(APPROVAL_LOG, [...approvals, ...newApprovals].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, autoApproved: newApprovals.length, channel, venture: venture || "all" }));
