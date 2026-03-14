#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

const drafts = readJsonl(join(ROOT, "state", "outreach-drafts.jsonl")).slice(-50);

function score(text) {
  const t = String(text || "").trim();
  if (!t) return { score: 0, reasons: ["empty"] };
  const lower = t.toLowerCase();
  let s = 0;
  const reasons = [];

  if (t.length >= 60 && t.length <= 220) { s += 2; reasons.push("good_length"); }
  if (/\b(\d+|one|two|three)\b/i.test(t)) { s += 1; reasons.push("has_structure_or_number"); }
  if (lower.includes("?") || /\bwhat|why|how\b/.test(lower)) { s += 1; reasons.push("curiosity_or_question"); }
  if (/\b(signal|workflow|execution|policy|entry|clear bag)\b/i.test(t)) { s += 2; reasons.push("domain_specific"); }
  if (/\b(guaranteed|risk-free|always)\b/i.test(lower)) { s -= 3; reasons.push("hype_or_risky_claim"); }
  if (/\b(we're excited|stay tuned|learn more)\b/i.test(lower)) { s -= 2; reasons.push("generic_phrase"); }

  return { score: s, reasons };
}

const out = drafts.map(d => ({
  eventId: d.eventId,
  venture: d.venture,
  channel: d.channel,
  ...score(d.draft),
  draft: String(d.draft || "").slice(0, 140)
}));

const avg = out.length ? out.reduce((a, b) => a + b.score, 0) / out.length : 0;
console.log(JSON.stringify({ ok: true, checked: out.length, avgScore: Number(avg.toFixed(2)), samples: out.slice(-10) }, null, 2));
