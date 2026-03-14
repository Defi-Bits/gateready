#!/usr/bin/env node
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const INBOX = join(ROOT, "state", "engagement-inbox.jsonl");
const EVENTS = join(ROOT, "state", "outreach-events.jsonl");
const MEMORY = join(ROOT, "state", "engagement-memory.json");

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
function loadJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }

const cooldownHours = Number(process.env.ENGAGEMENT_COOLDOWN_HOURS || 24);
const now = Date.now();
const mem = loadJson(MEMORY, { authorLastTs: {}, seenTweetIds: {} });
const inbox = readJsonl(INBOX);

let planned = 0;
for (const m of inbox) {
  if (!m.tweetId || mem.seenTweetIds[m.tweetId]) continue;
  const prev = Number(mem.authorLastTs[m.authorId] || 0);
  if (prev && (now - prev) < cooldownHours * 3600_000) continue;

  const event = {
    ts: new Date().toISOString(),
    id: randomUUID(),
    status: "new",
    venture: "edgeterminal",
    channel: "twitter",
    intent: "question",
    nuisances: [],
    url: m.url || `https://x.com/i/web/status/${m.tweetId}`,
    text: m.text || "",
    authorId: m.authorId || "",
    sourceTweetId: m.tweetId,
    source: "engagement"
  };
  mkdirSync(dirname(EVENTS), { recursive: true });
  appendFileSync(EVENTS, JSON.stringify(event) + "\n");

  mem.seenTweetIds[m.tweetId] = true;
  if (m.authorId) mem.authorLastTs[m.authorId] = now;
  planned++;
}

writeFileSync(MEMORY, JSON.stringify(mem, null, 2));
console.log(JSON.stringify({ ok: true, planned, cooldownHours }));
