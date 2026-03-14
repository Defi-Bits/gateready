#!/usr/bin/env node
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const base = join(ROOT, "artifacts");

if (!existsSync(base)) {
  console.log("NO_FORENSICS_DIR");
  process.exit(0);
}

const dirs = readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("forensics-"))
  .map((d) => d.name)
  .sort()
  .reverse();

if (!dirs.length) {
  console.log("NO_FORENSIC_SNAPSHOTS");
  process.exit(0);
}

for (const d of dirs) {
  console.log(d.replace("forensics-", ""));
}
