#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";
const PLAN_LOG = join(ROOT, "state", "outreach-plan.jsonl");
const DRAFT_LOG = join(ROOT, "state", "outreach-drafts.jsonl");
const STYLE_SNIPPETS = join(WORKSPACE, "shared-core", "training", "style-snippets.json");
const MODEL = process.env.OUTREACH_MODEL ?? "llama3.2:3b";

function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function appendJsonl(path, items) {
  mkdirSync(dirname(path), { recursive: true });
  const existing = readJsonl(path);
  writeFileSync(path, [...existing, ...items].map((x) => JSON.stringify(x)).join("\n") + "\n");
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

async function aiDraft(item) {
  const style = readJson(STYLE_SNIPPETS, {});
  const fewshot = Array.isArray(style?.[item.venture]) ? style[item.venture].slice(0, 3) : [];
  const prompt = [
    "You are a concise social copywriter.",
    `Venture: ${item.venture}`,
    `Channel: ${item.channel}`,
    `Intent: ${item.intent}`,
    "Write one short reply under 240 chars.",
    "Avoid claims you cannot verify.",
    "Use punchy, specific language. Avoid generic hype.",
    fewshot.length ? `Style examples:\n- ${fewshot.join("\n- ")}` : "",
    `Context: ${item.draftPrompt}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`ollama_http_${res.status}`);
    const body = await res.json();
    const text = String(body?.response ?? "").trim();
    return text || fallbackDraft(item);
  } catch {
    return fallbackDraft(item);
  }
}

function fallbackDraft(item) {
  if (item.venture === "edgeterminal") {
    return "If you want fast signal triage + cleaner terminal workflows, EdgeTerminal is built for exactly that. Happy to share a quick walkthrough.";
  }
  return "Appreciate you raising this — we can help. If useful, share your use case and we’ll point you to the best next step.";
}

const plans = readJsonl(PLAN_LOG);
const drafted = new Set(readJsonl(DRAFT_LOG).map((d) => d.eventId));
const pending = plans.filter((p) => !drafted.has(p.eventId) && p.action !== "ignore");

const out = [];
for (const p of pending) {
  const draft = await aiDraft(p);
  out.push({
    ts: new Date().toISOString(),
    eventId: p.eventId,
    venture: p.venture,
    channel: p.channel,
    action: p.action,
    approvalRequired: p.approvalRequired,
    draft,
    sourceUrl: p.sourceUrl,
    replyToTweetId: p.replyToTweetId || "",
    status: "pending_approval",
  });
}

if (out.length) appendJsonl(DRAFT_LOG, out);
console.log(JSON.stringify({ ok: true, drafted: out.length, draftLog: DRAFT_LOG }));
