#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVAL_LOG = join(ROOT, "state", "outreach-approvals.jsonl");
const PUBLISH_LOG = join(ROOT, "state", "outreach-published.jsonl");

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const mode = arg("mode", "dryrun");
const approvals = readJsonl(APPROVAL_LOG).filter((a) => a.status === "ready_to_publish");
const already = new Set(readJsonl(PUBLISH_LOG).map((p) => p.eventId));
const queue = approvals.filter((a) => !already.has(a.eventId));

const published = [];
for (const item of queue) {
  const adapter = item.channel === "reddit" ? "reddit" : "twitter";
  published.push({
    ts: new Date().toISOString(),
    eventId: item.eventId,
    venture: item.venture,
    channel: item.channel,
    adapter,
    mode,
    status: mode === "live" ? "queued_live_adapter" : "published_dryrun",
    content: item.draft,
    sourceUrl: item.sourceUrl,
  });
}

if (published.length) {
  mkdirSync(dirname(PUBLISH_LOG), { recursive: true });
  const existing = readJsonl(PUBLISH_LOG);
  writeFileSync(PUBLISH_LOG, [...existing, ...published].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, published: published.length, mode, publishLog: PUBLISH_LOG }));
