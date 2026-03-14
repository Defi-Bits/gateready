#!/usr/bin/env node
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const INBOX = process.env.SECURITY_CHIEF_INBOX_PATH ?? join(ROOT, "state", "security-chief-inbox.jsonl");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const source = arg("source", "unknown");
const severity = arg("severity", "info");
const message = arg("message", "").trim();

if (!message) {
  console.error("security-chief-ingest requires --message");
  process.exit(1);
}

mkdirSync(dirname(INBOX), { recursive: true });

const entry = {
  ts: new Date().toISOString(),
  source,
  severity,
  message,
};

appendFileSync(INBOX, `${JSON.stringify(entry)}\n`);
console.log(JSON.stringify({ ok: true, inbox: INBOX, source, severity }));
