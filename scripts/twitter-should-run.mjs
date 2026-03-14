#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG_PATH = join(WORKSPACE, "shared-core", "strategy", "twitter-growth-config.json");
const STATE_PATH = join(ROOT, "state", "twitter-runtime.json");

function loadJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

const cfg = loadJson(CFG_PATH, {});
const state = loadJson(STATE_PATH, { lastRunAt: 0, runCount: 0 });
const now = new Date();
const hourET = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: cfg.timezone || "America/New_York" }).format(now));
const inWindow = (cfg.runWindowsET || []).includes(hourET);

const minsSince = (Date.now() - Number(state.lastRunAt || 0)) / 60000;
const gapOk = minsSince >= Number(cfg.minMinutesBetweenRuns || 90);

const shouldRun = Boolean(inWindow && gapOk);
const out = { ok: true, shouldRun, reason: shouldRun ? "window+gap_ok" : `inWindow=${inWindow},gapOk=${gapOk}`, hourET, minsSince: Math.floor(minsSince) };

if (process.argv.includes("--mark")) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ ...state, lastRunAt: Date.now(), runCount: (state.runCount || 0) + 1 }, null, 2));
}

console.log(JSON.stringify(out));
