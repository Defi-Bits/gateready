#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const QUEUE = join(ROOT, "state", "content-queue.jsonl");

function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

const items = readJsonl(QUEUE).slice(-10);
if (!items.length) {
  console.log("NO_CONTENT_ITEMS");
  process.exit(0);
}
for (const i of items) {
  console.log(`[${i.venture}] type=${i.type} status=${i.status} sourceHash=${String(i.sourceHash).slice(0,10)} insights=${(i.insights||[]).length} thread=${(i.thread||[]).length}`);
}
