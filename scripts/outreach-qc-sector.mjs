#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const APPROVALS = join(ROOT, "state", "outreach-approvals.jsonl");
const QCLOG = join(ROOT, "state", "outreach-qc-sector.jsonl");
const POLICY = join(WORKSPACE, "shared-core", "policies", "sector-qc-policy.json");

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; } }
function readJsonl(path) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

const policies = readJson(POLICY, {});
const approvals = readJsonl(APPROVALS);
const qclog = readJsonl(QCLOG);

const reviewed = [];
const updatedApprovals = approvals.map((a) => {
  if (a.status !== "ready_to_publish") return a;
  const venture = a.venture || "default";
  const p = policies[venture] || policies.default || { hardBlocks: [], mustIncludeAny: [], maxChars: 260 };
  const text = String(a.draft || "");
  const lower = text.toLowerCase();

  let decision = "approve";
  let reason = "sector_pass";

  if (text.length > Number(p.maxChars || 260)) {
    decision = "reject";
    reason = "sector_too_long";
  }
  for (const bad of (p.hardBlocks || [])) {
    if (lower.includes(String(bad).toLowerCase())) {
      decision = "reject";
      reason = `sector_hard_block:${bad}`;
      break;
    }
  }
  if (decision === "approve" && Array.isArray(p.mustIncludeAny) && p.mustIncludeAny.length > 0) {
    const hasOne = p.mustIncludeAny.some((kw) => lower.includes(String(kw).toLowerCase()));
    if (!hasOne) {
      decision = "rewrite";
      reason = "sector_missing_signal_terms";
    }
  }

  reviewed.push({ ts: new Date().toISOString(), eventId: a.eventId, venture, decision, reason });

  if (decision === "approve") return a;
  return { ...a, status: decision === "reject" ? "rejected_sector" : "rewrite_sector", note: `sector-qc:${reason}` };
});

if (reviewed.length) {
  mkdirSync(dirname(QCLOG), { recursive: true });
  writeFileSync(QCLOG, [...qclog, ...reviewed].map((x) => JSON.stringify(x)).join("\n") + "\n");
  writeFileSync(APPROVALS, updatedApprovals.map((x) => JSON.stringify(x)).join("\n") + "\n");
}

console.log(JSON.stringify({ ok: true, reviewed: reviewed.length, blocked: reviewed.filter((r) => r.decision !== "approve").length, qclog: QCLOG }));
