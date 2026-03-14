#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path, n = 20) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).slice(-n).map((l) => JSON.parse(l));
  } catch { return []; }
}

const venture = arg("venture", "edgeterminal");
const channel = arg("channel", "twitter");
const outPath = join(ROOT, "state", `context-pack-${venture}-${channel}.json`);

const ventureStructure = readJson(join(ROOT, "config", "venture-bot-structure.json"), { ventures: {} });
const ventureConfig = ventureStructure?.ventures?.[venture] || null;
if (!ventureConfig) {
  console.error(JSON.stringify({ ok: false, error: "unknown_venture", venture, known: Object.keys(ventureStructure?.ventures || {}) }));
  process.exit(1);
}

const pack = {
  ts: new Date().toISOString(),
  venture,
  channel,
  runtimeControl: readJson(join(WORKSPACE, "shared-core", "policies", "runtime-control.json"), {}),
  strategy: {
    ventureProfile: ventureConfig,
    ventureProfiles: readJson(join(WORKSPACE, "shared-core", "strategy", "venture-profiles.json"), {}),
    twitterGrowth: readJson(join(WORKSPACE, "shared-core", "strategy", "twitter-growth-config.json"), {}),
    ventureBotStructure: ventureStructure,
  },
  recent: {
    events: readJsonl(join(ROOT, "state", "outreach-events.jsonl"), 30).filter((x) => !x?.venture || x.venture === venture),
    plans: readJsonl(join(ROOT, "state", "outreach-plan.jsonl"), 30).filter((x) => !x?.venture || x.venture === venture),
    drafts: readJsonl(join(ROOT, "state", "outreach-drafts.jsonl"), 30).filter((x) => !x?.venture || x.venture === venture),
    qc: readJsonl(join(ROOT, "state", "outreach-qc.jsonl"), 30).filter((x) => !x?.venture || x.venture === venture),
    published: readJsonl(join(ROOT, "state", "outreach-published.jsonl"), 30).filter((x) => !x?.venture || x.venture === venture),
  }
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(pack, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, outPath, counts: {
  events: pack.recent.events.length,
  plans: pack.recent.plans.length,
  drafts: pack.recent.drafts.length,
  qc: pack.recent.qc.length,
  published: pack.recent.published.length,
}}));
