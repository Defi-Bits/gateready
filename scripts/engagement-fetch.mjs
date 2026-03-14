#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const INBOX = join(ROOT, "state", "engagement-inbox.jsonl");
const STUB = join(ROOT, "state", "engagement-manual.jsonl");

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
const userId = process.env.X_ALLOWED_USER_ID || "";

// Fallback-first: manual inbox if API is unavailable or credits are blocked
const manual = readJsonl(STUB).slice(-50);
const fetched = [];

if (token && userId) {
  try {
    const url = new URL(`https://api.twitter.com/2/users/${userId}/mentions`);
    url.searchParams.set("max_results", "20");
    url.searchParams.set("tweet.fields", "author_id,created_at,conversation_id");
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) {
      const body = await res.json();
      for (const t of (body.data || [])) {
        fetched.push({
          ts: new Date().toISOString(),
          source: "x_mentions",
          tweetId: t.id,
          authorId: t.author_id || "",
          conversationId: t.conversation_id || "",
          text: t.text || "",
          url: `https://x.com/i/web/status/${t.id}`
        });
      }
    }
  } catch {}
}

const merged = [...manual, ...fetched];
if (merged.length) {
  mkdirSync(dirname(INBOX), { recursive: true });
  writeFileSync(INBOX, merged.map((x) => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, fetched: fetched.length, manual: manual.length, inbox: INBOX }));
