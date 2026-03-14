#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVAL_LOG = join(ROOT, "state", "outreach-approvals.jsonl");
const PUBLISH_LOG = join(ROOT, "state", "outreach-published.jsonl");
const ROUTING_CFG = join(ROOT, "config", "content-routing.json");

function readJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}
function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
}
function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const mode = arg("mode", "dryrun"); // dryrun|live
const venture = arg("venture", "");
const max = Number(arg("max", "5"));
const cfg = readJson(ROUTING_CFG, {});
const target = arg("target", cfg.telegram?.target || process.env.TELEGRAM_PIPELINE_TARGET || "");
const prefix = cfg.telegram?.batchPrefix || "🧠 Content Pipeline";

if (mode === "live" && !target) {
  console.error("Missing Telegram target. Set config/content-routing.json or --target.");
  process.exit(1);
}

const approvals = readJsonl(APPROVAL_LOG).filter((a) => a.status === "ready_to_publish");
const already = new Set(
  readJsonl(PUBLISH_LOG)
    .filter((p) => p.channel === "telegram")
    .map((p) => p.eventId)
);

let queue = approvals.filter((a) => !already.has(a.eventId));
if (venture) queue = queue.filter((q) => q.venture === venture);
if (Number.isFinite(max) && max > 0) queue = queue.slice(0, max);

const outputs = [];
for (const item of queue) {
  const msg = `${prefix}\nventure: ${item.venture}\nchannel: ${item.channel}\n---\n${item.draft}`;
  try {
    if (mode === "live") {
      execSync(`/Users/terminal/.npm-global/bin/openclaw message send --channel telegram --target ${target} --message ${JSON.stringify(msg)}`, { stdio: "ignore" });
    }
    outputs.push({
      ts: new Date().toISOString(),
      eventId: item.eventId,
      venture: item.venture,
      channel: "telegram",
      mode,
      status: mode === "live" ? "published_live" : "published_dryrun",
      content: item.draft,
      sourceUrl: item.sourceUrl || "",
      replyToTweetId: item.replyToTweetId || ""
    });
  } catch (e) {
    outputs.push({
      ts: new Date().toISOString(),
      eventId: item.eventId,
      venture: item.venture,
      channel: "telegram",
      mode,
      status: "publish_failed",
      error: String(e?.message || e),
      content: item.draft,
      sourceUrl: item.sourceUrl || ""
    });
  }
}

if (outputs.length) {
  mkdirSync(dirname(PUBLISH_LOG), { recursive: true });
  const existing = readJsonl(PUBLISH_LOG);
  writeFileSync(PUBLISH_LOG, [...existing, ...outputs].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

const failed = outputs.filter((o) => o.status === "publish_failed").length;
console.log(JSON.stringify({ ok: true, mode, attempted: queue.length, written: outputs.length, failed, target }));
