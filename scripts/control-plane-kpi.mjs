#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const OUT = join(ROOT, "state", "control-plane-kpi.json");
const STRUCTURE = join(ROOT, "config", "venture-bot-structure.json");
const TARGETS = join(ROOT, "config", "venture-kpi-targets.json");

function readJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function readJsonl(path) {
  try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}

function safeRate(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(3)) : null;
}

function statusForRate(rate, min) {
  if (rate == null || min == null) return "unknown";
  return rate >= min ? "on_track" : "below_target";
}

function statusForCount(value, min) {
  if (min == null) return "unknown";
  return value >= min ? "on_track" : "below_target";
}

const structure = readJson(STRUCTURE, { ventures: {} });
const targets = readJson(TARGETS, { ventures: {}, windowHours: 24 });

const now = Date.now();
const windowHours = Number(targets.windowHours || 24);
const since = now - windowHours * 3600_000;

const plans = readJsonl(join(ROOT, "state", "outreach-plan.jsonl"));
const drafts = readJsonl(join(ROOT, "state", "outreach-drafts.jsonl"));
const qc = readJsonl(join(ROOT, "state", "outreach-qc.jsonl"));
const pub = readJsonl(join(ROOT, "state", "outreach-published.jsonl"));

const recentPlans = plans.filter((x) => new Date(x.ts || 0).getTime() >= since);
const recentDrafts = drafts.filter((x) => new Date(x.ts || 0).getTime() >= since);
const recentQc = qc.filter((x) => new Date(x.ts || 0).getTime() >= since);
const recentPub = pub.filter((x) => new Date(x.ts || 0).getTime() >= since);

const approved = recentQc.filter((x) => x.decision === "approve").length;
const checked = recentQc.length;
const published = recentPub.filter((x) => x.status === "published_live" || x.status === "published_dryrun").length;
const failed = recentPub.filter((x) => x.status === "publish_failed").length;

function byVenture(venture) {
  const vp = recentPlans.filter((x) => (x.venture || "unknown") === venture);
  const vd = recentDrafts.filter((x) => (x.venture || "unknown") === venture);
  const vq = recentQc.filter((x) => (x.venture || "unknown") === venture);
  const vpub = recentPub.filter((x) => (x.venture || "unknown") === venture);
  const vApproved = vq.filter((x) => x.decision === "approve").length;
  const vPublished = vpub.filter((x) => x.status === "published_live" || x.status === "published_dryrun").length;
  const vFailed = vpub.filter((x) => x.status === "publish_failed").length;

  const rates = {
    qcApprovalRate: safeRate(vApproved, vq.length),
    publishSuccessRate: safeRate(vPublished, vPublished + vFailed),
  };

  const target = targets?.ventures?.[venture] || {};

  return {
    counts: {
      opportunities: vp.length,
      drafted: vd.length,
      qcChecked: vq.length,
      approved: vApproved,
      published: vPublished,
      failed: vFailed,
    },
    rates,
    targets: target,
    status: {
      opportunities: statusForCount(vp.length, target.opportunitiesMin),
      drafted: statusForCount(vd.length, target.draftedMin),
      qcApprovalRate: statusForRate(rates.qcApprovalRate, target.qcApprovalRateMin),
      publishSuccessRate: statusForRate(rates.publishSuccessRate, target.publishSuccessRateMin),
    },
  };
}

const ventureIds = Object.keys(structure.ventures || {});
const byVentureKpi = Object.fromEntries(ventureIds.map((id) => [id, byVenture(id)]));

const overallRates = {
  qcApprovalRate: safeRate(approved, checked),
  publishSuccessRate: safeRate(published, published + failed),
};

const kpi = {
  ts: new Date().toISOString(),
  windowHours,
  counts: {
    opportunities: recentPlans.length,
    drafted: recentDrafts.length,
    qcChecked: checked,
    approved,
    published,
    failed,
  },
  rates: overallRates,
  venturesTracked: ventureIds.length,
  byVenture: byVentureKpi,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(kpi, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, out: OUT, venturesTracked: ventureIds.length }));
