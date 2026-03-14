#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const STANDARDS = join(WORKSPACE, "shared-core", "policies", "omnichannel-standards.json");
const IN = join(ROOT, "state", "content-queue.jsonl");
const OUT = join(ROOT, "state", "omnichannel-review.jsonl");
const INDEX = join(ROOT, "state", "omnichannel-index.json");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } }

const standards = readJson(STANDARDS, {});
const floor = standards?.global?.qualityFloor || {};
const items = readJsonl(IN).slice(-20);
const idx = new Set(readJson(INDEX, []));
const existing = readJsonl(OUT);
const out = [];

function mkId(base) { return createHash("sha256").update(base).digest("hex").slice(0, 16); }

function passesQualityFloor(text) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  const min = Number(floor.minCoreLength || 30);
  const max = Number(floor.maxCoreLength || 280);
  if (t.length < min) return { ok: false, reason: "too_short" };
  if (t.length > max) return { ok: false, reason: "too_long" };

  const lower = t.toLowerCase();
  for (const p of (floor.bannedPhrases || [])) {
    if (lower.includes(String(p).toLowerCase())) return { ok: false, reason: `banned_phrase:${p}` };
  }

  const req = Array.isArray(floor.requiresAnyKeyword) ? floor.requiresAnyKeyword : [];
  if (req.length > 0) {
    const has = req.some((k) => lower.includes(String(k).toLowerCase()));
    if (!has) return { ok: false, reason: "missing_required_keywords" };
  }

  return { ok: true, reason: "pass" };
}

const rejected = [];

for (const item of items) {
  const core = (item.thread?.[0] || item.insights?.[0] || "").trim();
  if (!core) continue;
  const quality = passesQualityFloor(core);
  if (!quality.ok) {
    rejected.push({ venture: item.venture || "unknown", reason: quality.reason, sample: core.slice(0, 120) });
    continue;
  }
  const ideaId = mkId(`${item.venture}|${item.sourceHash}|${core}`);
  if (idx.has(ideaId)) continue;

  const objective = item.venture === "gateready" ? "conversion" : "awareness";
  const proof = item.sourceUrl || "site_update";
  const persona = item.venture === "gateready" ? "event-goer" : "active trader";
  const riskNote = "checked-by-global-and-sector-qc";

  const variants = [
    {
      channel: "twitter",
      format: "single",
      text: core.slice(0, standards?.channels?.twitter?.maxChars || 260)
    },
    {
      channel: "instagram",
      format: "reel_script",
      text: `Hook: ${core}\nBeat 1: Problem\nBeat 2: What changed\nBeat 3: CTA`
    },
    {
      channel: "facebook",
      format: "community_post",
      text: `${core}\n\nWhat are you seeing on your side?`
    },
    {
      channel: "youtube",
      format: "short_script",
      text: `Title idea: ${core.slice(0, 70)}\nScript:\n${core}\nCTA: Follow for updates.`
    }
  ];

  for (const v of variants) {
    out.push({
      ts: new Date().toISOString(),
      ideaId,
      variantId: mkId(`${ideaId}|${v.channel}|${v.format}`),
      venture: item.venture || "edgeterminal",
      objective,
      persona,
      proof,
      cta: "soft",
      riskNote,
      channel: v.channel,
      format: v.format,
      draft: v.text,
      status: "pending_review"
    });
  }
  idx.add(ideaId);
}

if (out.length) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, [...existing, ...out].map(x => JSON.stringify(x)).join("\n") + "\n");
  writeFileSync(INDEX, JSON.stringify(Array.from(idx), null, 2));
}

console.log(JSON.stringify({ ok: true, created: out.length, rejected: rejected.length, rejectedReasons: rejected.slice(0, 10), out: OUT }));
