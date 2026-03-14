#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG = join(WORKSPACE, "shared-core", "strategy", "content-growth-config.json");
const LATEST = join(ROOT, "state", "site-latest.json");
const LAST_HASH = join(ROOT, "state", "content-last-hash.json");
const QUEUE = join(ROOT, "state", "content-queue.jsonl");

function loadJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

const cfg = loadJson(CFG, {});
const latest = loadJson(LATEST, null);
if (!latest?.hash) {
  console.error("site snapshot missing; run site-capture first");
  process.exit(1);
}

const last = loadJson(LAST_HASH, { hash: "" });
if (last.hash === latest.hash) {
  console.log(JSON.stringify({ ok: true, queued: 0, reason: "no_site_change" }));
  process.exit(0);
}

const sourceText = (latest.pages || []).map((p) => p.text).join("\n\n").slice(0, 18000);
const prompt = [
  "You are a growth content strategist for EdgeTerminal.",
  "From the website text, output STRICT JSON with keys:",
  "insights (array of max 5 strings), thread (array of max 5 tweet strings, no hashtags spam), video (object with hook, beats[5], cta, caption)",
  `Target short video duration: ${Number(cfg.videoDurationSeconds || 35)} seconds.`, 
  "Be concrete and truthful. No invented claims.",
  "Website text:",
  sourceText,
].join("\n");

let parsed;
try {
  const res = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.OUTREACH_MODEL || "llama3.2:3b", prompt, stream: false }),
  });
  const body = await res.json();
  const raw = String(body?.response || "{}").trim();
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
} catch {
  parsed = {
    insights: ["EdgeTerminal focuses on fast, clear crypto workflow signals."],
    thread: [
      "Most traders don’t need more noise. They need faster signal triage.",
      "EdgeTerminal is being built around speed + clarity over dashboard clutter.",
      "If your stack feels heavy, simplify alerts first.",
      "We’re documenting improvements publicly as we ship.",
      "Want early access feedback loops? Follow along at edgeterminal.io"
    ],
    video: {
      hook: "Stop drowning in crypto dashboard noise.",
      beats: ["Problem: too many alerts", "What EdgeTerminal changes", "How speed helps decisions", "Live product angle", "Invite feedback"],
      cta: "Visit edgeterminal.io",
      caption: "Building a cleaner, faster crypto workflow. #crypto #buildinpublic"
    }
  };
}

const item = {
  ts: new Date().toISOString(),
  venture: cfg.venture || "edgeterminal",
  type: "site_growth_pack",
  sourceHash: latest.hash,
  sourceUrl: latest.siteUrl,
  insights: parsed.insights || [],
  thread: parsed.thread || [],
  video: parsed.video || {},
  status: "pending_approval"
};

mkdirSync(dirname(QUEUE), { recursive: true });
const current = readJsonl(QUEUE);
const exists = current.some((x) => x.type === "site_growth_pack" && x.sourceHash === latest.hash);
if (!exists) {
  writeFileSync(QUEUE, [...current, item].map((x) => JSON.stringify(x)).join("\n") + "\n");
}
writeFileSync(LAST_HASH, JSON.stringify({ hash: latest.hash, ts: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ ok: true, queued: exists ? 0 : 1, queue: QUEUE }));
