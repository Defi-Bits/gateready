#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const POLICY = join(WORKSPACE, "shared-core", "policies", "runtime-control.json");
const STRUCTURE = join(ROOT, "config", "venture-bot-structure.json");

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

const action = process.argv[2] || "show";
const key = process.argv[3] || "";
const value = process.argv[4] || "";

const cfg = loadJson(POLICY, {});

if (action === "show") {
  console.log(JSON.stringify(cfg, null, 2));
  process.exit(0);
}

if (action === "show-ventures") {
  const structure = loadJson(STRUCTURE, { ventures: {} });
  const ventures = Object.entries(structure.ventures || {}).map(([id, v]) => ({
    id,
    label: v?.label || id,
    channels: v?.channels || [],
    bots: (v?.bots || []).map((b) => b.id),
  }));
  console.log(JSON.stringify({ ok: true, config: existsSync(STRUCTURE), ventures }, null, 2));
  process.exit(0);
}

if (action === "set") {
  if (!key) {
    console.error("usage: runtime-control set <key> <value>");
    process.exit(1);
  }
  let parsed = value;
  if (value === "true") parsed = true;
  else if (value === "false") parsed = false;
  else if (!Number.isNaN(Number(value)) && value.trim() !== "") parsed = Number(value);
  cfg[key] = parsed;
  writeFileSync(POLICY, JSON.stringify(cfg, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, key, value: parsed }));
  process.exit(0);
}

console.error("usage: runtime-control [show|set|show-ventures]");
process.exit(1);
