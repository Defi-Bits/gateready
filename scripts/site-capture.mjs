#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG = join(WORKSPACE, "shared-core", "strategy", "content-growth-config.json");
const LATEST = join(ROOT, "state", "site-latest.json");
const SNAPSHOTS = join(ROOT, "state", "site-snapshots.jsonl");

function loadJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }

const cfg = loadJson(CFG, {});
const base = cfg.siteUrl || process.argv[2] || "https://edgeterminal.io";
const paths = cfg.capturePaths || ["/"];

const pages = [];
for (const p of paths) {
  const url = new URL(p, base).toString();
  try {
    const res = await fetch(url, { headers: { "user-agent": "mission-control-content/1.0" } });
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    pages.push({ url, ok: res.ok, status: res.status, text: text.slice(0, 20000) });
  } catch (e) {
    pages.push({ url, ok: false, error: String(e?.message || e), text: "" });
  }
}

const combined = pages.map((p) => `[${p.url}] ${p.text}`).join("\n\n");
const hash = createHash("sha256").update(combined).digest("hex");
const snap = { ts: new Date().toISOString(), venture: cfg.venture || "edgeterminal", siteUrl: base, hash, pages };

mkdirSync(dirname(LATEST), { recursive: true });
writeFileSync(LATEST, JSON.stringify(snap, null, 2));
appendFileSync(SNAPSHOTS, JSON.stringify(snap) + "\n");
console.log(JSON.stringify({ ok: true, hash, pages: pages.length, latest: LATEST }));
