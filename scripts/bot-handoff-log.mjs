#!/usr/bin/env node
import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const LOG = join(ROOT, "state", "bot-handoffs.jsonl");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const entry = {
  ts: new Date().toISOString(),
  venture: arg("venture", "edgeterminal"),
  lane: arg("lane", "twitter"),
  bot: arg("bot", "unknown"),
  stage: arg("stage", "run"),
  status: arg("status", "ok"),
  inputRef: arg("inputRef", ""),
  outputRef: arg("outputRef", ""),
  note: arg("note", ""),
};

mkdirSync(dirname(LOG), { recursive: true });
appendFileSync(LOG, JSON.stringify(entry) + "\n");
console.log(JSON.stringify({ ok: true, log: LOG, bot: entry.bot, status: entry.status }));
