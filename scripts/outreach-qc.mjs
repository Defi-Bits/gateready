#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const POLICY = join(WORKSPACE, "shared-core", "policies", "content-qc-policy.json");
const DRAFTS = join(ROOT, "state", "outreach-drafts.jsonl");
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");
const QCLOG = join(ROOT, "state", "outreach-qc.jsonl");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const policy = readJson(POLICY, { hardBlocks: [], rules: { maxChars: 260, maxHashtags: 2 } });
const drafts = readJsonl(DRAFTS);
const approvals = readJsonl(APPROVALS);
const already = new Set(approvals.map(a => a.eventId));
const qclog = readJsonl(QCLOG);

const outApprovals = [];
const outQc = [];
for (const d of drafts) {
  if (already.has(d.eventId)) continue;
  const text = String(d.draft || "");
  const lower = text.toLowerCase();
  const hashtags = (text.match(/#[a-z0-9_]+/gi) || []).length;

  let decision = "approve";
  let reason = "pass";

  if (text.length > (policy.rules?.maxChars || 260)) {
    decision = "reject"; reason = "too_long";
  }
  if (hashtags > (policy.rules?.maxHashtags || 2)) {
    decision = "rewrite"; reason = "too_many_hashtags";
  }
  for (const bad of (policy.hardBlocks || [])) {
    if (lower.includes(String(bad).toLowerCase())) {
      decision = "reject"; reason = `hard_block:${bad}`; break;
    }
  }

  outQc.push({ ts: new Date().toISOString(), eventId: d.eventId, decision, reason, channel: d.channel, venture: d.venture });

  if (decision === "approve") {
    outApprovals.push({
      ts: new Date().toISOString(),
      eventId: d.eventId,
      decision: "approve",
      note: "qc-pass",
      channel: d.channel,
      venture: d.venture,
      draft: d.draft,
      sourceUrl: d.sourceUrl,
      replyToTweetId: d.replyToTweetId || "",
      status: "ready_to_publish"
    });
  }
}

if (outQc.length) {
  mkdirSync(dirname(QCLOG), { recursive: true });
  writeFileSync(QCLOG, [...qclog, ...outQc].map(x => JSON.stringify(x)).join("\n") + "\n");
}
if (outApprovals.length) {
  mkdirSync(dirname(APPROVALS), { recursive: true });
  writeFileSync(APPROVALS, [...approvals, ...outApprovals].map(x => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, checked: outQc.length, approved: outApprovals.length, qclog: QCLOG }));
