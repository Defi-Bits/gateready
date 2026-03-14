#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { postTwitter, postReddit } from "./outreach-adapters.mjs";
import { verifyTwitterIdentity } from "./twitter-identity-guard.mjs";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVAL_LOG = join(ROOT, "state", "outreach-approvals.jsonl");
const PUBLISH_LOG = join(ROOT, "state", "outreach-published.jsonl");
const RUNTIME_CONTROL = join(WORKSPACE, "shared-core", "policies", "runtime-control.json");

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

let mode = arg("mode", "dryrun");
const venture = arg("venture", "");
const channelFilter = arg("channel", "");
const max = Number(arg("max", "5"));
const delayMs = Number(arg("delayMs", "1200"));
const redditSubreddit = arg("redditSubreddit", process.env.REDDIT_DEFAULT_SUBREDDIT || "test");

const rc = readJson(RUNTIME_CONTROL, { publishingEnabled: true, twitterEnabled: true, manualRelayMode: true });
if (!rc.publishingEnabled) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "publishing_disabled" }));
  process.exit(0);
}
if (mode === "live" && rc.manualRelayMode === true) {
  mode = "dryrun";
}

const approvals = readJsonl(APPROVAL_LOG).filter((a) => a.status === "ready_to_publish");
const already = new Set(readJsonl(PUBLISH_LOG).map((p) => p.eventId));
let queue = approvals.filter((a) => !already.has(a.eventId));
if (venture) queue = queue.filter((q) => q.venture === venture);
if (channelFilter) queue = queue.filter((q) => q.channel === channelFilter);
if (rc.twitterEnabled === false) queue = queue.filter((q) => q.channel !== "twitter");
if (Number.isFinite(max) && max > 0) queue = queue.slice(0, max);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (mode === "live") {
  const recent = readJsonl(PUBLISH_LOG).filter((p) => p.mode === "live");
  const cutoff = Date.now() - Number(rc.failureWindowHours || 24) * 3600_000;
  const recentFails = recent.filter((p) => p.status === "publish_failed" && new Date(p.ts).getTime() >= cutoff).length;
  if (recentFails >= Number(rc.maxPublishFailuresBeforePause || 5)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "circuit_breaker_open", recentFails }));
    process.exit(0);
  }
}

if (mode === "live" && (channelFilter === "twitter" || !channelFilter) && queue.some((q) => q.channel === "twitter")) {
  await verifyTwitterIdentity();
}

const published = [];
for (const item of queue) {
  const channel = item.channel === "reddit" ? "reddit" : "twitter";

  try {
    let externalId = null;
    if (mode === "live") {
      if (channel === "twitter") {
        const r = await postTwitter({ text: item.draft, replyToTweetId: item.replyToTweetId || "" });
        externalId = r.id;
      } else {
        const title = `[${item.venture}] Insight`;
        const r = await postReddit({ title, text: item.draft, subreddit: redditSubreddit });
        externalId = r.id;
      }
    }

    published.push({
      ts: new Date().toISOString(),
      eventId: item.eventId,
      venture: item.venture,
      channel,
      mode,
      status: mode === "live" ? "published_live" : "published_dryrun",
      externalId,
      content: item.draft,
      sourceUrl: item.sourceUrl,
      replyToTweetId: item.replyToTweetId || "",
    });
  } catch (e) {
    published.push({
      ts: new Date().toISOString(),
      eventId: item.eventId,
      venture: item.venture,
      channel,
      mode,
      status: "publish_failed",
      error: String(e?.message || e),
      content: item.draft,
      sourceUrl: item.sourceUrl,
      replyToTweetId: item.replyToTweetId || "",
    });
  }

  if (mode === "live" && delayMs > 0) {
    await sleep(delayMs);
  }
}

if (published.length) {
  mkdirSync(dirname(PUBLISH_LOG), { recursive: true });
  const existing = readJsonl(PUBLISH_LOG);
  writeFileSync(PUBLISH_LOG, [...existing, ...published].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

const failed = published.filter((p) => p.status === "publish_failed").length;
console.log(JSON.stringify({ ok: true, mode, channelFilter: channelFilter || "all", attempted: queue.length, written: published.length, failed, publishLog: PUBLISH_LOG }));
