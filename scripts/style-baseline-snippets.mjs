#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const OUT = join(WORKSPACE, "shared-core", "training", "style-snippets.json");

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

const edge = readJsonl(join(WORKSPACE, "shared-core", "training", "viral-examples.edgeterminal.jsonl")).map(x => x.text).slice(0, 3);
const gate = readJsonl(join(WORKSPACE, "shared-core", "training", "viral-examples.gateready.jsonl")).map(x => x.text).slice(0, 3);

const snippets = {
  edgeterminal: edge,
  gateready: gate,
  updatedAt: new Date().toISOString()
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snippets, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, out: OUT, counts: { edgeterminal: edge.length, gateready: gate.length } }));
