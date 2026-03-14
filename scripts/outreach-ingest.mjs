#!/usr/bin/env node
import { appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const EVENT_LOG = join(ROOT, "state", "outreach-events.jsonl");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const venture = arg("venture", "edgeterminal");
const channel = arg("channel", "twitter");
const intent = arg("intent", "question");
const text = arg("text", "").trim();
const url = arg("url", "").trim();
const nuisances = arg("nuisances", "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

if (!text) {
  console.error("outreach-ingest requires --text");
  process.exit(1);
}

mkdirSync(dirname(EVENT_LOG), { recursive: true });

const entry = {
  ts: new Date().toISOString(),
  id: randomUUID(),
  status: "new",
  venture,
  channel,
  intent,
  nuisances,
  url,
  text,
};

appendFileSync(EVENT_LOG, `${JSON.stringify(entry)}\n`);
console.log(JSON.stringify({ ok: true, event: entry.id, path: EVENT_LOG }));
