#!/usr/bin/env node
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG_PATH = join(WORKSPACE, "shared-core", "strategy", "twitter-growth-config.json");
const EVENT_LOG = join(ROOT, "state", "outreach-events.jsonl");
const SEEN_PATH = join(ROOT, "state", "twitter-seen-tweets.json");

function loadJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
if (!token) {
  console.error("missing_x_bearer_token");
  process.exit(1);
}

const selfUserId = process.env.X_SELF_USER_ID || "";
const cfg = loadJson(CFG_PATH, {});
const seen = new Set(loadJson(SEEN_PATH, []));
const maxCandidates = Number(cfg.maxCandidatesPerScan || 15);

const collected = [];
for (const query of (cfg.scanQueries || [])) {
  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(Math.min(100, maxCandidates)));
  url.searchParams.set("tweet.fields", "author_id,created_at,public_metrics");

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) continue;
  const body = await res.json();
  for (const t of (body.data || [])) collected.push(t);
}

const unique = [];
const ids = new Set();
for (const t of collected) {
  if (!t?.id || ids.has(t.id) || seen.has(t.id)) continue;
  if (selfUserId && t.author_id === selfUserId) continue;
  ids.add(t.id);
  unique.push(t);
}

mkdirSync(dirname(EVENT_LOG), { recursive: true });
const now = new Date().toISOString();
for (const t of unique.slice(0, maxCandidates)) {
  const text = String(t.text || "").trim();
  if (!text) continue;
  const entry = {
    ts: now,
    id: randomUUID(),
    status: "new",
    venture: cfg.venture || "edgeterminal",
    channel: cfg.channel || "twitter",
    intent: text.includes("?") ? "question" : "competitor_mention",
    nuisances: [],
    url: `https://x.com/i/web/status/${t.id}`,
    text,
    authorId: t.author_id || "",
    sourceTweetId: t.id,
  };
  appendFileSync(EVENT_LOG, JSON.stringify(entry) + "\n");
  seen.add(t.id);
}

writeFileSync(SEEN_PATH, JSON.stringify(Array.from(seen).slice(-20000), null, 2));
console.log(JSON.stringify({ ok: true, discovered: unique.length, ingested: Math.min(unique.length, maxCandidates) }));
