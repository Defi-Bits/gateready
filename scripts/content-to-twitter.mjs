#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CONTENT_Q = join(ROOT, "state", "content-queue.jsonl");
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");
const PUBLISHED_HASH = join(ROOT, "state", "content-twitter-hashes.json");

function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }
function loadJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }

const allContent = readJsonl(CONTENT_Q);
const pending = allContent.filter((x) => x.status === "pending_approval");
if (!pending.length) {
  console.log(JSON.stringify({ ok: true, queued: 0, reason: "no_pending_content" }));
  process.exit(0);
}

const seenHashes = new Set(loadJson(PUBLISHED_HASH, []));
const approvals = readJsonl(APPROVALS);
const out = [];
const promotedHashes = new Set();

for (const item of pending) {
  if (!item.sourceHash) continue;
  if (seenHashes.has(item.sourceHash)) continue;

  const lines = (item.thread || []).filter(Boolean).slice(0, 5);
  for (const line of lines) {
    out.push({
      ts: new Date().toISOString(),
      eventId: `content-${item.sourceHash.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`,
      decision: "approve",
      note: "site-pack-auto",
      channel: "twitter",
      venture: item.venture || "edgeterminal",
      draft: String(line).slice(0, 260),
      sourceUrl: item.sourceUrl || "",
      replyToTweetId: "",
      status: "ready_to_publish"
    });
  }

  promotedHashes.add(item.sourceHash);
  seenHashes.add(item.sourceHash);
}

if (out.length) {
  mkdirSync(dirname(APPROVALS), { recursive: true });
  writeFileSync(APPROVALS, [...approvals, ...out].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

const updatedContent = allContent.map((c) => {
  if (!c?.sourceHash) return c;
  if (promotedHashes.has(c.sourceHash) && c.status === "pending_approval") return { ...c, status: "promoted_to_twitter" };
  if (seenHashes.has(c.sourceHash) && c.status === "pending_approval") return { ...c, status: "already_promoted" };
  return c;
});
writeFileSync(CONTENT_Q, updatedContent.map((x) => JSON.stringify(x)).join("\n") + "\n");
writeFileSync(PUBLISHED_HASH, JSON.stringify(Array.from(seenHashes).slice(-5000), null, 2));

console.log(JSON.stringify({ ok: true, queued: out.length, promotedHashes: promotedHashes.size }));
