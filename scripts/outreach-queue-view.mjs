#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const PLAN_LOG = join(ROOT, "state", "outreach-plan.jsonl");

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const items = readJsonl(PLAN_LOG).slice(-20);
for (const i of items) {
  console.log(`[${i.venture}] score=${i.score} action=${i.action} approval=${i.approvalRequired} intent=${i.intent} event=${i.eventId}`);
}

if (!items.length) console.log("NO_ITEMS");
