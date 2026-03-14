#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");
const POLICY = join(WORKSPACE, "shared-core", "learning", "learning-policy.json");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

function score(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  const lower = t.toLowerCase();
  let s = 0;
  if (t.length >= 60 && t.length <= 220) s += 2;
  if (/\b(\d+|one|two|three)\b/i.test(t)) s += 1;
  if (lower.includes("?") || /\bwhat|why|how\b/.test(lower)) s += 1;
  if (/\b(signal|workflow|execution|policy|entry|clear bag|edge)\b/i.test(t)) s += 2;
  if (/\b(guaranteed|risk-free|always)\b/i.test(lower)) s -= 3;
  if (/\b(we're excited|stay tuned|learn more|did you know)\b/i.test(lower)) s -= 2;
  return s;
}

const p = readJson(POLICY, { styleScore: { minPassScore: 3, autoBlockBelowThreshold: true, minReadyToPublishPerRun: 1 } });
const minPass = Number(p?.styleScore?.minPassScore ?? 3);
const block = Boolean(p?.styleScore?.autoBlockBelowThreshold ?? true);
const minReady = Number(p?.styleScore?.minReadyToPublishPerRun ?? 1);

const approvals = readJsonl(APPROVALS);
const ready = approvals.filter((a) => a.status === "ready_to_publish");

const scored = ready.map((a) => ({ ...a, styleScore: score(a.draft) }));
scored.sort((a, b) => (b.styleScore || 0) - (a.styleScore || 0));

let blocked = 0;
let keptByOverride = 0;
const keepIds = new Set(
  scored
    .filter((a) => !block || (a.styleScore ?? 0) >= minPass)
    .map((a) => a.eventId)
);

if (keepIds.size < minReady) {
  for (const s of scored) {
    if (keepIds.size >= minReady) break;
    if (!keepIds.has(s.eventId)) {
      keepIds.add(s.eventId);
      keptByOverride++;
    }
  }
}

const scoreMap = new Map(scored.map((s) => [s.eventId, s.styleScore]));
const updated = approvals.map((a) => {
  if (a.status !== "ready_to_publish") return a;
  const s = Number(scoreMap.get(a.eventId) ?? score(a.draft));
  if (!keepIds.has(a.eventId)) {
    blocked++;
    return { ...a, styleScore: s, status: "rewrite_style", note: `style-score:${s}<${minPass}` };
  }
  const override = block && s < minPass;
  return {
    ...a,
    styleScore: s,
    note: override ? `style-floor-override:${s}<${minPass}` : a.note,
  };
});

writeFileSync(APPROVALS, updated.map((x) => JSON.stringify(x)).join("\n") + "\n");
console.log(JSON.stringify({ ok: true, checked: ready.length, blocked, keptByOverride, minPass, minReady }));
