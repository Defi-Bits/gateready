#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const PROFILES = join(WORKSPACE, "shared-core", "strategy", "venture-profiles.json");
const EVENT_LOG = join(ROOT, "state", "outreach-events.jsonl");
const PLAN_LOG = join(ROOT, "state", "outreach-plan.jsonl");

function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

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

function extractTwitterStatusId(url = "") {
  const m = String(url).match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
  return m ? m[1] : "";
}

function scoreEvent(event, profile) {
  const base = profile.intentWeights?.[event.intent] ?? 1;
  const nuisancePenalty = (event.nuisances || []).reduce((acc, n) => {
    return acc + (profile.nuisancePenalties?.[n] ?? 0);
  }, 0);

  const score = base + nuisancePenalty;
  const approvalRequired = score < (profile.approvalThreshold ?? 5) || event.nuisances.includes("policy_risk");

  let action = "ignore";
  if (score >= 7) action = "reply_priority";
  else if (score >= 4) action = "reply_normal";
  else if (score >= 2) action = "monitor";

  return {
    score,
    action,
    approvalRequired,
  };
}

const profiles = loadJson(PROFILES, {});
const events = readJsonl(EVENT_LOG).filter((e) => e.status === "new");

mkdirSync(dirname(PLAN_LOG), { recursive: true });

const planned = events.map((event) => {
  const profile = profiles[event.venture] ?? profiles.edgeterminal;
  const decision = scoreEvent(event, profile);

  return {
    ts: new Date().toISOString(),
    eventId: event.id,
    venture: event.venture,
    channel: event.channel,
    intent: event.intent,
    nuisances: event.nuisances,
    score: decision.score,
    action: decision.action,
    approvalRequired: decision.approvalRequired,
    draftPrompt: `Create a concise ${event.channel} reply for ${event.venture}. Intent=${event.intent}. Text: ${event.text}`,
    sourceUrl: event.url,
    replyToTweetId: event.channel === "twitter" ? extractTwitterStatusId(event.url) : "",
  };
});

if (planned.length) {
  const current = readJsonl(PLAN_LOG);
  writeFileSync(PLAN_LOG, [...current, ...planned].map((x) => JSON.stringify(x)).join("\n") + "\n");

  const plannedIds = new Set(planned.map((p) => p.eventId));
  const allEvents = readJsonl(EVENT_LOG).map((e) => {
    if (plannedIds.has(e.id)) return { ...e, status: "planned" };
    return e;
  });
  writeFileSync(EVENT_LOG, allEvents.map((x) => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, planned: planned.length, planLog: PLAN_LOG }));
